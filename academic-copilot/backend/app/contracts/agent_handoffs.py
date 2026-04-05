"""Typed JSON schemas for agent handoffs and persisted workflow state."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.degree import DegreeAudit, DegreeRequirements
from app.models.plan import AcademicPlan, SemesterPlan
from app.models.schedule import CalendarExportResult, ProposedSchedule
from app.models.student import StudentProfile


class RequirementsRetrievalOutput(BaseModel):
    requirements: DegreeRequirements
    source_summary: str = ""
    retrieval_mode: str = Field(default="seed_or_vertex")


class CreditEvaluationInput(BaseModel):
    student: StudentProfile
    requirements: DegreeRequirements


class CreditEvaluationOutput(BaseModel):
    audit: DegreeAudit
    advisor_review_count: int = 0


class PlanningInput(BaseModel):
    student: StudentProfile
    audit: DegreeAudit


class PlanningOutput(BaseModel):
    plan: AcademicPlan
    next_semester: SemesterPlan | None = None


class ScheduleRankingInput(BaseModel):
    student: StudentProfile
    next_semester: SemesterPlan


class ScheduleRankingOutput(BaseModel):
    schedules: list[ProposedSchedule] = Field(default_factory=list)
    preferred_schedule_id: str = ""


class CalendarExecutionInput(BaseModel):
    schedule_id: str
    include_commute: bool = True


class CalendarExecutionOutput(BaseModel):
    result: CalendarExportResult


class WorkflowSnapshot(BaseModel):
    student: StudentProfile
    audit: DegreeAudit | None = None
    plan: AcademicPlan | None = None
    schedules: list[ProposedSchedule] = Field(default_factory=list)
    selected_schedule_id: str = ""
    calendar_result: CalendarExportResult | None = None
    agent_log: list["AgentStep"] = Field(default_factory=list)


def build_agent_handoff_schemas() -> dict[str, dict]:
    return {
        "requirements_retrieval_output": RequirementsRetrievalOutput.model_json_schema(),
        "credit_evaluation_input": CreditEvaluationInput.model_json_schema(),
        "credit_evaluation_output": CreditEvaluationOutput.model_json_schema(),
        "planning_input": PlanningInput.model_json_schema(),
        "planning_output": PlanningOutput.model_json_schema(),
        "schedule_ranking_input": ScheduleRankingInput.model_json_schema(),
        "schedule_ranking_output": ScheduleRankingOutput.model_json_schema(),
        "calendar_execution_input": CalendarExecutionInput.model_json_schema(),
        "calendar_execution_output": CalendarExecutionOutput.model_json_schema(),
        "workflow_snapshot": WorkflowSnapshot.model_json_schema(),
    }


from app.agents.orchestrator import AgentStep  # noqa: E402

WorkflowSnapshot.model_rebuild()
AGENT_HANDOFF_SCHEMAS = build_agent_handoff_schemas()
