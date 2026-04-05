"""Degree requirement models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum


class RequirementStatus(str, Enum):
    FULFILLED = "fulfilled"
    PARTIALLY_FULFILLED = "partially_fulfilled"
    UNMET = "unmet"


class CourseOption(BaseModel):
    course_id: str
    title: str = ""
    credits: int = 3


class Requirement(BaseModel):
    id: str
    name: str
    category: str = Field(description="major_core | major_elective | math | science | general_studies | free_elective")
    description: str = ""
    credits_required: int = 0
    courses_required: list[CourseOption] = Field(default_factory=list, description="Specific courses that satisfy this")
    min_courses: int = 0
    pick_n: int = 0
    pick_from: list[CourseOption] = Field(default_factory=list, description="Choose N from this list")
    status: RequirementStatus = RequirementStatus.UNMET
    credits_applied: int = 0
    courses_applied: list[str] = Field(default_factory=list)
    notes: str = ""


class RequirementCategory(BaseModel):
    name: str
    display_name: str
    credits_required: int
    credits_fulfilled: int = 0
    requirements: list[Requirement] = Field(default_factory=list)

    @property
    def progress_pct(self) -> float:
        if self.credits_required == 0:
            return 100.0
        return min(100.0, round(self.credits_fulfilled / self.credits_required * 100, 1))


class DegreeRequirements(BaseModel):
    university: str = "Arizona State University"
    major: str = ""
    major_code: str = ""
    degree: str = "BS"
    catalog_year: str = "2024-2025"
    total_credits_required: int = 120
    minimum_gpa: float = 2.0
    residency_credits: int = 30
    upper_division_credits: int = 45
    categories: list[RequirementCategory] = Field(default_factory=list)
    data_source: str = ""
    data_source_url: str = ""
    notes: list[str] = Field(default_factory=list)


class DegreeAudit(BaseModel):
    student_id: str
    degree_requirements: DegreeRequirements
    total_credits_completed: int = 0
    total_credits_remaining: int = 0
    overall_progress_pct: float = 0.0
    categories: list[RequirementCategory] = Field(default_factory=list)
    fulfilled_count: int = 0
    partial_count: int = 0
    unmet_count: int = 0
    explanations: list[AuditExplanation] = Field(default_factory=list)


class AuditExplanation(BaseModel):
    requirement_id: str
    requirement_name: str
    status: RequirementStatus
    reasoning: str
    confidence: str = Field(default="high", description="high | medium | low")
    source_used: str = ""
    needs_advisor_review: bool = False


# Rebuild to resolve forward reference
DegreeAudit.model_rebuild()
