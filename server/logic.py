import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from models import ProjectMetadata, Crack, Section, SurveyDay, Project
from database import db
from google.cloud import firestore
from google.cloud.firestore import FieldFilter

def get_db():
    if db is None:
        raise RuntimeError(
            "Firestore client is not initialized. Please configure serviceAccountKey.json in the server folder."
        )
    return db

def get_next_id(collection_name: str) -> int:
    client = get_db()
    try:
        docs = client.collection(collection_name).order_by("id", direction=firestore.Query.DESCENDING).limit(1).get()
        if docs:
            val = docs[0].to_dict().get("id")
            if isinstance(val, (int, float)):
                return int(val) + 1
            if isinstance(val, str) and val.isdigit():
                return int(val) + 1
    except Exception:
        pass

    # Fallback scanning if index is building or not present
    all_docs = client.collection(collection_name).get()
    max_id = 0
    for doc in all_docs:
        val = doc.to_dict().get("id")
        if isinstance(val, (int, float)) and int(val) > max_id:
            max_id = int(val)
        elif isinstance(val, str) and val.isdigit() and int(val) > max_id:
            max_id = int(val)
    return max_id + 1

def get_next_ids(collection_name: str, count: int) -> List[int]:
    start = get_next_id(collection_name)
    return list(range(start, start + count))

def batch_delete_docs(docs):
    client = get_db()
    batch = client.batch()
    count = 0
    for doc in docs:
        ref = doc.reference if hasattr(doc, "reference") else doc
        batch.delete(ref)
        count += 1
        if count >= 450:
            batch.commit()
            batch = client.batch()
            count = 0
    if count > 0:
        batch.commit()

def load_data(project_id: int) -> ProjectMetadata:
    client = get_db()
    # Tolerance from project_metadata
    meta_docs = client.collection("project_metadata").where(filter=FieldFilter("project_id", "==", project_id)).limit(1).get()
    tolerance = 0.1
    if meta_docs:
        tolerance = meta_docs[0].to_dict().get("tolerance", 0.1)

    # Sections
    sec_docs = client.collection("sections").where(filter=FieldFilter("project_id", "==", project_id)).get()
    sections = [Section(**s.to_dict()) for s in sec_docs]
    sections.sort(key=lambda s: s.start_station)

    # Survey Days
    day_docs = client.collection("survey_days").where(filter=FieldFilter("project_id", "==", project_id)).get()
    day_dicts = [d.to_dict() for d in day_docs]
    day_dicts.sort(key=lambda x: x.get("order_index", 0))
    survey_days = [SurveyDay(**d) for d in day_dicts]

    # Cracks
    crack_docs = client.collection("cracks").where(filter=FieldFilter("project_id", "==", project_id)).get()
    cracks = [Crack(**c.to_dict()) for c in crack_docs]
    cracks.sort(key=lambda c: c.distance)

    return ProjectMetadata(sections=sections, survey_days=survey_days, cracks=cracks, tolerance=tolerance, project_id=project_id)

def save_data(data: ProjectMetadata):
    client = get_db()
    
    # --- Project Metadata ---
    meta_docs = client.collection("project_metadata").where(filter=FieldFilter("project_id", "==", data.project_id)).limit(1).get()
    if meta_docs:
        meta_docs[0].reference.set({"project_id": data.project_id, "tolerance": data.tolerance}, merge=True)
    else:
        new_meta_id = get_next_id("project_metadata")
        client.collection("project_metadata").document(str(new_meta_id)).set({
            "id": new_meta_id,
            "project_id": data.project_id,
            "tolerance": data.tolerance
        })

    # --- Sections ---
    kept_section_ids = []
    if data.sections:
        for s in data.sections:
            d = json.loads(s.json())
            d["project_id"] = data.project_id
            sec_id = d.get("id")
            if sec_id is None or (isinstance(sec_id, int) and sec_id < 0):
                sec_id = get_next_id("sections")
                d["id"] = sec_id
            client.collection("sections").document(str(sec_id)).set(d)
            kept_section_ids.append(sec_id)

    # Delete removed sections for this project
    existing_secs = client.collection("sections").where(filter=FieldFilter("project_id", "==", data.project_id)).get()
    for row in existing_secs:
        s_data = row.to_dict()
        s_id = s_data.get("id")
        if s_id not in kept_section_ids:
            # Orphan associated cracks
            orphans = client.collection("cracks").where(filter=FieldFilter("section_id", "==", s_id)).where(filter=FieldFilter("project_id", "==", data.project_id)).get()
            for o in orphans:
                o.reference.update({"section_id": None})
            row.reference.delete()

    # --- Survey Days ---
    if data.survey_days:
        for d in data.survey_days:
            dd = json.loads(d.json())
            dd["project_id"] = data.project_id
            day_id = dd.get("id")
            if day_id is None or (isinstance(day_id, int) and day_id < 0):
                day_id = get_next_id("survey_days")
                dd["id"] = day_id
            client.collection("survey_days").document(str(day_id)).set(dd)

    # --- Cracks ---
    cracks_to_insert = []
    cracks_to_update = []
    for c in data.cracks:
        cd = {"distance": c.distance, "day_id": c.day_id, "section_id": c.section_id, "project_id": data.project_id}
        if c.id is not None:
            cd["id"] = c.id
            cracks_to_update.append(cd)
        else:
            cracks_to_insert.append(cd)

    if cracks_to_insert:
        new_ids = get_next_ids("cracks", len(cracks_to_insert))
        for i, cd in enumerate(cracks_to_insert):
            cd["id"] = new_ids[i]
            cracks_to_update.append(cd)

    batch = client.batch()
    count = 0
    for cd in cracks_to_update:
        ref = client.collection("cracks").document(str(cd["id"]))
        batch.set(ref, cd)
        count += 1
        if count >= 450:
            batch.commit()
            batch = client.batch()
            count = 0
    if count > 0:
        batch.commit()

def get_section_for_distance(distance: float, sections: List[Section]) -> Optional[int]:
    for section in sections:
        if section.start_station <= distance < section.end_station:
            return section.id
    for section in sections:
        if distance == section.end_station:
            return section.id
    return None

def list_projects() -> List[dict]:
    client = get_db()
    docs = client.collection("projects").get()
    projects = [d.to_dict() for d in docs]
    projects.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return projects

def create_project(name: str) -> dict:
    client = get_db()
    try:
        new_id = get_next_id("projects")
        created_at = datetime.now(timezone.utc).isoformat()
        project_dict = {
            "id": new_id,
            "name": name,
            "created_at": created_at
        }
        client.collection("projects").document(str(new_id)).set(project_dict)

        # Initialize metadata
        meta_id = get_next_id("project_metadata")
        meta_payload = {
            "id": meta_id,
            "project_id": new_id,
            "tolerance": 0.1
        }
        client.collection("project_metadata").document(str(meta_id)).set(meta_payload)

        return project_dict
    except Exception as e:
        print(f"DEBUG EXCEPTION in create_project: {e}")
        return {}

def update_project(project_id: int, name: str) -> dict:
    client = get_db()
    doc_ref = client.collection("projects").document(str(project_id))
    doc_ref.set({"name": name}, merge=True)
    snap = doc_ref.get()
    return snap.to_dict() if snap.exists else {}

def delete_project(project_id: int):
    client = get_db()
    # Cascading delete all collections for this project
    batch_delete_docs(client.collection("cracks").where(filter=FieldFilter("project_id", "==", project_id)).get())
    batch_delete_docs(client.collection("survey_days").where(filter=FieldFilter("project_id", "==", project_id)).get())
    batch_delete_docs(client.collection("sections").where(filter=FieldFilter("project_id", "==", project_id)).get())
    batch_delete_docs(client.collection("project_metadata").where(filter=FieldFilter("project_id", "==", project_id)).get())
    client.collection("projects").document(str(project_id)).delete()

def duplicate_project(project_id: int) -> dict:
    client = get_db()
    proj_doc = client.collection("projects").document(str(project_id)).get()
    if not proj_doc.exists:
        print(f"Error: Project {project_id} not found for duplication")
        return {}

    orig_proj = proj_doc.to_dict()
    data = load_data(project_id)

    new_name = f"{orig_proj.get('name', 'Project')} (Copy)"
    new_project = create_project(new_name)
    new_id = new_project["id"]

    # Update metadata tolerance
    meta_docs = client.collection("project_metadata").where(filter=FieldFilter("project_id", "==", new_id)).limit(1).get()
    if meta_docs:
        meta_docs[0].reference.update({"tolerance": data.tolerance})

    # Copy sections
    old_to_new_sec = {}
    if data.sections:
        for sec in data.sections:
            old_id = sec.id
            sec_dict = json.loads(sec.json())
            new_sec_id = get_next_id("sections")
            sec_dict["id"] = new_sec_id
            sec_dict["project_id"] = new_id
            client.collection("sections").document(str(new_sec_id)).set(sec_dict)
            old_to_new_sec[old_id] = new_sec_id

    # Copy survey days
    old_to_new_day = {}
    if data.survey_days:
        for day in data.survey_days:
            old_day_id = day.id
            day_dict = json.loads(day.json())
            new_day_id = get_next_id("survey_days")
            day_dict["id"] = new_day_id
            day_dict["project_id"] = new_id
            client.collection("survey_days").document(str(new_day_id)).set(day_dict)
            old_to_new_day[old_day_id] = new_day_id

    # Copy cracks
    if data.cracks:
        crack_dicts = []
        new_crack_ids = get_next_ids("cracks", len(data.cracks))
        for idx, crack in enumerate(data.cracks):
            c_dict = json.loads(crack.json())
            c_dict["id"] = new_crack_ids[idx]
            c_dict["project_id"] = new_id
            c_dict["section_id"] = old_to_new_sec.get(c_dict["section_id"])
            c_dict["day_id"] = old_to_new_day.get(c_dict["day_id"])
            crack_dicts.append(c_dict)

        batch = client.batch()
        count = 0
        for cd in crack_dicts:
            ref = client.collection("cracks").document(str(cd["id"]))
            batch.set(ref, cd)
            count += 1
            if count >= 450:
                batch.commit()
                batch = client.batch()
                count = 0
        if count > 0:
            batch.commit()

    return new_project

def detect_conflicts(new_cracks: List[float], day_id: int, tolerance: float, existing_cracks: List[Crack]) -> List[Dict[str, Any]]:
    conflicts = []
    for dist in new_cracks:
        for existing in existing_cracks:
            if abs(dist - existing.distance) <= tolerance:
                conflicts.append({
                    "new_distance": dist,
                    "existing_crack": existing,
                    "day_id": day_id
                })
                break
    return conflicts

def calculate_spacing(cracks: List[Crack]) -> List[float]:
    if not cracks:
        return []
    sorted_dists = sorted([c.distance for c in cracks])
    spacings = []
    for i in range(1, len(sorted_dists)):
        spacings.append(sorted_dists[i] - sorted_dists[i-1])
    return spacings

def export_project(project_id: int) -> dict:
    data = load_data(project_id)
    return json.loads(data.json())

def import_project(project_id: int, data_dict: dict):
    client = get_db()
    # Delete existing data for this project
    batch_delete_docs(client.collection("cracks").where(filter=FieldFilter("project_id", "==", project_id)).get())
    batch_delete_docs(client.collection("survey_days").where(filter=FieldFilter("project_id", "==", project_id)).get())
    batch_delete_docs(client.collection("sections").where(filter=FieldFilter("project_id", "==", project_id)).get())

    # Update tolerance
    tolerance = data_dict.get("tolerance", 0.1)
    meta_docs = client.collection("project_metadata").where(filter=FieldFilter("project_id", "==", project_id)).limit(1).get()
    if meta_docs:
        meta_docs[0].reference.update({"tolerance": tolerance})
    else:
        meta_id = get_next_id("project_metadata")
        client.collection("project_metadata").document(str(meta_id)).set({
            "id": meta_id,
            "project_id": project_id,
            "tolerance": tolerance
        })

    # Import sections
    old_to_new_sec = {}
    sections = data_dict.get("sections", [])
    for sec in sections:
        old_id = sec.get("id")
        sec_dict = dict(sec)
        new_sec_id = get_next_id("sections")
        sec_dict["id"] = new_sec_id
        sec_dict["project_id"] = project_id
        client.collection("sections").document(str(new_sec_id)).set(sec_dict)
        old_to_new_sec[old_id] = new_sec_id

    # Import survey days
    old_to_new_day = {}
    survey_days = data_dict.get("survey_days", [])
    for day in survey_days:
        old_day_id = day.get("id")
        day_dict = dict(day)
        new_day_id = get_next_id("survey_days")
        day_dict["id"] = new_day_id
        day_dict["project_id"] = project_id
        client.collection("survey_days").document(str(new_day_id)).set(day_dict)
        old_to_new_day[old_day_id] = new_day_id

    # Import cracks
    cracks = data_dict.get("cracks", [])
    if cracks:
        new_crack_ids = get_next_ids("cracks", len(cracks))
        batch = client.batch()
        count = 0
        for i, crack in enumerate(cracks):
            c_dict = dict(crack)
            c_dict["id"] = new_crack_ids[i]
            c_dict["project_id"] = project_id
            c_dict["section_id"] = old_to_new_sec.get(c_dict.get("section_id"))
            c_dict["day_id"] = old_to_new_day.get(c_dict.get("day_id"))
            ref = client.collection("cracks").document(str(c_dict["id"]))
            batch.set(ref, c_dict)
            count += 1
            if count >= 450:
                batch.commit()
                batch = client.batch()
                count = 0
        if count > 0:
            batch.commit()

SUPER_ADMINS = ['samuel.alalade@ttu.edu', 'alaladesambluez@gmail.com']

def is_user_authorized(email: str) -> bool:
    if not email:
        return False
    clean = email.strip().lower()
    if clean in [sa.lower() for sa in SUPER_ADMINS]:
        return True
    client = get_db()
    doc = client.collection("authorized_users").document(clean).get()
    return doc.exists

def list_authorized_users() -> List[dict]:
    client = get_db()
    docs = client.collection("authorized_users").get()
    users = [d.to_dict() for d in docs]
    for sa in SUPER_ADMINS:
        if not any(u.get("email", "").lower() == sa.lower() for u in users):
            users.insert(0, {
                "id": sa.lower(),
                "email": sa,
                "role": "admin",
                "added_by": "system",
                "added_at": "Permanent Super Admin"
            })
    users.sort(key=lambda x: x.get("email", "").lower())
    return users

def add_authorized_user(email: str, role: str = "user", added_by: str = "admin") -> dict:
    clean = email.strip().lower()
    client = get_db()
    payload = {
        "id": clean,
        "email": clean,
        "role": role,
        "added_by": added_by,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    client.collection("authorized_users").document(clean).set(payload)
    return payload

def delete_authorized_user(email: str) -> bool:
    clean = email.strip().lower()
    if clean in [sa.lower() for sa in SUPER_ADMINS]:
        raise ValueError("Permanent Super Admins cannot be removed.")
    client = get_db()
    client.collection("authorized_users").document(clean).delete()
    return True

