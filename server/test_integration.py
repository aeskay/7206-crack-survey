import logic

def test():
    try:
        data = logic.load_data()
        print("Successfully loaded data from Supabase!")
        print(f"Loaded {len(data.sections)} sections")
        print(f"Loaded {len(data.survey_days)} survey days")
        print(f"Loaded {len(data.cracks)} cracks")
        print(f"Tolerance: {data.tolerance}")
    except Exception as e:
        print(f"Error testing backend integration:\n{e}")

if __name__ == "__main__":
    test()
