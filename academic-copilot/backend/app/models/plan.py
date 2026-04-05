"""Academic plan models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PlannedCourse(BaseModel):
    course_id: str
    title: str = ""
    credits: int = 3
    is_prerequisite_for: list[str] = Field(default_factory=list)
    is_bottleneck: bool = False
    placement_reason: str = ""


class SemesterPlan(BaseModel):
    semester: str = Field(description="e.g. Fall 2026")
    courses: list[PlannedCourse] = Field(default_factory=list)
    total_credits: int = 0
    notes: str = ""


class Bottleneck(BaseModel):
    course_id: str
    title: str = ""
    blocks: list[str] = Field(default_factory=list, description="Courses that depend on this")
    depth: int = Field(default=0, description="Length of longest dependency chain")
    explanation: str = ""


class RiskFactor(BaseModel):
    description: str
    level: RiskLevel
    mitigation: str = ""


class GraduationPath(BaseModel):
    id: str
    name: str = Field(description="e.g. 'Standard Path', 'Accelerated Path'")
    semesters: list[SemesterPlan] = Field(default_factory=list)
    total_semesters: int = 0
    graduation_term: str = ""
    total_credits: int = 0
    risk_factors: list[RiskFactor] = Field(default_factory=list)
    bottlenecks: list[Bottleneck] = Field(default_factory=list)
    ap_credit_impact: APCreditImpact | None = None
    explanation: str = ""
    tradeoffs: str = ""


class APCreditImpact(BaseModel):
    credits_saved: int = 0
    courses_skipped: list[str] = Field(default_factory=list)
    semesters_saved: float = 0.0
    explanation: str = ""


class AcademicPlan(BaseModel):
    student_id: str
    recommended_path: GraduationPath
    alternative_paths: list[GraduationPath] = Field(default_factory=list)
    bottlenecks: list[Bottleneck] = Field(default_factory=list)
    ap_credit_impact: APCreditImpact | None = None
    risk_summary: str = ""
    explanation: str = ""


class WhatIfCandidate(BaseModel):
    course_id: str
    title: str = ""
    source: str = Field(description="in_progress | upcoming")
    semester: str = ""
    reason: str = ""


class RecoveryAction(BaseModel):
    title: str
    detail: str
    urgency: RiskLevel = RiskLevel.MEDIUM


class WhatIfAnalysis(BaseModel):
    question: str = ""
    scenario_type: str = "fail_course"
    target_course_id: str
    target_course_title: str = ""
    target_context: str = Field(description="in_progress | upcoming")
    baseline_graduation_term: str = ""
    scenario_graduation_term: str = ""
    delay_semesters: int = 0
    impacted_courses: list[str] = Field(default_factory=list)
    blocked_courses: list[str] = Field(default_factory=list)
    recovery_actions: list[RecoveryAction] = Field(default_factory=list)
    revised_path: GraduationPath
    explanation: str = ""
    confidence: str = "high"


# Rebuild forward refs
GraduationPath.model_rebuild()
WhatIfAnalysis.model_rebuild()
