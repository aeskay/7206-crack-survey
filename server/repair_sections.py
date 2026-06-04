"""
Repair script: checks project 1's sections against the backup JSON
and restores any that were lost due to the cross-project upsert bug.
Also reassigns orphaned cracks (section_id = None) back to their correct sections.
"""
import os
import sys
import json

server_dir = os.path.dirname(os.path.abspath(__file__))
if server_dir not in sys.path:
    sys.path.append(server_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(server_dir, ".env"))

from database import supabase

PROJECT_ID = 1

# The expected 6 sections for project 1 (from the backup)
EXPECTED_SECTIONS = [
    {"name": "After TCJ",    "start_station": 0,   "end_station": 158, "steel_ratio": 0.66, "project_id": PROJECT_ID},
    {"name": "Section 1",    "start_station": 158, "end_station": 331, "steel_ratio": 0.84, "project_id": PROJECT_ID},
    {"name": "Section 2",    "start_station": 331, "end_station": 509, "steel_ratio": 0.63, "project_id": PROJECT_ID},
    {"name": "Section 3",    "start_station": 509, "end_station": 676, "steel_ratio": 0.63, "project_id": PROJECT_ID},
    {"name": "TxDOT Section","start_station": 676, "end_station": 800, "steel_ratio": 0.66, "project_id": PROJECT_ID},
    {"name": "Before TCJ",   "start_station": 800, "end_station": 920, "steel_ratio": 0.66, "project_id": PROJECT_ID},
]

def main():
    print("=== Section Repair Tool ===\n")

    # 1. Fetch current sections for project 1
    res = supabase.table("sections").select("*").eq("project_id", PROJECT_ID).order("start_station").execute()
    current = res.data or []
    print(f"Current sections for project {PROJECT_ID}: {len(current)}")
    for s in current:
        print(f"  id={s['id']}  name={s['name']!r}  [{s['start_station']} -> {s['end_station']}]  ratio={s['steel_ratio']}")

    # 2. Determine which expected sections are missing (match by start_station)
    current_starts = {s["start_station"] for s in current}
    missing = [s for s in EXPECTED_SECTIONS if s["start_station"] not in current_starts]

    if not missing:
        print("\n[OK] All 6 sections are already present. No repair needed.")
    else:
        print(f"\n[!] Missing {len(missing)} section(s):")
        for s in missing:
            print(f"   {s['name']!r}  [{s['start_station']} -> {s['end_station']}]")

        print("\nInserting missing sections...")
        ins_res = supabase.table("sections").insert(missing).execute()
        if ins_res.data:
            print(f"[OK] Inserted {len(ins_res.data)} section(s):")
            for s in ins_res.data:
                print(f"   id={s['id']}  name={s['name']!r}")
        else:
            print("[ERR] Insert returned no data. Check Supabase logs.")
            return

    # 3. Re-fetch all sections and reassign orphaned cracks
    sec_res = supabase.table("sections").select("*").eq("project_id", PROJECT_ID).execute()
    all_sections = sec_res.data or []
    all_sections.sort(key=lambda s: s["start_station"])

    print(f"\n--- Reassigning orphaned cracks for project {PROJECT_ID} ---")
    orphan_res = supabase.table("cracks").select("*").eq("project_id", PROJECT_ID).is_("section_id", "null").execute()
    orphans = orphan_res.data or []

    # Also check cracks whose section_id points to a section belonging to another project
    all_cracks_res = supabase.table("cracks").select("*").eq("project_id", PROJECT_ID).execute()
    all_cracks = all_cracks_res.data or []
    valid_section_ids = {s["id"] for s in all_sections}

    wrong_section = [c for c in all_cracks if c["section_id"] is not None and c["section_id"] not in valid_section_ids]
    to_fix = orphans + wrong_section
    print(f"Cracks to fix: {len(to_fix)} (orphaned: {len(orphans)}, wrong section: {len(wrong_section)})")

    fixed = 0
    for crack in to_fix:
        dist = crack["distance"]
        new_sec_id = None
        for sec in all_sections:
            if sec["start_station"] <= dist < sec["end_station"]:
                new_sec_id = sec["id"]
                break
        supabase.table("cracks").update({"section_id": new_sec_id}).eq("id", crack["id"]).execute()
        fixed += 1

    print(f"[OK] Fixed {fixed} crack(s).")
    print("\n=== Repair complete ===")

if __name__ == "__main__":
    main()
