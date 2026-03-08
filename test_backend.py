import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'server'))

from server import logic
from server.database import supabase

def test_supabase():
    print("Testing Supabase connection...")
    try:
        res = supabase.table("projects").select("count", count="exact").execute()
        print(f"Projects count: {res.count}")
    except Exception as e:
        print(f"Supabase connection failed: {e}")

def test_project_lifecycle():
    print("\nTesting Project Lifecycle...")
    try:
        name = "Temporary Test Project"
        
        # Cleanup any existing test projects with this name first
        existing = supabase.table("projects").select("id").eq("name", name).execute()
        for p in existing.data:
            print(f"Cleaning up old test project: {p['id']}")
            logic.delete_project(p["id"])

        # Create
        new_project = logic.create_project(name)
        print(f"Created result: {new_project}")
        p_id = new_project.get("id")
        
        if not p_id:
            print("FAILED: Could not create project or get ID")
            return
        
        print(f"SUCCESS: Project created with ID {p_id}")

        # Update
        updated_name = "Updated Test Project"
        updated_project = logic.update_project(p_id, updated_name)
        print(f"Updated: {updated_project}")

        # Duplicate
        duplicated_project = logic.duplicate_project(p_id)
        print(f"Duplicated: {duplicated_project}")
        dp_id = duplicated_project.get("id")

        # Delete both
        logic.delete_project(p_id)
        print(f"Deleted original: {p_id}")
        
        if dp_id:
            logic.delete_project(dp_id)
            print(f"Deleted duplicate: {dp_id}")

    except Exception as e:
        print(f"Lifecycle test failed: {e}")

if __name__ == "__main__":
    test_supabase()
    test_project_lifecycle()
