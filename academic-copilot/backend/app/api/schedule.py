"""Schedule recommendation API routes."""
from fastapi import APIRouter
from app.api.audit import get_state

router = APIRouter()


@router.get("/recommendations")
async def get_recommendations():
    """Get ranked schedule recommendations for the next semester."""
    state = get_state()
    if not state or not state.schedules:
        return {"error": "No schedules generated yet. Run the audit first."}
    return {
        "schedules": [s.model_dump() for s in state.schedules],
        "semester": state.schedules[0].semester if state.schedules else "",
    }


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: str):
    """Get a specific schedule by ID."""
    state = get_state()
    if not state:
        return {"error": "No schedules available"}
    for s in state.schedules:
        if s.id == schedule_id:
            return s.model_dump()
    return {"error": f"Schedule {schedule_id} not found"}


@router.post("/{schedule_id}/select")
async def select_schedule(schedule_id: str):
    """Mark a schedule as selected by the student."""
    state = get_state()
    if not state:
        return {"error": "No schedules available"}
    for s in state.schedules:
        if s.id == schedule_id:
            state.selected_schedule = s
            return {"message": f"Selected {s.name}", "schedule": s.model_dump()}
    return {"error": f"Schedule {schedule_id} not found"}
