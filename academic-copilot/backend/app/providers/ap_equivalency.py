"""AP and transfer credit equivalency provider."""
from __future__ import annotations
import json
from pathlib import Path
from .base import EquivalencyProvider

DATA_DIR = Path(__file__).parent.parent / "data"


class ASUEquivalencyProvider(EquivalencyProvider):
    def __init__(self):
        self._data: dict | None = None

    def _load(self):
        if self._data:
            return
        with open(DATA_DIR / "ap_equivalencies.json") as f:
            self._data = json.load(f)

    async def resolve_ap(self, exam: str, score: int) -> list[dict]:
        self._load()
        matches = []
        for eq in self._data["equivalencies"]:
            if eq["exam"].lower() == exam.lower() and score >= eq["min_score"]:
                matches.append({
                    "exam": eq["exam"],
                    "score": score,
                    "asu_equivalent": eq["asu_equivalent"],
                    "credits": eq["credits"],
                    "title": eq["title"],
                    "confidence": eq.get("confidence", "high"),
                    "notes": eq.get("notes", ""),
                })
        # Return the best match (highest min_score that the student meets)
        if matches:
            return [max(matches, key=lambda m: m.get("score", 0))]
        return []

    async def resolve_transfer(self, institution: str, course_id: str) -> dict | None:
        self._load()
        institutions = self._data.get("transfer_institutions", {})
        for inst_name, inst_data in institutions.items():
            if institution.lower() in inst_name.lower():
                for eq in inst_data.get("common_equivalencies", []):
                    if eq["transfer_course"].lower() == course_id.lower():
                        return {
                            "institution": inst_name,
                            "transfer_course": eq["transfer_course"],
                            "asu_equivalent": eq["asu_equivalent"],
                            "credits": eq["credits"],
                            "confidence": eq.get("confidence", "medium"),
                        }
        return None
