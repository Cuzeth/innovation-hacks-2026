"""Contracts and schema discovery routes."""
from fastapi import APIRouter

from app.contracts import AGENT_HANDOFF_SCHEMAS

router = APIRouter()

API_ROUTES = [
    {"method": "GET", "path": "/api/student/profile", "description": "Load the active student profile"},
    {"method": "PUT", "path": "/api/student/profile", "description": "Create or update the student profile"},
    {"method": "POST", "path": "/api/student/profile/load-demo", "description": "Load the seeded ASU demo student"},
    {"method": "POST", "path": "/api/audit/run", "description": "Run the full multi-agent advising workflow"},
    {"method": "GET", "path": "/api/audit/result", "description": "Fetch the latest degree audit"},
    {"method": "GET", "path": "/api/plan/result", "description": "Fetch the latest graduation plan"},
    {"method": "GET", "path": "/api/schedule/recommendations", "description": "Fetch ranked next-term schedules"},
    {"method": "GET", "path": "/api/plan/what-if/options", "description": "List scenario-analysis candidate courses"},
    {"method": "POST", "path": "/api/plan/what-if", "description": "Simulate failing an in-progress or upcoming course"},
    {"method": "POST", "path": "/api/schedule/{schedule_id}/select", "description": "Persist the chosen schedule"},
    {"method": "POST", "path": "/api/calendar/preview", "description": "Preview Google Calendar events"},
    {"method": "POST", "path": "/api/calendar/export", "description": "Export the selected schedule to Google Calendar"},
]


@router.get("")
async def get_contracts():
    return {
        "agent_handoff_schemas": AGENT_HANDOFF_SCHEMAS,
        "api_routes": API_ROUTES,
    }
