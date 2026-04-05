"""Calendar export API routes."""
from fastapi import APIRouter
from pydantic import BaseModel
from app.agents.orchestrator import OrchestratorAgent
from app.api.audit import get_state
from app.api.auth import get_credentials

router = APIRouter()


class ExportRequest(BaseModel):
    schedule_id: str
    include_commute: bool = True
    calendar_id: str = "primary"


@router.post("/preview")
async def preview_events(req: ExportRequest):
    """Preview calendar events before exporting."""
    state = get_state()
    if not state:
        return {"error": "No schedules available"}

    orchestrator = OrchestratorAgent()
    events = await orchestrator.get_calendar_preview(state, req.schedule_id)
    return {"events": events, "count": len(events)}


@router.post("/export")
async def export_to_calendar(req: ExportRequest):
    """Export schedule to Google Calendar."""
    state = get_state()
    if not state:
        return {"error": "No schedules available"}

    credentials = get_credentials()
    orchestrator = OrchestratorAgent()
    result = await orchestrator.export_calendar(
        state,
        req.schedule_id,
        credentials,
        req.include_commute,
    )
    return result.model_dump()
