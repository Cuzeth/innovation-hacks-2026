"""Orchestrator Agent — coordinates the full advising workflow."""
from __future__ import annotations
import logging
from app.models.student import StudentProfile
from app.models.degree import DegreeAudit
from app.models.plan import AcademicPlan
from app.models.schedule import ProposedSchedule, CalendarExportResult
from .requirements import RequirementsAgent
from .credit_eval import CreditEvaluationAgent
from .planner import PlanningAgent
from .section_ranker import SectionRankingAgent
from .calendar import CalendarAgent
from .base import BaseAgent

logger = logging.getLogger(__name__)


class WorkflowState:
    """Tracks the state of the advising workflow."""

    def __init__(self, student: StudentProfile):
        self.student = student
        self.audit: DegreeAudit | None = None
        self.plan: AcademicPlan | None = None
        self.schedules: list[ProposedSchedule] = []
        self.selected_schedule: ProposedSchedule | None = None
        self.calendar_result: CalendarExportResult | None = None
        self.agent_log: list[AgentStep] = []

    def add_step(self, agent: str, action: str, status: str = "completed", detail: str = ""):
        self.agent_log.append(AgentStep(agent=agent, action=action, status=status, detail=detail))


class AgentStep:
    def __init__(self, agent: str, action: str, status: str, detail: str = ""):
        self.agent = agent
        self.action = action
        self.status = status
        self.detail = detail

    def to_dict(self):
        return {"agent": self.agent, "action": self.action, "status": self.status, "detail": self.detail}


class OrchestratorAgent(BaseAgent):
    name = "orchestrator"
    system_prompt = (
        "You are the orchestrator of an academic advising system. "
        "You coordinate multiple specialist agents to help ASU students "
        "plan their path to graduation."
    )

    def __init__(self):
        super().__init__()
        self.requirements_agent = RequirementsAgent()
        self.credit_eval_agent = CreditEvaluationAgent()
        self.planning_agent = PlanningAgent()
        self.section_ranker = SectionRankingAgent()
        self.calendar_agent = CalendarAgent()

    async def run_full_audit(self, student: StudentProfile) -> WorkflowState:
        """Run the complete audit workflow: requirements -> credit eval -> plan -> schedules."""
        state = WorkflowState(student)
        state.add_step(self.name, "Starting full academic audit", "in_progress")

        # Step 1: Get requirements
        logger.info(f"[Orchestrator] Fetching requirements for {student.major_code}")
        state.add_step("requirements_agent", "Retrieving degree requirements", "in_progress")
        requirements = await self.requirements_agent.get_requirements(
            student.major_code, student.catalog_year
        )
        state.add_step("requirements_agent", "Retrieved degree requirements", "completed",
                       f"{len(requirements.categories)} categories, {requirements.total_credits_required} total credits")

        # Step 2: Evaluate credits
        logger.info(f"[Orchestrator] Evaluating credits for {student.id}")
        state.add_step("credit_eval_agent", "Evaluating completed courses and AP credits", "in_progress")
        state.audit = await self.credit_eval_agent.evaluate(student, requirements)
        state.add_step("credit_eval_agent", "Credit evaluation complete", "completed",
                       f"{state.audit.fulfilled_count} fulfilled, {state.audit.partial_count} partial, {state.audit.unmet_count} unmet")

        # Step 3: Generate academic plan
        logger.info(f"[Orchestrator] Generating academic plan")
        state.add_step("planning_agent", "Generating semester-by-semester plan", "in_progress")
        state.plan = await self.planning_agent.generate_plan(student, state.audit)
        state.add_step("planning_agent", "Academic plan generated", "completed",
                       f"{state.plan.recommended_path.total_semesters} semesters, "
                       f"graduating {state.plan.recommended_path.graduation_term}")

        # Step 4: Rank sections for next semester
        if state.plan.recommended_path.semesters:
            next_sem = state.plan.recommended_path.semesters[0]
            logger.info(f"[Orchestrator] Ranking sections for {next_sem.semester}")
            state.add_step("section_ranking_agent", f"Finding best sections for {next_sem.semester}", "in_progress")
            state.schedules = await self.section_ranker.rank_schedules(student, next_sem)
            state.add_step("section_ranking_agent", "Section ranking complete", "completed",
                           f"{len(state.schedules)} schedule options generated")

        state.add_step(self.name, "Full audit workflow complete", "completed")
        return state

    async def export_calendar(
        self,
        state: WorkflowState,
        schedule_id: str,
        credentials: dict,
        include_commute: bool = True,
    ) -> CalendarExportResult:
        """Export a selected schedule to Google Calendar."""
        schedule = None
        for s in state.schedules:
            if s.id == schedule_id:
                schedule = s
                break
        if not schedule:
            return CalendarExportResult(success=False, message=f"Schedule {schedule_id} not found")

        state.add_step("calendar_agent", f"Exporting {schedule.name} to Google Calendar", "in_progress")
        result = await self.calendar_agent.export_to_calendar(
            schedule, credentials, include_commute
        )
        state.calendar_result = result
        state.selected_schedule = schedule

        if result.success:
            state.add_step("calendar_agent", "Calendar export complete", "completed", result.message)
        else:
            state.add_step("calendar_agent", "Calendar export failed", "failed", result.message)

        return result

    async def get_calendar_preview(self, state: WorkflowState, schedule_id: str) -> list[dict]:
        """Preview calendar events without exporting."""
        schedule = None
        for s in state.schedules:
            if s.id == schedule_id:
                schedule = s
                break
        if not schedule:
            return []

        events = self.calendar_agent.generate_events(schedule, include_commute=True)
        return [ev.model_dump() for ev in events]
