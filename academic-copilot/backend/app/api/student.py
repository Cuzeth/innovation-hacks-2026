"""Student profile API routes."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.student import StudentProfile, CompletedCourse, StudentPreferences
from app.db.repository import (
    clear_workflow_state,
    delete_student_profile,
    ensure_demo_profile,
    get_student_profile,
    load_demo_profile,
    upsert_student_profile,
)
import json
from pathlib import Path

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"


@router.get("/profile")
async def get_profile():
    profile = get_student_profile("demo-student")
    if not profile:
        return {"not_setup": True}
    return profile


@router.post("/profile/reset")
async def reset_profile():
    """Clear the profile so onboarding runs again."""
    delete_student_profile("demo-student")
    return {"ok": True}


@router.post("/profile/load-demo")
async def load_demo():
    """Load the pre-built demo student profile."""
    delete_student_profile("demo-student")
    clear_workflow_state("demo-student")
    profile = load_demo_profile()
    return upsert_student_profile(profile)


@router.put("/profile")
async def update_profile(profile: StudentProfile):
    clear_workflow_state(profile.id)
    return upsert_student_profile(profile)


@router.put("/preferences")
async def update_preferences(prefs: StudentPreferences):
    student = ensure_demo_profile("demo-student")
    student.preferences = prefs
    clear_workflow_state(student.id)
    return upsert_student_profile(student)


@router.post("/courses")
async def add_course(course: CompletedCourse):
    student = ensure_demo_profile("demo-student")
    student.completed_courses.append(course)
    clear_workflow_state(student.id)
    return upsert_student_profile(student)


@router.delete("/courses/{course_id}")
async def remove_course(course_id: str):
    student = ensure_demo_profile("demo-student")
    student.completed_courses = [c for c in student.completed_courses if c.course_id != course_id]
    clear_workflow_state(student.id)
    return upsert_student_profile(student)


@router.get("/majors")
async def list_majors():
    """List all ASU undergraduate majors."""
    try:
        with open(DATA_DIR / "asu_majors.json") as f:
            return json.load(f)
    except FileNotFoundError:
        return [
            {"code": "ESCSCI", "name": "Computer Science", "degree": "BS", "college": "Ira A. Fulton Schools of Engineering"},
        ]


@router.post("/transcript/upload")
async def upload_transcript(file: UploadFile = File(...)):
    """Upload a transcript PDF and extract courses using Gemini."""
    if file.content_type and "pdf" not in file.content_type:
        raise HTTPException(400, "Only PDF files are supported")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "File too large (max 10MB)")

    from app.agents.transcript import TranscriptParserAgent
    agent = TranscriptParserAgent()
    try:
        courses = await agent.parse_transcript(pdf_bytes)
    except Exception as e:
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            raise HTTPException(429, "Gemini API rate limit exceeded. Please wait a moment and try again.")
        if "403" in msg or "PERMISSION_DENIED" in msg:
            raise HTTPException(403, "Gemini API key issue. Check your GEMINI_API_KEY configuration.")
        raise HTTPException(500, f"Failed to parse transcript: {msg}")
    return {"courses": courses}


@router.get("/courses/catalog")
async def list_courses():
    """List all courses in the catalog for the course picker."""
    with open(DATA_DIR / "asu_cs_courses.json") as f:
        data = json.load(f)
    return [{"course_id": c["course_id"], "title": c["title"], "credits": c["credits"]} for c in data["courses"]]


@router.get("/ap-exams")
async def list_ap_exams():
    """List available AP exams for the AP credit picker."""
    with open(DATA_DIR / "ap_equivalencies.json") as f:
        data = json.load(f)
    # Deduplicate exam names
    seen = set()
    exams = []
    for eq in data["equivalencies"]:
        if eq["exam"] not in seen:
            seen.add(eq["exam"])
            exams.append({"exam": eq["exam"], "asu_equivalent": eq["asu_equivalent"], "credits": eq["credits"]})
    return exams


def get_student(student_id: str = "demo-student") -> StudentProfile:
    return ensure_demo_profile(student_id)
