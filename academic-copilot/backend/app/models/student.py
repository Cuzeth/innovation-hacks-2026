"""Student profile and preference models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum


class Modality(str, Enum):
    IN_PERSON = "in_person"
    ONLINE = "online"
    HYBRID = "hybrid"
    ANY = "any"


class ScheduleStyle(str, Enum):
    COMPACT = "compact"
    SPREAD = "spread"
    ANY = "any"


class CompletedCourse(BaseModel):
    course_id: str = Field(description="e.g. CSE 110")
    title: str = ""
    credits: int = 3
    grade: str = ""
    semester: str = Field(default="", description="e.g. Fall 2024")
    source: str = Field(default="asu", description="asu | ap | transfer | test")
    transfer_institution: str = ""


class StudentPreferences(BaseModel):
    max_credits_per_semester: int = 16
    min_credits_per_semester: int = 12
    preferred_start_time: str = "09:00"
    preferred_end_time: str = "17:00"
    avoid_days: list[str] = Field(default_factory=list, description="e.g. ['Friday']")
    schedule_style: ScheduleStyle = ScheduleStyle.COMPACT
    modality: Modality = Modality.ANY
    include_summer: bool = False
    target_graduation: str = Field(default="Spring 2027", description="e.g. Spring 2027")
    home_address: str = ""
    campus: str = "Tempe"
    min_professor_rating: float = 0.0
    part_time: bool = False
    internship_semesters: list[str] = Field(default_factory=list)


class StudentProfile(BaseModel):
    id: str = "demo-student"
    name: str = ""
    email: str = ""
    university: str = "Arizona State University"
    major: str = ""
    major_code: str = ""
    catalog_year: str = "2024-2025"
    current_semester: str = "Fall 2026"
    completed_courses: list[CompletedCourse] = Field(default_factory=list)
    preferences: StudentPreferences = Field(default_factory=StudentPreferences)
    total_credits_completed: int = 0

    def compute_credits(self) -> int:
        self.total_credits_completed = sum(c.credits for c in self.completed_courses)
        return self.total_credits_completed
