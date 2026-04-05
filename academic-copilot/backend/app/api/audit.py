"""Degree audit API routes."""
from fastapi import APIRouter, HTTPException
from app.agents.orchestrator import OrchestratorAgent, WorkflowState
from app.agents.credit_eval import CreditEvaluationAgent
from app.api.student import get_student

router = APIRouter()

# In-memory workflow state
_states: dict[str, WorkflowState] = {}


def get_state(student_id: str = "demo-student") -> WorkflowState | None:
    return _states.get(student_id)


def set_state(student_id: str, state: WorkflowState):
    _states[student_id] = state


@router.post("/run")
async def run_full_audit():
    """Run the complete advising workflow: requirements -> audit -> plan -> schedules."""
    student = get_student()
    orchestrator = OrchestratorAgent()

    try:
        state = await orchestrator.run_full_audit(student)
    except Exception as e:
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            raise HTTPException(429, "Gemini API rate limit exceeded. Please wait a moment and try again.")
        if "403" in msg or "PERMISSION_DENIED" in msg:
            raise HTTPException(403, "Gemini API key issue. Check your GEMINI_API_KEY.")
        raise HTTPException(500, f"Audit failed: {msg}")
    set_state(student.id, state)

    return {
        "audit": state.audit.model_dump() if state.audit else None,
        "plan": state.plan.model_dump() if state.plan else None,
        "schedules": [s.model_dump() for s in state.schedules],
        "agent_log": [step.to_dict() for step in state.agent_log],
    }


@router.get("/result")
async def get_audit_result():
    """Get the latest audit result."""
    state = get_state()
    if not state or not state.audit:
        return {"error": "No audit has been run yet. Call POST /api/audit/run first."}
    return state.audit.model_dump()


@router.get("/explain")
async def explain_audit():
    """Get AI-generated explanation of the audit."""
    state = get_state()
    if not state or not state.audit:
        return {"error": "No audit available"}

    agent = CreditEvaluationAgent()
    explanation = await agent.explain_audit(state.audit)
    return {"explanation": explanation}


@router.get("/agent-log")
async def get_agent_log():
    """Get the agent activity log."""
    state = get_state()
    if not state:
        return {"log": []}
    return {"log": [step.to_dict() for step in state.agent_log]}
