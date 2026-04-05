"""Course and section models."""
from __future__ import annotations
from pydantic import BaseModel, Field


class CoursePrerequisite(BaseModel):
    course_id: str
    can_be_concurrent: bool = False
    min_grade: str = "D"


class Course(BaseModel):
    course_id: str = Field(description="e.g. CSE 310")
    title: str = ""
    credits: int = 3
    description: str = ""
    prerequisites: list[CoursePrerequisite] = Field(default_factory=list)
    corequisites: list[str] = Field(default_factory=list)
    typically_offered: list[str] = Field(default_factory=list, description="e.g. ['Fall', 'Spring']")
    is_upper_division: bool = False


class MeetingTime(BaseModel):
    days: list[str] = Field(description="e.g. ['Mon', 'Wed', 'Fri']")
    start_time: str = Field(description="e.g. 09:00")
    end_time: str = Field(description="e.g. 09:50")
    location: str = ""
    building: str = ""
    room: str = ""
    campus: str = "Tempe"


class Section(BaseModel):
    section_id: str
    course_id: str
    title: str = ""
    credits: int = 3
    instructor: str = ""
    instructor_rating: float | None = None
    instructor_rating_source: str = ""
    modality: str = "in_person"
    meeting_times: list[MeetingTime] = Field(default_factory=list)
    seats_total: int = 40
    seats_available: int = 10
    semester: str = ""
    notes: str = ""


class SectionWithScore(BaseModel):
    section: Section
    score: float = 0.0
    time_score: float = 0.0
    day_score: float = 0.0
    modality_score: float = 0.0
    compactness_score: float = 0.0
    instructor_score: float = 0.0
    commute_minutes: float | None = None
    explanation: str = ""
