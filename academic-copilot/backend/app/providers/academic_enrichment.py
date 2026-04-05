"""Demo academic enrichment providers for professor ratings and syllabus history."""
from __future__ import annotations

import json
from pathlib import Path

from .base import ProfessorRatingProvider, SyllabusArchiveProvider

DATA_DIR = Path(__file__).parent.parent / "data"


class DemoProfessorRatingProvider(ProfessorRatingProvider):
    def __init__(self):
        self._ratings: list[dict] | None = None

    def _load(self):
        if self._ratings is not None:
            return
        with open(DATA_DIR / "professor_ratings.json") as f:
            self._ratings = json.load(f)["ratings"]

    async def get_rating(self, instructor: str, course_id: str = "") -> dict | None:
        self._load()
        assert self._ratings is not None

        best_match = None
        for record in self._ratings:
            if record["instructor"].lower() != instructor.lower():
                continue
            if course_id and record.get("course_id") and record["course_id"] != course_id:
                continue
            best_match = record
            break
        return best_match


class DemoSyllabusArchiveProvider(SyllabusArchiveProvider):
    def __init__(self):
        self._signals: dict[str, dict] | None = None

    def _load(self):
        if self._signals is not None:
            return
        with open(DATA_DIR / "syllabus_signals.json") as f:
            raw = json.load(f)["courses"]
        self._signals = {item["course_id"]: item for item in raw}

    async def get_course_context(self, course_id: str) -> dict | None:
        self._load()
        assert self._signals is not None
        return self._signals.get(course_id)
