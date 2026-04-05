"""Student profile API routes."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.student import StudentProfile, CompletedCourse, StudentPreferences
import json
from pathlib import Path

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"

# In-memory store
_students: dict[str, StudentProfile] = {}


def _load_sample():
    if "demo-student" in _students:
        return
    with open(DATA_DIR / "sample_student.json") as f:
        data = json.load(f)
    courses = [CompletedCourse(**c) for c in data.get("completed_courses", [])]
    prefs = StudentPreferences(**data.get("preferences", {}))
    student = StudentProfile(
        id=data["id"],
        name=data["name"],
        email=data.get("email", ""),
        university=data["university"],
        major=data["major"],
        major_code=data["major_code"],
        catalog_year=data.get("catalog_year", "2024-2025"),
        current_semester=data.get("current_semester", "Fall 2026"),
        completed_courses=courses,
        preferences=prefs,
    )
    student.compute_credits()
    _students["demo-student"] = student


@router.get("/profile")
async def get_profile():
    if "demo-student" not in _students:
        return {"not_setup": True}
    return _students["demo-student"]


@router.post("/profile/reset")
async def reset_profile():
    """Clear the profile so onboarding runs again."""
    _students.pop("demo-student", None)
    return {"ok": True}


@router.post("/profile/load-demo")
async def load_demo():
    """Load the pre-built demo student profile."""
    _students.pop("demo-student", None)
    _load_sample()
    return _students["demo-student"]


@router.put("/profile")
async def update_profile(profile: StudentProfile):
    profile.compute_credits()
    _students[profile.id] = profile
    return profile


@router.put("/preferences")
async def update_preferences(prefs: StudentPreferences):
    _load_sample()
    student = _students["demo-student"]
    student.preferences = prefs
    return student


@router.post("/courses")
async def add_course(course: CompletedCourse):
    _load_sample()
    student = _students["demo-student"]
    student.completed_courses.append(course)
    student.compute_credits()
    return student


@router.delete("/courses/{course_id}")
async def remove_course(course_id: str):
    _load_sample()
    student = _students["demo-student"]
    student.completed_courses = [c for c in student.completed_courses if c.course_id != course_id]
    student.compute_credits()
    return student


@router.get("/majors")
async def list_majors():
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
    courses = await agent.parse_transcript(pdf_bytes)
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
    _load_sample()
    return _students.get(student_id, _students["demo-student"])
