"""ASU requirements provider — loads from seed data with smart fallback."""
from __future__ import annotations
import json
from pathlib import Path
from app.models.degree import DegreeRequirements, RequirementCategory, Requirement, CourseOption
from .base import RequirementsProvider


DATA_DIR = Path(__file__).parent.parent / "data"

# Exact seed data files
FILE_MAP = {
    "ESCSCI": "asu_cs_requirements.json",
}

# Majors that share a base curriculum — map to the closest seed data
# These are CS-family programs that share ~80%+ of core requirements
FAMILY_MAP = {
    # CS Cybersecurity variants
    "ESCSEIBS": "ESCSCI",
    "ESCSEIBA": "ESCSCI",
    # CS base variants
    "ESCSCIBA": "ESCSCI",
    # Software Engineering
    "ESSENBSE": "ESCSCI",
    # Computer Systems Engineering
    "ESCSEIBSE": "ESCSCI",
    # Applied Computing
    "ASACOCBS": "ESCSCI",
    # Informatics
    "ESINFRBS": "ESCSCI",
    # IT Cybersecurity
    "ESIFTCSBS": "ESCSCI",
}


def _load_major_name(major_code: str) -> str:
    """Look up the major name from the majors catalog."""
    try:
        with open(DATA_DIR / "asu_majors.json") as f:
            majors = json.load(f)
        for m in majors:
            if m["code"] == major_code:
                return m["name"]
    except FileNotFoundError:
        pass
    return major_code


class ASURequirementsProvider(RequirementsProvider):
    def __init__(self):
        self._cache: dict[str, DegreeRequirements] = {}

    async def get_requirements(self, major_code: str, catalog_year: str) -> DegreeRequirements:
        cache_key = f"{major_code}:{catalog_year}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Resolve which seed file to load
        filename = FILE_MAP.get(major_code)
        is_approximated = False
        base_code = major_code

        if not filename:
            # Check family map
            base_code = FAMILY_MAP.get(major_code)
            if base_code:
                filename = FILE_MAP.get(base_code)
                is_approximated = True

        if not filename:
            # Last resort: use CS requirements as generic Fulton Engineering base
            # This gives the student a starting point rather than a hard error
            filename = "asu_cs_requirements.json"
            base_code = "ESCSCI"
            is_approximated = True

        filepath = DATA_DIR / filename
        with open(filepath) as f:
            raw = json.load(f)

        categories = []
        for cat_raw in raw["categories"]:
            reqs = []
            for r in cat_raw["requirements"]:
                courses_req = [CourseOption(**c) for c in r.get("courses_required", [])]
                pick_from = [CourseOption(**c) for c in r.get("pick_from", [])]
                reqs.append(Requirement(
                    id=r["id"],
                    name=r["name"],
                    category=r["category"],
                    description=r.get("description", ""),
                    credits_required=r.get("credits_required", 0),
                    courses_required=courses_req,
                    min_courses=r.get("min_courses", 0),
                    pick_n=r.get("pick_n", 0),
                    pick_from=pick_from,
                ))
            categories.append(RequirementCategory(
                name=cat_raw["name"],
                display_name=cat_raw["display_name"],
                credits_required=cat_raw["credits_required"],
                requirements=reqs,
            ))

        major_name = _load_major_name(major_code)
        base_major_name = raw["major"]

        notes = list(raw.get("notes", []))
        data_source = raw.get("data_source", "")

        if is_approximated:
            notes.insert(0,
                f"Requirements are approximated from the {base_major_name} program. "
                f"Your actual {major_name} requirements may differ — verify with your advisor."
            )
            data_source = f"Approximated from {base_major_name} ({base_code}) — {data_source}"

        result = DegreeRequirements(
            university=raw["university"],
            major=major_name,
            major_code=major_code,
            degree=raw["degree"],
            catalog_year=raw["catalog_year"],
            total_credits_required=raw["total_credits_required"],
            minimum_gpa=raw.get("minimum_gpa", 2.0),
            residency_credits=raw.get("residency_credits", 30),
            upper_division_credits=raw.get("upper_division_credits", 45),
            categories=categories,
            data_source=data_source,
            data_source_url=raw.get("data_source_url", ""),
            notes=notes,
        )
        self._cache[cache_key] = result
        return result

    async def list_majors(self) -> list[dict]:
        try:
            with open(DATA_DIR / "asu_majors.json") as f:
                return json.load(f)
        except FileNotFoundError:
            return [{"code": "ESCSCI", "name": "Computer Science", "degree": "BS",
                     "college": "Ira A. Fulton Schools of Engineering"}]
