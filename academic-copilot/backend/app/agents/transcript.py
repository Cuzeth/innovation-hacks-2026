"""Transcript Parser Agent — extracts courses from an uploaded PDF transcript using Gemini."""
from __future__ import annotations
import json
import re
from pathlib import Path
from google.genai import types
from app.utils.course_ids import normalize_course_id
from .base import BaseAgent

DATA_DIR = Path(__file__).parent.parent / "data"

RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "course_id": {"type": "string"},
            "title": {"type": "string"},
            "credits": {"type": "integer"},
            "earned_credits": {"type": "number"},
            "grade": {"type": "string"},
            "semester": {"type": "string"},
            "repeat_status": {"type": "string"},
            "notes": {"type": "string"},
        },
        "required": ["course_id", "title", "credits", "grade", "semester"],
    },
}


class TranscriptParserAgent(BaseAgent):
    name = "transcript_parser_agent"
    system_prompt = (
        "You are an expert transcript parser for Arizona State University. "
        "You extract structured course data from unofficial transcript PDFs with perfect accuracy. "
        "You understand ASU's transcript layout with semester blocks, repeated courses, and grade columns."
    )

    async def parse_transcript(self, pdf_bytes: bytes) -> list[dict]:
        """Parse a transcript PDF and return extracted courses."""
        prompt = """Extract EVERY completed course from this ASU unofficial transcript PDF.

ASU TRANSCRIPT FORMAT:
- The transcript is organized by semester (e.g., "2022 Fall", "2023 Spring", "2023 Summer")
- Each semester block has columns: Course, Description, Attempted, Earned, Grade, Points
- Course IDs are like "CSE 110", "MAT 265", "ASB 230", "ENG 107", "FSE 100", "ART 274", etc.
- Descriptions may wrap across multiple lines — the course ID is always on the first line
- There may be a section before "Beginning of Undergraduate Record" showing transfer/AP credits — include those too

For each course return:
- course_id: format "ABC 123" (e.g., "CSE 110", "MAT 265", "ASB 230"). ALWAYS a space between letters and numbers.
- title: the description text from the transcript
- credits: the "Attempted" column value as an integer (use Attempted, not Earned, so in-progress courses get correct credits)
- earned_credits: the "Earned" column value as a number
- grade: the letter grade exactly as shown (e.g., "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "NR", etc.)
- semester: format as "Fall 2022", "Spring 2023", "Summer 2023" (convert "2022 Fall" to "Fall 2022")
- repeat_status: copy any repeat marker text exactly if present, such as "Repeated:", "Repeat - Excluded from GPA and Hours Earned", or "Repeat - Included in GPA"
- notes: any short parsing note that would help an advisor review a repeat/transfer edge case

CRITICAL RULES:
1. Include ALL courses from ALL departments — not just CSE. Include ASB, APA, AST, ENG, ENV, MAT, PHY, FSE, REL, PSY, POS, ART, IEE, STP, HIS, COM, etc.
2. SKIP courses with grade "W" (withdrawal) — earned credits will be 0.000
3. SKIP courses with grade "E" (failing) — earned credits will be 0.000
4. INCLUDE courses with grade "NR" (not yet reported / in progress) — these are current semester courses the student is actively taking
5. SKIP courses with grade "I" (incomplete)
6. For REPEATED courses: the transcript marks them as "Repeated:" or "Repeat - Excluded from GPA" or "Repeat - Included in GPA". When a course appears multiple times:
   - NEVER skip a row just because it contains the word "Repeated" or "Repeat" if the row still shows a passing grade and earned credits greater than 0.000
   - If an attempt has earned credits 0.000, it should not count as completed
   - If multiple attempts exist, keep the most recent valid passing attempt with earned credits > 0.000
   - If a row has a repeat marker and earned credits > 0.000, INCLUDE it and preserve the repeat_status so the app can review it safely later
7. Include courses with grade "D" — they are passing (the student may want to retake but they count)
8. The "Earned" column shows actual earned credits — if it's 0.000, the course was not completed
9. Transfer credits or AP credits listed before "Beginning of Undergraduate Record" should be included with semester "Transfer"
10. Courses like "ASU 101CSE" should be normalized to "ASU 101" (drop the section suffix if it's part of the course ID)

Be exhaustive — extract every single course with a passing grade. A typical transcript has 30-45 courses."""

        pdf_part = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
        text_part = types.Part.from_text(text=prompt)

        result_text = await self._generate_multimodal(
            [pdf_part, text_part],
            response_schema=RESPONSE_SCHEMA,
        )

        # Parse JSON
        text = result_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        courses = json.loads(text)
        return _postprocess_extracted_courses(courses)


def _normalize_course_id(cid: str) -> str:
    """Normalize 'CSE110' or 'CSE  110' or 'ASU 101CSE' to 'CSE 110' / 'ASU 101'."""
    return normalize_course_id(cid)


def _postprocess_extracted_courses(courses: list[dict]) -> list[dict]:
    """Normalize, filter, and deduplicate transcript extraction results."""
    seen: dict[str, dict] = {}
    for raw_course in courses:
        course = dict(raw_course)
        cid = _coerce_course_id(course)
        if not cid:
            continue

        course["course_id"] = _normalize_course_id(cid)
        course["title"] = _clean_title(str(course.get("title", "")).strip(), course["course_id"])
        course["grade"] = str(course.get("grade", "")).strip().upper()
        course["earned_credits"] = float(course.get("earned_credits", course.get("credits", 0)) or 0)
        course["repeat_status"] = str(course.get("repeat_status", "")).strip()
        course["notes"] = str(course.get("notes", "")).strip()
        course["source"] = "asu"
        course["transfer_institution"] = ""

        if course["grade"] in {"W", "E", "I"}:
            continue
        if course["earned_credits"] <= 0 and course["grade"] != "NR":
            continue

        existing = seen.get(course["course_id"])
        if existing is None or _attempt_rank(course) > _attempt_rank(existing):
            seen[course["course_id"]] = course

    return list(seen.values())


def _coerce_course_id(course: dict) -> str:
    """Recover course IDs from repeated-course transcript text when the parser misplaces cells."""
    for field in ("course_id", "title", "notes", "repeat_status"):
        text = str(course.get(field, "")).strip()
        if not text:
            continue

        normalized = _normalize_course_id(text)
        if _looks_like_course_id(normalized):
            return normalized

        embedded_match = re.search(r"([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)", text, flags=re.IGNORECASE)
        if embedded_match:
            return _normalize_course_id(embedded_match.group(0))

    return ""


def _looks_like_course_id(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{2,4}\s\d{3}", value))


def _clean_title(title: str, course_id: str) -> str:
    cleaned = " ".join(title.replace("Repeated:", "").split())
    if course_id and cleaned.upper().startswith(course_id):
        cleaned = cleaned[len(course_id):].lstrip(" :-")
    return cleaned or title


def _attempt_rank(course: dict) -> tuple[int, int, int, int]:
    """Rank transcript attempts so valid earned-credit attempts win over noisy repeat labels."""
    grade = str(course.get("grade", "")).strip().upper()
    earned_positive = 1 if float(course.get("earned_credits", 0) or 0) > 0 else 0
    in_progress = 1 if grade == "NR" else 0
    semester_rank = _semester_order(str(course.get("semester", "")))
    repeat_text = str(course.get("repeat_status", "")).lower()

    # Do not overly trust repeat labels when the transcript still shows earned credit.
    repeat_penalty = 0
    if "excluded" in repeat_text and earned_positive == 0:
        repeat_penalty = -1

    return (
        earned_positive,
        in_progress,
        semester_rank,
        repeat_penalty,
    )


def _semester_order(sem: str) -> int:
    """Convert semester string to sortable integer."""
    parts = sem.split()
    if len(parts) != 2:
        return 0
    season, year_str = parts[0], parts[1]
    try:
        year = int(year_str)
    except ValueError:
        return 0
    season_val = {"Spring": 0, "Summer": 1, "Fall": 2}.get(season, 0)
    return year * 10 + season_val
