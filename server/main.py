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
import logic
from models import Section, SurveyDay, Crack, ProjectMetadata
from database import supabase

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
    return {"status": "ok", "version": "multi-project-v3"}

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
        # Split sections into new (no id / negative id) vs existing (positive id owned by this project)
        new_sec_dicts = []
        update_sec_dicts = []

        for s in sections:
            d = json.loads(s.json())
            d["project_id"] = project_id
            sec_id = d.get("id")
            if sec_id is None or (isinstance(sec_id, int) and sec_id < 0):
                # Brand-new section – strip temp id so DB auto-assigns a fresh id
                d.pop("id", None)
                new_sec_dicts.append(d)
            else:
                # Existing section – only update if it actually belongs to this project
                # (guards against id collisions from manual migrations)
                ownership_res = supabase.table("sections").select("id").eq("id", sec_id).eq("project_id", project_id).execute()
                if ownership_res.data:
                    update_sec_dicts.append(d)
                else:
                    # id exists but belongs to a different project – treat as new
                    print(f"WARNING: section id={sec_id} does not belong to project {project_id}; inserting as new.")
                    d.pop("id", None)
                    new_sec_dicts.append(d)

        saved_ids = []

        # INSERT brand-new sections
        if new_sec_dicts:
            ins_result = supabase.table("sections").insert(new_sec_dicts).execute()
            if ins_result.data:
                saved_ids.extend(row["id"] for row in ins_result.data)

        # UPDATE existing sections one-by-one (safe – always scoped to this project)
        for d in update_sec_dicts:
            upd_result = supabase.table("sections").update({
                "name": d["name"],
                "start_station": d["start_station"],
                "end_station": d["end_station"],
                "steel_ratio": d.get("steel_ratio", 0.0),
                "color": d.get("color", "#2563eb"),
            }).eq("id", d["id"]).eq("project_id", project_id).execute()
            if upd_result.data:
                saved_ids.append(upd_result.data[0]["id"])
            else:
                # Row was missing – fall back to insert
                d_copy = dict(d)
                d_copy.pop("id", None)
                fb_result = supabase.table("sections").insert(d_copy).execute()
                if fb_result.data:
                    saved_ids.append(fb_result.data[0]["id"])

        # Delete sections removed by the user (only for THIS project)
        existing_res = supabase.table("sections").select("id").eq("project_id", project_id).execute()
        existing_data = existing_res.data or []
        for row in existing_data:
            if row["id"] not in saved_ids:
                supabase.table("cracks").update({"section_id": None}).eq("section_id", row["id"]).eq("project_id", project_id).execute()
                supabase.table("sections").delete().eq("id", row["id"]).eq("project_id", project_id).execute()

        # Re-assign crack section_ids based on updated section boundaries
        updated_sec_res = supabase.table("sections").select("*").eq("project_id", project_id).execute()
        updated_sec_data = updated_sec_res.data or []
        updated_sections = [Section(**row) for row in updated_sec_data]

        cracks_res = supabase.table("cracks").select("*").eq("project_id", project_id).execute()
        for crack in (cracks_res.data or []):
            new_sec = logic.get_section_for_distance(crack["distance"], updated_sections)
            supabase.table("cracks").update({"section_id": new_sec}).eq("id", crack["id"]).execute()

        return {"status": "success"}
    except Exception as e:
        print(f"ERROR in update_sections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/survey-days")
def add_survey_day(project_id: int, day: SurveyDay):
    # Fetch current max ID to avoid sequence issues
    res = supabase.table("survey_days").select("id").order("id", desc=True).limit(1).execute()
    max_id = res.data[0]["id"] if res.data else 0
    
    # Adaptive ID assignment: try max_id + 1, then increment if collision occurs
    next_id = max_id + 1
    for _ in range(10): # retry a few times if there are sparse higher IDs
        try:
            payload = {
                "id": next_id,
                "name": day.name,
                "date": str(day.date),
                "color": day.color,
                "order_index": day.order_index,
                "project_id": project_id
            }
            result = supabase.table("survey_days").insert(payload).execute()
            if result.data:
                return result.data[0]
            break
        except Exception as e:
            if "duplicate key" in str(e).lower():
                next_id += 1
                continue
            raise e
            
    raise HTTPException(status_code=500, detail="Could not generate a unique ID for Survey Day")

@app.delete("/projects/{project_id}/survey-days/{day_id}")
def delete_survey_day(project_id: int, day_id: int):
    # Delete associated cracks first
    supabase.table("cracks").delete().eq("day_id", day_id).eq("project_id", project_id).execute()
    # Delete the day
    result = supabase.table("survey_days").delete().eq("id", day_id).eq("project_id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Survey day not found")
    return {"status": "deleted"}

@app.post("/projects/{project_id}/survey-days/reorder")
def reorder_survey_days(project_id: int, day_ids: List[int] = Body(...)):
    # Expects a list of day_ids in their new visual order
    for index, d_id in enumerate(day_ids):
        supabase.table("survey_days").update({"order_index": index}).eq("id", d_id).eq("project_id", project_id).execute()
    return {"status": "success"}

@app.put("/projects/{project_id}/survey-days/{day_id}")
def update_survey_day(project_id: int, day_id: int, day: SurveyDay):
    result = supabase.table("survey_days").update({
        "name": day.name,
        "date": str(day.date),
        "color": day.color,
        "order_index": day.order_index
    }).eq("id", day_id).eq("project_id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Survey day not found")
    return {"status": "updated"}

@app.post("/projects/{project_id}/upload-cracks")
def upload_cracks(project_id: int, day_id: int, distances: List[float]):
    data = logic.load_data(project_id)
    conflicts = logic.detect_conflicts(distances, day_id, data.tolerance, data.cracks)

    conflict_distances = {c["new_distance"] for c in conflicts}
    non_conflicting = [d for d in distances if d not in conflict_distances]

    # Insert non-conflicting cracks directly into Supabase right away
    if non_conflicting:
        rows = []
        for dist in non_conflicting:
            sec_id = logic.get_section_for_distance(dist, data.sections)
            rows.append({"distance": dist, "day_id": day_id, "section_id": sec_id, "project_id": project_id})
        supabase.table("cracks").insert(rows).execute()

    if conflicts:
        return {"status": "conflict", "conflicts": conflicts, "added": len(non_conflicting)}

    return {"status": "success", "added": len(non_conflicting)}

@app.post("/projects/{project_id}/resolve-conflicts")
def resolve_conflicts(project_id: int, resolutions: List[Dict[str, Any]]):
    # resolutions item: {"type": "keep/merge/discard", "new_distance": ..., "existing_id": ..., "day_id": ...}
    data = logic.load_data(project_id)
    # Simplified resolution logic for now
    for res in resolutions:
        if res["type"] == "keep":
            sec_id = logic.get_section_for_distance(res["new_distance"], data.sections)
            data.cracks.append(Crack(distance=res["new_distance"], day_id=res["day_id"], section_id=sec_id, project_id=project_id))
        elif res["type"] == "merge":
            # Update existing crack distance if needed? Or just keep existing.
            pass
        # discard does nothing
    
    logic.save_data(data)
    return {"status": "success"}

@app.delete("/projects/{project_id}/cracks/{crack_id}")
def delete_crack(project_id: int, crack_id: int):
    supabase.table("cracks").delete().eq("id", crack_id).eq("project_id", project_id).execute()
    return {"status": "deleted"}

@app.post("/projects/{project_id}/cracks/bulk-delete")
def bulk_delete_cracks(project_id: int, crack_ids: List[int]):
    if not crack_ids:
        return {"status": "deleted", "count": 0}
    supabase.table("cracks").delete().in_("id", crack_ids).eq("project_id", project_id).execute()
    return {"status": "deleted", "count": len(crack_ids)}

@app.put("/projects/{project_id}/cracks/{crack_id}")
def update_crack(project_id: int, crack_id: int, distance: float):
    data = logic.load_data(project_id)
    section_id = logic.get_section_for_distance(distance, data.sections)
    supabase.table("cracks").update({
        "distance": distance,
        "section_id": section_id
    }).eq("id", crack_id).eq("project_id", project_id).execute()
    return {"status": "updated"}

@app.get("/projects/{project_id}/export")
def export_project(project_id: int):
    return logic.export_project(project_id)

@app.post("/projects/{project_id}/import")
def import_project(project_id: int, data: dict = Body(...)):
    logic.import_project(project_id, data)
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    # Using string path and app_dir to allow reload=True working correctly from any CWD
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True, app_dir=server_dir)
