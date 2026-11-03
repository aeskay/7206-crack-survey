import os
import sys
import csv
import json

server_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(server_dir)
if server_dir not in sys.path:
    sys.path.append(server_dir)

from database import init_firestore

def parse_int(val, default=None):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default

def parse_float(val, default=None):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def import_csv_to_firestore():
    csv_dir = os.path.join(root_dir, "supabase files")
    if not os.path.exists(csv_dir):
        print(f"Error: Could not find CSV folder at '{csv_dir}'")
        return

    print("Connecting to Firestore...")
    try:
        db = init_firestore()
    except Exception as e:
        print(f"\n[ERROR] Unable to connect to Firestore:\n{e}\n")
        return

    # 1. Projects
    projects_csv = os.path.join(csv_dir, "projects_rows.csv")
    if os.path.exists(projects_csv):
        print("\n--- Importing Projects ---")
        with open(projects_csv, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                p_id = parse_int(row.get("id"))
                if p_id is None:
                    continue
                data = {
                    "id": p_id,
                    "name": row.get("name", "").strip(),
                    "created_at": row.get("created_at", "").strip()
                }
                db.collection("projects").document(str(p_id)).set(data)
                count += 1
                print(f"  [Project] ID={p_id}: {data['name']}")
        print(f"Finished projects: {count} imported.")

    # 2. Project Metadata
    meta_csv = os.path.join(csv_dir, "project_metadata_rows.csv")
    if os.path.exists(meta_csv):
        print("\n--- Importing Project Metadata ---")
        with open(meta_csv, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                m_id = parse_int(row.get("id"))
                p_id = parse_int(row.get("project_id"))
                tol = parse_float(row.get("tolerance"), 0.1)
                data = {
                    "id": m_id,
                    "project_id": p_id,
                    "tolerance": tol
                }
                db.collection("project_metadata").document(str(m_id)).set(data)
                count += 1
                print(f"  [Metadata] ID={m_id}: project_id={p_id}, tolerance={tol}")
        print(f"Finished metadata: {count} imported.")

    # 3. Sections
    sections_csv = os.path.join(csv_dir, "sections_rows.csv")
    if os.path.exists(sections_csv):
        print("\n--- Importing Sections ---")
        with open(sections_csv, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                s_id = parse_int(row.get("id"))
                if s_id is None:
                    continue
                data = {
                    "id": s_id,
                    "name": row.get("name", "").strip(),
                    "start_station": parse_float(row.get("start_station"), 0.0),
                    "end_station": parse_float(row.get("end_station"), 0.0),
                    "project_id": parse_int(row.get("project_id")),
                    "steel_ratio": parse_float(row.get("steel_ratio"), 0.0),
                    "color": row.get("color", "#2563eb").strip()
                }
                db.collection("sections").document(str(s_id)).set(data)
                count += 1
                print(f"  [Section] ID={s_id} ({data['name']}) -> Project {data['project_id']}")
        print(f"Finished sections: {count} imported.")

    # 4. Survey Days
    days_csv = os.path.join(csv_dir, "survey_days_rows.csv")
    if os.path.exists(days_csv):
        print("\n--- Importing Survey Days ---")
        with open(days_csv, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                d_id = parse_int(row.get("id"))
                if d_id is None:
                    continue
                data = {
                    "id": d_id,
                    "name": row.get("name", "").strip(),
                    "date": row.get("date", "").strip(),
                    "color": row.get("color", "#000000").strip(),
                    "order_index": parse_int(row.get("order_index"), 0),
                    "project_id": parse_int(row.get("project_id"))
                }
                db.collection("survey_days").document(str(d_id)).set(data)
                count += 1
                print(f"  [Survey Day] ID={d_id} ({data['name']}) -> Project {data['project_id']}")
        print(f"Finished survey days: {count} imported.")

    # 5. Cracks
    cracks_csv = os.path.join(csv_dir, "cracks_rows.csv")
    if os.path.exists(cracks_csv):
        print("\n--- Importing Cracks ---")
        with open(cracks_csv, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            batch = db.batch()
            batch_count = 0
            total_cracks = 0
            for row in reader:
                c_id = parse_int(row.get("id"))
                if c_id is None:
                    continue
                sec_id = parse_int(row.get("section_id"))
                data = {
                    "id": c_id,
                    "distance": parse_float(row.get("distance"), 0.0),
                    "day_id": parse_int(row.get("day_id")),
                    "section_id": sec_id,
                    "project_id": parse_int(row.get("project_id"))
                }
                ref = db.collection("cracks").document(str(c_id))
                batch.set(ref, data)
                batch_count += 1
                total_cracks += 1
                if batch_count >= 450:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
                    print(f"  Committed batch of cracks (Total so far: {total_cracks})")
            if batch_count > 0:
                batch.commit()
                print(f"  Committed final batch of cracks (Total: {total_cracks})")
        print(f"Finished cracks: {total_cracks} imported.")

    print("\n=======================================================")
    print("All Supabase CSV data successfully imported to Firestore!")
    print("=======================================================\n")

if __name__ == "__main__":
    import_csv_to_firestore()
