"""Academic plan API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re
from app.api.audit import get_state
from app.agents.planner import PlanningAgent

router = APIRouter()


class WhatIfRequest(BaseModel):
    question: str = ""
    target_course_id: str = ""


def _extract_course_id(text: str) -> str:
    if not text:
        return ""
    match = re.search(r"\b([A-Z]{2,4})\s*-?\s*(\d{3})\b", text.upper())
    if not match:
        return ""
    return f"{match.group(1)} {match.group(2)}"


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


@router.get("/what-if/options")
async def get_what_if_options():
    """Get courses that are good candidates for failure what-if analysis."""
    state = get_state()
    if not state or not state.plan:
        raise HTTPException(404, "No plan available")

    planner = PlanningAgent()
    options = await planner.get_what_if_candidates(state.student, state.plan)
    return {"options": [option.model_dump() for option in options]}


@router.post("/what-if")
async def analyze_what_if(req: WhatIfRequest):
    """Analyze the effect of failing an in-progress or upcoming course."""
    state = get_state()
    if not state or not state.plan or not state.audit:
        raise HTTPException(404, "No plan available")

    target_course_id = req.target_course_id or _extract_course_id(req.question)
    if not target_course_id:
        raise HTTPException(400, "Please specify a course like 'CSE 330' in the question or target_course_id.")

    planner = PlanningAgent()
    analysis = await planner.analyze_failure_scenario(
        state.student,
        state.audit,
        state.plan,
        target_course_id,
        req.question,
    )
    return analysis.model_dump()
