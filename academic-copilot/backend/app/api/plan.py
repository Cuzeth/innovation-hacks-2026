"""Academic plan API routes."""
from fastapi import APIRouter
from app.api.audit import get_state

router = APIRouter()


@router.get("/result")
async def get_plan():
    """Get the generated academic plan."""
    state = get_state()
    if not state or not state.plan:
        return {"error": "No plan generated yet. Run the audit first."}
    return state.plan.model_dump()


@router.get("/bottlenecks")
async def get_bottlenecks():
    """Get bottleneck analysis."""
    state = get_state()
    if not state or not state.plan:
        return {"error": "No plan available"}
    return {
        "bottlenecks": [b.model_dump() for b in state.plan.bottlenecks],
        "ap_credit_impact": state.plan.ap_credit_impact.model_dump() if state.plan.ap_credit_impact else None,
        "risk_summary": state.plan.risk_summary,
    }


@router.get("/paths")
async def get_paths():
    """Get all graduation paths (recommended + alternatives)."""
    state = get_state()
    if not state or not state.plan:
        return {"error": "No plan available"}
    paths = [state.plan.recommended_path.model_dump()]
    for alt in state.plan.alternative_paths:
        paths.append(alt.model_dump())
    return {"paths": paths}
