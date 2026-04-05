"""Schedule and calendar models."""
from __future__ import annotations
from pydantic import BaseModel, Field


class TravelWarning(BaseModel):
    day: str
    from_course_id: str
    to_course_id: str
    gap_minutes: float
    required_minutes: float
    message: str


class ScheduleScoreBreakdown(BaseModel):
    section_average: float = 0.0
    compactness: float = 0.0
    travel_feasibility: float = 0.0
    professor_quality: float = 0.0
    preference_alignment: float = 0.0


class ScheduleEntry(BaseModel):
    section: "SectionWithScore"
    commute_before_minutes: float = 0.0
    commute_after_minutes: float = 0.0


class ProposedSchedule(BaseModel):
    id: str
    name: str = Field(description="e.g. 'Best Overall', 'Most Compact'")
    semester: str
    entries: list[ScheduleEntry] = Field(default_factory=list)
    total_credits: int = 0
    overall_score: float = 0.0
    weekly_commute_minutes: float = 0.0
    score_breakdown: ScheduleScoreBreakdown = Field(default_factory=ScheduleScoreBreakdown)
    travel_warnings: list[TravelWarning] = Field(default_factory=list)
    explanation: str = ""
    tradeoffs: str = ""


class CalendarEvent(BaseModel):
    summary: str
    description: str = ""
    location: str = ""
    start_datetime: str = ""
    end_datetime: str = ""
    recurrence: list[str] = Field(default_factory=list)
    color_id: str = ""
    is_commute_block: bool = False


class CalendarExportRequest(BaseModel):
    schedule_id: str
    events: list[CalendarEvent] = Field(default_factory=list)
    include_commute_blocks: bool = True
    calendar_id: str = "primary"


class CalendarExportResult(BaseModel):
    success: bool
    events_created: int = 0
    event_ids: list[str] = Field(default_factory=list)
    calendar_url: str = ""
    message: str = ""


# Import here to avoid circular
from .course import SectionWithScore  # noqa: E402
ScheduleEntry.model_rebuild()
