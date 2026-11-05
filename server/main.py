import os
import sys
import json

# Ensure the server directory is in the path for imports
server_dir = os.path.dirname(os.path.abspath(__file__))
if server_dir not in sys.path:
    sys.path.append(server_dir)

from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from google.cloud.firestore import FieldFilter
import logic
from models import Section, SurveyDay, Crack, ProjectMetadata
from database import db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"CRITICAL ERROR: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/health")
def health():
    return {"status": "ok", "version": "multi-project-v3-firestore"}

@app.get("/projects")
def get_projects():
    return logic.list_projects()

@app.post("/projects")
def create_project(name: str = Body(..., embed=True)):
    return logic.create_project(name)

@app.put("/projects/{project_id}")
def update_project(project_id: int, name: str = Body(..., embed=True)):
    return logic.update_project(project_id, name)

@app.delete("/projects/{project_id}")
def delete_project(project_id: int):
    logic.delete_project(project_id)
    return {"status": "success"}

@app.post("/projects/{project_id}/duplicate")
def duplicate_project(project_id: int):
    return logic.duplicate_project(project_id)

@app.get("/projects/{project_id}/data", response_model=ProjectMetadata)
def get_data(project_id: int):
    return logic.load_data(project_id)

@app.post("/projects/{project_id}/sections")
def update_sections(project_id: int, sections: List[Section]):
    try:
        client = logic.get_db()
        new_sec_dicts = []
        update_sec_dicts = []

        for s in sections:
            d = json.loads(s.json())
            d["project_id"] = project_id
            sec_id = d.get("id")
            if sec_id is None or (isinstance(sec_id, int) and sec_id < 0):
                d.pop("id", None)
                new_sec_dicts.append(d)
            else:
                doc = client.collection("sections").document(str(sec_id)).get()
                if doc.exists and doc.to_dict().get("project_id") == project_id:
                    update_sec_dicts.append(d)
                else:
                    d.pop("id", None)
                    new_sec_dicts.append(d)

        saved_ids = []

        # INSERT brand-new sections
        for d in new_sec_dicts:
            new_id = logic.get_next_id("sections")
            d["id"] = new_id
            client.collection("sections").document(str(new_id)).set(d)
            saved_ids.append(new_id)

        # UPDATE existing sections
        for d in update_sec_dicts:
            s_id = d["id"]
            payload = {
                "id": s_id,
                "project_id": project_id,
                "name": d["name"],
                "start_station": d["start_station"],
                "end_station": d["end_station"],
                "steel_ratio": d.get("steel_ratio", 0.0),
                "color": d.get("color", "#2563eb"),
            }
            client.collection("sections").document(str(s_id)).set(payload, merge=True)
            saved_ids.append(s_id)

        # Delete sections removed by the user (only for THIS project)
        existing_secs = client.collection("sections").where(filter=FieldFilter("project_id", "==", project_id)).get()
        for row in existing_secs:
            r_data = row.to_dict()
            sec_id = r_data.get("id")
            if sec_id not in saved_ids:
                # Update cracks to remove section_id
                cracks_to_orphan = client.collection("cracks").where(filter=FieldFilter("section_id", "==", sec_id)).where(filter=FieldFilter("project_id", "==", project_id)).get()
                for c in cracks_to_orphan:
                    c.reference.update({"section_id": None})
                row.reference.delete()

        # Re-assign crack section_ids based on updated section boundaries
        updated_sec_docs = client.collection("sections").where(filter=FieldFilter("project_id", "==", project_id)).get()
        updated_sections = [Section(**s.to_dict()) for s in updated_sec_docs]

        crack_docs = client.collection("cracks").where(filter=FieldFilter("project_id", "==", project_id)).get()
        batch = client.batch()
        batch_count = 0
        for crack_doc in crack_docs:
            c_data = crack_doc.to_dict()
            new_sec = logic.get_section_for_distance(c_data["distance"], updated_sections)
            if new_sec != c_data.get("section_id"):
                batch.update(crack_doc.reference, {"section_id": new_sec})
                batch_count += 1
                if batch_count >= 450:
                    batch.commit()
                    batch = client.batch()
                    batch_count = 0
        if batch_count > 0:
            batch.commit()

        return {"status": "success"}
    except Exception as e:
        print(f"ERROR in update_sections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/survey-days")
def add_survey_day(project_id: int, day: SurveyDay):
    client = logic.get_db()
    next_id = logic.get_next_id("survey_days")
    payload = {
        "id": next_id,
        "name": day.name,
        "date": str(day.date),
        "color": day.color,
        "order_index": day.order_index,
        "project_id": project_id
    }
    client.collection("survey_days").document(str(next_id)).set(payload)
    return payload

@app.delete("/projects/{project_id}/survey-days/{day_id}")
def delete_survey_day(project_id: int, day_id: int):
    client = logic.get_db()
    # Delete associated cracks first
    cracks = client.collection("cracks").where(filter=FieldFilter("day_id", "==", day_id)).where(filter=FieldFilter("project_id", "==", project_id)).get()
    logic.batch_delete_docs(cracks)

    # Delete the day
    doc_ref = client.collection("survey_days").document(str(day_id))
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Survey day not found")
    doc_ref.delete()
    return {"status": "deleted"}

@app.post("/projects/{project_id}/survey-days/reorder")
def reorder_survey_days(project_id: int, day_ids: List[int] = Body(...)):
    client = logic.get_db()
    for index, d_id in enumerate(day_ids):
        doc_ref = client.collection("survey_days").document(str(d_id))
        doc_ref.set({"order_index": index}, merge=True)
    return {"status": "success"}

@app.put("/projects/{project_id}/survey-days/{day_id}")
def update_survey_day(project_id: int, day_id: int, day: SurveyDay):
    client = logic.get_db()
    doc_ref = client.collection("survey_days").document(str(day_id))
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Survey day not found")

    payload = {
        "name": day.name,
        "date": str(day.date),
        "color": day.color,
        "order_index": day.order_index
    }
    doc_ref.set(payload, merge=True)
    return {"status": "updated"}

@app.post("/projects/{project_id}/upload-cracks")
def upload_cracks(project_id: int, day_id: int, distances: List[float]):
    client = logic.get_db()
    data = logic.load_data(project_id)
    conflicts = logic.detect_conflicts(distances, day_id, data.tolerance, data.cracks)

    conflict_distances = {c["new_distance"] for c in conflicts}
    non_conflicting = [d for d in distances if d not in conflict_distances]

    # Insert non-conflicting cracks directly into Firestore
    if non_conflicting:
        new_ids = logic.get_next_ids("cracks", len(non_conflicting))
        batch = client.batch()
        batch_count = 0
        for i, dist in enumerate(non_conflicting):
            sec_id = logic.get_section_for_distance(dist, data.sections)
            c_id = new_ids[i]
            row = {
                "id": c_id,
                "distance": dist,
                "day_id": day_id,
                "section_id": sec_id,
                "project_id": project_id
            }
            ref = client.collection("cracks").document(str(c_id))
            batch.set(ref, row)
            batch_count += 1
            if batch_count >= 450:
                batch.commit()
                batch = client.batch()
                batch_count = 0
        if batch_count > 0:
            batch.commit()

    if conflicts:
        return {"status": "conflict", "conflicts": conflicts, "added": len(non_conflicting)}

    return {"status": "success", "added": len(non_conflicting)}

@app.post("/projects/{project_id}/resolve-conflicts")
def resolve_conflicts(project_id: int, resolutions: List[Dict[str, Any]]):
    data = logic.load_data(project_id)
    for res in resolutions:
        if res["type"] == "keep":
            sec_id = logic.get_section_for_distance(res["new_distance"], data.sections)
            data.cracks.append(Crack(distance=res["new_distance"], day_id=res["day_id"], section_id=sec_id, project_id=project_id))
        elif res["type"] == "merge":
            pass
    logic.save_data(data)
    return {"status": "success"}

@app.delete("/projects/{project_id}/cracks/{crack_id}")
def delete_crack(project_id: int, crack_id: int):
    client = logic.get_db()
    client.collection("cracks").document(str(crack_id)).delete()
    return {"status": "deleted"}

@app.post("/projects/{project_id}/cracks/bulk-delete")
def bulk_delete_cracks(project_id: int, crack_ids: List[int]):
    if not crack_ids:
        return {"status": "deleted", "count": 0}
    client = logic.get_db()
    refs = [client.collection("cracks").document(str(cid)) for cid in crack_ids]
    logic.batch_delete_docs(refs)
    return {"status": "deleted", "count": len(crack_ids)}

@app.put("/projects/{project_id}/cracks/{crack_id}")
def update_crack(project_id: int, crack_id: int, distance: float):
    client = logic.get_db()
    data = logic.load_data(project_id)
    section_id = logic.get_section_for_distance(distance, data.sections)
    client.collection("cracks").document(str(crack_id)).set({
        "distance": distance,
        "section_id": section_id
    }, merge=True)
    return {"status": "updated"}

@app.get("/projects/{project_id}/export")
def export_project(project_id: int):
    return logic.export_project(project_id)

@app.post("/projects/{project_id}/import")
def import_project(project_id: int, data: dict = Body(...)):
    logic.import_project(project_id, data)
    return {"status": "success"}

@app.get("/users")
def get_users():
    return logic.list_authorized_users()

@app.post("/users")
def add_user(email: str = Body(...), role: str = Body("user"), added_by: str = Body("admin")):
    return logic.add_authorized_user(email, role, added_by)

@app.delete("/users/{email}")
def delete_user(email: str):
    try:
        logic.delete_authorized_user(email)
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, app_dir=server_dir)
