"""ASU requirements provider — loads from seed data."""
from __future__ import annotations
import json
from pathlib import Path
from app.models.degree import DegreeRequirements, RequirementCategory, Requirement, CourseOption
from .base import RequirementsProvider


DATA_DIR = Path(__file__).parent.parent / "data"


class ASURequirementsProvider(RequirementsProvider):
    def __init__(self):
        self._cache: dict[str, DegreeRequirements] = {}

    async def get_requirements(self, major_code: str, catalog_year: str) -> DegreeRequirements:
        cache_key = f"{major_code}:{catalog_year}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Map major_code to file
        file_map = {
            "ESCSCI": "asu_cs_requirements.json",
        }
        filename = file_map.get(major_code)
        if not filename:
            raise ValueError(f"No requirements data for major {major_code}")

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

        result = DegreeRequirements(
            university=raw["university"],
            major=raw["major"],
            major_code=raw["major_code"],
            degree=raw["degree"],
            catalog_year=raw["catalog_year"],
            total_credits_required=raw["total_credits_required"],
            minimum_gpa=raw.get("minimum_gpa", 2.0),
            residency_credits=raw.get("residency_credits", 30),
            upper_division_credits=raw.get("upper_division_credits", 45),
            categories=categories,
            data_source=raw.get("data_source", ""),
            data_source_url=raw.get("data_source_url", ""),
            notes=raw.get("notes", []),
        )
        self._cache[cache_key] = result
        return result

    async def list_majors(self) -> list[dict]:
        return [
            {
                "code": "ESCSCI",
                "name": "Computer Science",
                "degree": "BS",
                "college": "Ira A. Fulton Schools of Engineering",
            }
        ]
