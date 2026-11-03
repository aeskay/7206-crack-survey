import logic

def test():
    try:
        projects = logic.list_projects()
        print(f"Successfully connected to Firestore!")
        print(f"Found {len(projects)} projects:")
        for p in projects:
            print(f"  - Project {p.get('id')}: {p.get('name')}")
            data = logic.load_data(p.get("id"))
            print(f"    Sections: {len(data.sections)}")
            print(f"    Survey Days: {len(data.survey_days)}")
            print(f"    Cracks: {len(data.cracks)}")
            print(f"    Tolerance: {data.tolerance}")
    except Exception as e:
        print(f"Error testing Firestore integration:\n{e}")

if __name__ == "__main__":
    test()
