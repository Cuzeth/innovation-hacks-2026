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
        "You extract structured course data from unofficial transcript PDFs with high accuracy."
    )

    def __init__(self):
        super().__init__()
        self._catalog_ids: list[str] | None = None

    def _load_catalog_ids(self) -> list[str]:
        if self._catalog_ids is None:
            with open(DATA_DIR / "asu_cs_courses.json") as f:
                data = json.load(f)
            self._catalog_ids = [c["course_id"] for c in data["courses"]]
        return self._catalog_ids

    async def parse_transcript(self, pdf_bytes: bytes) -> list[dict]:
        """Parse a transcript PDF and return extracted courses."""
        catalog_ids = self._load_catalog_ids()
        catalog_str = ", ".join(catalog_ids)

        prompt = f"""Extract all completed courses from this ASU unofficial transcript PDF.

For each course, return:
- course_id: normalized format "ABC 123" with a space between prefix and number (e.g., "CSE 110", "MAT 265")
- title: course title as shown on transcript
- credits: credit hours as an integer
- grade: letter grade received (e.g., "A", "B+", "C-")
- semester: format as "Fall 2024", "Spring 2025", or "Summer 2023"

Rules:
- Only include courses with earned grades (A through D-, including +/- variants)
- Skip courses with W (withdrawal), E (failing), I (incomplete), or in-progress/planned status
- Normalize course IDs: always use a single space between department prefix and number
- If the transcript shows "CSE110" or "CSE  110", normalize to "CSE 110"
- Include ALL courses, not just CS courses — include math, physics, English, gen eds, etc.
- If a course has a repeated attempt, only include the most recent passing grade

Known ASU course IDs for reference (but include courses not on this list too):
{catalog_str}

Return the courses as a JSON array."""

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

        # Enrich with catalog data where possible
        with open(DATA_DIR / "asu_cs_courses.json") as f:
            catalog = {c["course_id"]: c for c in json.load(f)["courses"]}

        for course in courses:
            cid = course.get("course_id", "")
            if cid in catalog:
                # Use canonical title/credits from catalog if available
                if not course.get("title"):
                    course["title"] = catalog[cid]["title"]
                if not course.get("credits"):
                    course["credits"] = catalog[cid]["credits"]
            course["source"] = "asu"
            course["transfer_institution"] = ""

        return courses
