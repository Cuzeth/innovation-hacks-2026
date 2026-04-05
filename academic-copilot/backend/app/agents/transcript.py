"""Transcript Parser Agent — extracts courses from an uploaded PDF transcript using Gemini."""
from __future__ import annotations
import json
from pathlib import Path
from google.genai import types
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
            "grade": {"type": "string"},
            "semester": {"type": "string"},
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
- grade: the letter grade exactly as shown (e.g., "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "NR", etc.)
- semester: format as "Fall 2022", "Spring 2023", "Summer 2023" (convert "2022 Fall" to "Fall 2022")

CRITICAL RULES:
1. Include ALL courses from ALL departments — not just CSE. Include ASB, APA, AST, ENG, ENV, MAT, PHY, FSE, REL, PSY, POS, ART, IEE, STP, HIS, COM, etc.
2. SKIP courses with grade "W" (withdrawal) — earned credits will be 0.000
3. SKIP courses with grade "E" (failing) — earned credits will be 0.000
4. INCLUDE courses with grade "NR" (not yet reported / in progress) — these are current semester courses the student is actively taking
5. SKIP courses with grade "I" (incomplete)
6. For REPEATED courses: the transcript marks them as "Repeated:" or "Repeat - Excluded from GPA" or "Repeat - Included in GPA". When a course appears multiple times:
   - If marked "Repeat - Excluded from GPA and Hours Earned", SKIP that attempt
   - If marked "Repeat - Included in GPA", INCLUDE that attempt
   - If both attempts have passing grades and no repeat marker, include the LATEST one
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

        # Deduplicate — keep latest attempt per course_id
        seen: dict[str, dict] = {}
        for course in courses:
            cid = course.get("course_id", "")
            if not cid:
                continue
            # Normalize course ID spacing
            cid = _normalize_course_id(cid)
            course["course_id"] = cid
            course["source"] = "asu"
            course["transfer_institution"] = ""

            # Keep latest semester's attempt
            existing = seen.get(cid)
            if existing is None:
                seen[cid] = course
            else:
                # Compare semesters — keep the later one
                if _semester_order(course.get("semester", "")) > _semester_order(existing.get("semester", "")):
                    seen[cid] = course

        return list(seen.values())


def _normalize_course_id(cid: str) -> str:
    """Normalize 'CSE110' or 'CSE  110' or 'ASU 101CSE' to 'CSE 110' / 'ASU 101'."""
    import re
    cid = cid.strip()
    # Remove trailing letter suffixes like "ASU 101CSE" -> "ASU 101"
    m = re.match(r'^([A-Z]{2,4})\s*(\d{3})', cid)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return cid


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
