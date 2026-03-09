from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class Project(BaseModel):
    id: Optional[int] = None
    name: str
    created_at: Optional[str] = None

class Section(BaseModel):
    id: Optional[int] = None
    name: str
    start_station: float
    end_station: float
    steel_ratio: float = 0.0
    project_id: Optional[int] = None

class Crack(BaseModel):
    id: Optional[int] = None
    distance: float
    day_id: int
    section_id: Optional[int] = None
    project_id: int

class SurveyDay(BaseModel):
    id: Optional[int] = None
    name: str # e.g., "Day 7"
    date: date
    color: str # hex color code
    order_index: int = 0
    project_id: Optional[int] = None

class ProjectMetadata(BaseModel):
    sections: List[Section] = []
    survey_days: List[SurveyDay] = []
    cracks: List[Crack] = []
    tolerance: float = 0.1 # ft
    project_id: int
