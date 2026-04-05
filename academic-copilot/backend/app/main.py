"""Academic Copilot for ASU — FastAPI backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import student as student_api
from .api import audit as audit_api
from .api import plan as plan_api
from .api import schedule as schedule_api
from .api import calendar as calendar_api
from .api import auth as auth_api

settings = get_settings()

app = FastAPI(
    title="Academic Copilot API",
    description="AI-powered academic advisor for ASU students",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_api.router, prefix="/api/auth", tags=["auth"])
app.include_router(student_api.router, prefix="/api/student", tags=["student"])
app.include_router(audit_api.router, prefix="/api/audit", tags=["audit"])
app.include_router(plan_api.router, prefix="/api/plan", tags=["plan"])
app.include_router(schedule_api.router, prefix="/api/schedule", tags=["schedule"])
app.include_router(calendar_api.router, prefix="/api/calendar", tags=["calendar"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
