"""ASU requirements provider — seed data + Gemini web-grounded lookup for any major."""
from __future__ import annotations
import json
import logging
from pathlib import Path
from google import genai
from google.genai import types
from app.models.degree import DegreeRequirements, RequirementCategory, Requirement, CourseOption
from app.config import get_settings
from .base import RequirementsProvider

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

# Majors with hand-curated seed data (highest accuracy)
FILE_MAP = {
    "ESCSCI": "asu_cs_requirements.json",
    "ESCSEIBS": "asu_cs_cyber_requirements.json",
}

REQUIREMENTS_SCHEMA = {
    "type": "object",
    "properties": {
        "total_credits_required": {"type": "integer"},
        "minimum_gpa": {"type": "number"},
        "categories": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "display_name": {"type": "string"},
                    "credits_required": {"type": "integer"},
                    "requirements": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "name": {"type": "string"},
                                "category": {"type": "string"},
                                "description": {"type": "string"},
                                "credits_required": {"type": "integer"},
                                "courses": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "course_id": {"type": "string"},
                                            "title": {"type": "string"},
                                            "credits": {"type": "integer"}
                                        },
                                        "required": ["course_id", "title", "credits"]
                                    }
                                },
                                "pick_n": {"type": "integer"},
                            },
                            "required": ["id", "name", "category", "credits_required"]
                        }
                    }
                },
                "required": ["name", "display_name", "credits_required", "requirements"]
            }
        }
    },
    "required": ["total_credits_required", "categories"]
}


def _load_major_info(major_code: str) -> dict:
    """Look up major name and college from catalog."""
    try:
        with open(DATA_DIR / "asu_majors.json") as f:
            majors = json.load(f)
        # Exact match first
        for m in majors:
            if m["code"] == major_code:
                return m
        # Prefix match (e.g. ESCSCI matches ESCSCIBS)
        for m in majors:
            if m["code"].startswith(major_code) or major_code.startswith(m["code"]):
                return m
    except FileNotFoundError:
        pass
    return {"code": major_code, "name": major_code, "degree": "BS", "college": ""}


def _parse_categories(raw_categories: list[dict]) -> list[RequirementCategory]:
    categories = []
    for cat_raw in raw_categories:
        reqs = []
        for r in cat_raw.get("requirements", []):
            courses_list = r.get("courses", r.get("courses_required", []))
            pick_from_list = r.get("pick_from", [])
            # If courses exist and pick_n > 0, they're pick_from options
            pick_n = r.get("pick_n", 0)
            if pick_n > 0 and courses_list and not pick_from_list:
                pick_from_list = courses_list
                courses_list = []

            courses_req = [CourseOption(**c) for c in (courses_list if not pick_n else [])]
            pick_from = [CourseOption(**c) for c in (pick_from_list if pick_n else [])]

            reqs.append(Requirement(
                id=r["id"],
                name=r["name"],
                category=r.get("category", cat_raw["name"]),
                description=r.get("description", ""),
                credits_required=r.get("credits_required", 0),
                courses_required=courses_req,
                min_courses=r.get("min_courses", 0),
                pick_n=pick_n,
                pick_from=pick_from,
            ))
        categories.append(RequirementCategory(
            name=cat_raw["name"],
            display_name=cat_raw["display_name"],
            credits_required=cat_raw["credits_required"],
            requirements=reqs,
        ))
    return categories


class ASURequirementsProvider(RequirementsProvider):
    def __init__(self):
        self._cache: dict[str, DegreeRequirements] = {}

    async def get_requirements(self, major_code: str, catalog_year: str) -> DegreeRequirements:
        cache_key = f"{major_code}:{catalog_year}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Try seed data first
        filename = FILE_MAP.get(major_code)
        if filename:
            result = self._load_from_file(filename, major_code)
            self._cache[cache_key] = result
            return result

        # 2. Use Gemini with Google Search grounding to look up real requirements
        logger.info(f"[RequirementsProvider] No seed data for {major_code}, using Gemini web lookup")
        result = await self._lookup_with_gemini(major_code, catalog_year)
        self._cache[cache_key] = result
        return result

    def _load_from_file(self, filename: str, major_code: str) -> DegreeRequirements:
        filepath = DATA_DIR / filename
        with open(filepath) as f:
            raw = json.load(f)

        categories = _parse_categories(raw["categories"])
        major_info = _load_major_info(major_code)

        return DegreeRequirements(
            university=raw["university"],
            major=major_info.get("name", raw["major"]),
            major_code=major_code,
            degree=raw["degree"],
            catalog_year=raw.get("catalog_year", "2024-2025"),
            total_credits_required=raw["total_credits_required"],
            minimum_gpa=raw.get("minimum_gpa", 2.0),
            residency_credits=raw.get("residency_credits", 30),
            upper_division_credits=raw.get("upper_division_credits", 45),
            categories=categories,
            data_source=raw.get("data_source", ""),
            data_source_url=raw.get("data_source_url", ""),
            notes=raw.get("notes", []),
        )

    async def _lookup_with_gemini(self, major_code: str, catalog_year: str) -> DegreeRequirements:
        """Use Gemini with Google Search to look up ASU degree requirements."""
        settings = get_settings()
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY required to look up degree requirements")

        major_info = _load_major_info(major_code)
        major_name = major_info["name"]
        degree = major_info.get("degree", "BS")
        college = major_info.get("college", "")

        prompt = f"""Look up the degree requirements for the {degree} in {major_name} at Arizona State University ({college}).

Use the ASU Major Map or degree requirements page for this program. The ASU program code is {major_code}.
URL pattern: https://degrees.apps.asu.edu/major-map/ASU00/{major_code}/null/ALL/2024

I need the COMPLETE degree requirements structured as follows. Be thorough — include every requirement category.

For each requirement category, list:
1. Category name (e.g., "general_studies", "major_core", "major_elective", "math", "science", "free_elective")
2. Display name (e.g., "University General Studies", "Major Core Courses")
3. Total credits required for that category
4. Each individual requirement within the category:
   - A unique id (e.g., "mc-1", "gs-1")
   - Name of the requirement
   - Credits required
   - Specific courses that fulfill it (course_id like "CSE 110", title, credits)
   - If it's a "choose N from list" requirement, set pick_n to N and list the options in courses

Categories to include:
- General Studies / University Requirements (composition, humanities, social sciences, natural sciences, awareness areas)
- Mathematics requirements
- Science requirements (if applicable)
- Major lower-division core courses
- Major upper-division core courses
- Major electives
- Free electives (remaining credits to reach total)

Important:
- Course IDs must be in "ABC 123" format (e.g., "CSE 110", "MAT 265", "BIO 181")
- Include the total_credits_required for the degree (usually 120)
- Be accurate — use the actual ASU requirements, not generic ones
- Include ALL courses, even gen-ed requirements"""

        client = genai.Client(api_key=settings.gemini_api_key)

        config = types.GenerateContentConfig(
            system_instruction=(
                "You are an expert on Arizona State University degree requirements. "
                "You have access to Google Search to look up accurate, current ASU program requirements. "
                "Always return complete, structured degree requirements."
            ),
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
            response_schema=REQUIREMENTS_SCHEMA,
        )

        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=config,
            )
            text = response.text.strip()
        except Exception as e:
            logger.error(f"Gemini web lookup failed for {major_code}: {e}")
            raise ValueError(
                f"Failed to look up requirements for {major_name} via Gemini. "
                f"Ensure your GEMINI_API_KEY is valid and the model '{settings.gemini_model}' is accessible. "
                f"Error: {e}"
            )
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        raw = json.loads(text)
        categories = _parse_categories(raw.get("categories", []))

        return DegreeRequirements(
            university="Arizona State University",
            major=major_name,
            major_code=major_code,
            degree=degree,
            catalog_year=catalog_year,
            total_credits_required=raw.get("total_credits_required", 120),
            minimum_gpa=raw.get("minimum_gpa", 2.0),
            residency_credits=30,
            upper_division_credits=45,
            categories=categories,
            data_source=f"Generated by Gemini with Google Search grounding — verify with your advisor",
            data_source_url=f"https://degrees.apps.asu.edu/major-map/ASU00/{major_code}/null/ALL/2024",
            notes=[
                "These requirements were retrieved via AI with web search. They should be accurate but verify with your academic advisor.",
                f"Based on ASU's {major_name} ({degree}) program requirements.",
            ],
        )

    async def list_majors(self) -> list[dict]:
        try:
            with open(DATA_DIR / "asu_majors.json") as f:
                return json.load(f)
        except FileNotFoundError:
            return [{"code": "ESCSCI", "name": "Computer Science", "degree": "BS",
                     "college": "Ira A. Fulton Schools of Engineering"}]
