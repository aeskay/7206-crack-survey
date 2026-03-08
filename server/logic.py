import json
import os
from models import ProjectMetadata, Crack, Section, SurveyDay
from typing import List, Dict, Any, Optional
from database import supabase

def load_data(project_id: int) -> ProjectMetadata:
    meta_res = supabase.table("project_metadata").select("tolerance").eq("project_id", project_id).execute()
    tolerance = meta_res.data[0]["tolerance"] if meta_res.data else 0.1
    
    sec_res = supabase.table("sections").select("*").eq("project_id", project_id).execute()
    sections = [Section(**s) for s in sec_res.data]
    
    day_res = supabase.table("survey_days").select("*").eq("project_id", project_id).execute()
    survey_days_data = sorted(day_res.data, key=lambda x: x.get("order_index", 0))
    survey_days = [SurveyDay(**d) for d in survey_days_data]
    
    cracks_res = supabase.table("cracks").select("*").eq("project_id", project_id).execute()
    cracks = [Crack(**c) for c in cracks_res.data]
    
    return ProjectMetadata(sections=sections, survey_days=survey_days, cracks=cracks, tolerance=tolerance, project_id=project_id)

def save_data(data: ProjectMetadata):
    supabase.table("project_metadata").upsert([{"project_id": data.project_id, "tolerance": data.tolerance}], on_conflict="project_id").execute()

    # --- Sections: upsert kept ones, delete removed ones ---
    kept_section_ids = [s.id for s in data.sections if s.id is not None]
    if data.sections:
        sec_dicts = [json.loads(s.json()) for s in data.sections]
        supabase.table("sections").upsert(sec_dicts).execute()
    # Delete sections no longer in the list for this project
    existing_sec_res = supabase.table("sections").select("id").eq("project_id", data.project_id).execute()
    for row in existing_sec_res.data:
        if row["id"] not in kept_section_ids:
            supabase.table("cracks").update({"section_id": None}).eq("section_id", row["id"]).execute()
            supabase.table("sections").delete().eq("id", row["id"]).execute()

    # --- Survey Days: upsert ---
    if data.survey_days:
        day_dicts = [json.loads(d.json()) for d in data.survey_days]
        supabase.table("survey_days").upsert(day_dicts).execute()

    # --- Cracks: upsert updated, insert new ---
    cracks_to_insert = []
    cracks_to_update = []
    for c in data.cracks:
        cd = {"distance": c.distance, "day_id": c.day_id, "section_id": c.section_id, "project_id": data.project_id}
        if c.id is not None:
            cd["id"] = c.id
            cracks_to_update.append(cd)
        else:
            cracks_to_insert.append(cd)

    if cracks_to_update:
        supabase.table("cracks").upsert(cracks_to_update).execute()
    if cracks_to_insert:
        supabase.table("cracks").insert(cracks_to_insert).execute()

def get_section_for_distance(distance: float, sections: List[Section]) -> Optional[int]:
    for section in sections:
        if section.start_station <= distance < section.end_station:
            return section.id
def list_projects() -> List[dict]:
    res = supabase.table("projects").select("*").order("created_at", desc=True).execute()
    return res.data

def create_project(name: str) -> dict:
    print(f"DEBUG: create_project start for name='{name}'")
    try:
        # 1. Insert the project
        supabase.table("projects").insert({"name": name}).execute()
        print(f"DEBUG: Insert finished")
        
        # 2. Fetch the ID explicitly
        res = supabase.table("projects").select("*").eq("name", name).order("created_at", desc=True).limit(1).execute()
        print(f"DEBUG: Retrieval result data: {res.data}")
        
        if not res.data:
            print(f"DEBUG ERROR: Could not retrieve project '{name}' after insertion.")
            return {}
        
        new_project = res.data[0]
        print(f"DEBUG: new_project dictionary: {new_project}")
        
        p_id = new_project.get("id")
        print(f"DEBUG: extracted p_id: {p_id}")
        
        if p_id is None:
            print("DEBUG ERROR: p_id is None!")
            return {}

        # 3. Initialize metadata
        payload = {"project_id": p_id, "tolerance": 0.1}
        print(f"DEBUG: About to upsert metadata with payload: {payload}")
        meta_res = supabase.table("project_metadata").upsert(payload).execute()
        print(f"DEBUG: Metadata upsert finished. Data: {meta_res.data}")
        
        return new_project
    except Exception as e:
        print(f"DEBUG EXCEPTION in create_project: {e}")
        return {}

def update_project(project_id: int, name: str) -> dict:
    print(f"Updating project {project_id} to name: {name}")
    res = supabase.table("projects").update({"name": name}).eq("id", project_id).execute()
    print(f"Update result: {res.data}")
    return res.data[0] if res.data else {}

def delete_project(project_id: int):
    print(f"Deleting project: {project_id}")
    # Cascading deletes (Supabase should handle this if foreign keys are set to CASCADE, 
    # but we can do it explicitly for safety or if not configured)
    supabase.table("cracks").delete().eq("project_id", project_id).execute()
    supabase.table("survey_days").delete().eq("project_id", project_id).execute()
    supabase.table("sections").delete().eq("project_id", project_id).execute()
    supabase.table("project_metadata").delete().eq("project_id", project_id).execute()
    res = supabase.table("projects").delete().eq("id", project_id).execute()
    print(f"Delete result: {res.data}")

def duplicate_project(project_id: int) -> dict:
    # 1. Load original data
    projects_res = supabase.table("projects").select("*").eq("id", project_id).execute()
    if not projects_res.data:
        print(f"Error: Project {project_id} not found for duplication")
        return {}
    
    original_project = projects_res.data[0]
    data = load_data(project_id)
    
    # 2. Create new project
    new_name = f"{original_project['name']} (Copy)"
    new_project = create_project(new_name)
    new_id = new_project["id"]
    
    # 3. Copy Metadata
    supabase.table("project_metadata").upsert([{"project_id": new_id, "tolerance": data.tolerance}]).execute()
    
    # 4. Copy Sections
    old_to_new_sec = {}
    if data.sections:
        for sec in data.sections:
            old_id = sec.id
            sec_dict = json.loads(sec.json())
            sec_dict.pop("id", None)
            sec_dict["project_id"] = new_id
            res = supabase.table("sections").insert(sec_dict).execute()
            if res.data:
                old_to_new_sec[old_id] = res.data[0]["id"]

    # 5. Copy Survey Days
    old_to_new_day = {}
    if data.survey_days:
        for day in data.survey_days:
            old_day_id = day.id
            day_dict = json.loads(day.json())
            day_dict.pop("id", None)
            day_dict["project_id"] = new_id
            res = supabase.table("survey_days").insert(day_dict).execute()
            if res.data:
                old_to_new_day[old_day_id] = res.data[0]["id"]
    
    # 6. Copy Cracks
    if data.cracks:
        crack_dicts = []
        for crack in data.cracks:
            c_dict = json.loads(crack.json())
            c_dict.pop("id", None)
            c_dict["project_id"] = new_id
            c_dict["section_id"] = old_to_new_sec.get(c_dict["section_id"])
            c_dict["day_id"] = old_to_new_day.get(c_dict["day_id"])
            crack_dicts.append(c_dict)
        
        # Batch insert cracks (max 1000 at a time if needed, but here simple)
        if crack_dicts:
            supabase.table("cracks").insert(crack_dicts).execute()
            
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
