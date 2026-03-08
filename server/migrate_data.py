import json
import os
from database import supabase
from models import ProjectMetadata, Crack, Section, SurveyDay

DATA_FILE = "data_store.json"

def run_migration():
    print("Starting migration to Supabase...")
    
    # 1. Start clean to avoid duplicates during testing
    print("Clearing existing Supabase data...")
    supabase.table("cracks").delete().neq("id", -1).execute()
    supabase.table("survey_days").delete().neq("id", -1).execute()
    supabase.table("sections").delete().neq("id", -1).execute()
    supabase.table("project_metadata").delete().eq("id", 1).execute()

    if not os.path.exists(DATA_FILE):
        print("data_store.json not found, skipping migration.")
        return

    print("Loading data from data_store.json...")
    with open(DATA_FILE, "r") as f:
        data_dict = json.load(f)
        
    print("Inserting Project Metadata...")
    supabase.table("project_metadata").insert({
        "id": 1,
        "tolerance": data_dict.get("tolerance", 0.1)
    }).execute()
        
    print("Inserting Sections...")
    sections = data_dict.get("sections", [])
    if sections:
        supabase.table("sections").insert(sections).execute()
        
    print("Inserting Survey Days...")
    survey_days = data_dict.get("survey_days", [])
    if survey_days:
        # Convert date objects to strings if necessary, though dict should be fine
        supabase.table("survey_days").insert(survey_days).execute()
        
    print("Inserting Cracks...")
    cracks = data_dict.get("cracks", [])
    if cracks:
        # ensure no "id" is passed if the json doesn't have it, or let postgres assign it
        cracks_to_insert = []
        for crack in cracks:
             # Make sure we only insert valid fields
             cracks_to_insert.append({
                 "distance": crack["distance"],
                 "day_id": crack["day_id"],
                 "section_id": crack["section_id"]
             })
        supabase.table("cracks").insert(cracks_to_insert).execute()

    print("Migration complete!")

if __name__ == "__main__":
    run_migration()
