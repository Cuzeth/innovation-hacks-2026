"""ASU course & section provider — loads from seed data."""
from __future__ import annotations
import json
from pathlib import Path
from app.models.course import Course, Section, MeetingTime, CoursePrerequisite
from .base import CourseProvider

DATA_DIR = Path(__file__).parent.parent / "data"


class ASUCourseProvider(CourseProvider):
    def __init__(self):
        self._courses: dict[str, Course] = {}
        self._sections: dict[str, list[Section]] = {}
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        # Load courses
        with open(DATA_DIR / "asu_cs_courses.json") as f:
            raw = json.load(f)
        for c in raw["courses"]:
            prereqs = [CoursePrerequisite(**p) for p in c.get("prerequisites", [])]
            self._courses[c["course_id"]] = Course(
                course_id=c["course_id"],
                title=c.get("title", ""),
                credits=c.get("credits", 3),
                description=c.get("description", ""),
                prerequisites=prereqs,
                corequisites=c.get("corequisites", []),
                typically_offered=c.get("typically_offered", []),
                is_upper_division=c.get("is_upper_division", False),
            )
        # Load sections
        with open(DATA_DIR / "asu_cs_sections_fall2026.json") as f:
            raw = json.load(f)
        for s in raw["sections"]:
            mtimes = [MeetingTime(**m) for m in s.get("meeting_times", [])]
            section = Section(
                section_id=s["section_id"],
                course_id=s["course_id"],
                title=s.get("title", ""),
                credits=s.get("credits", 3),
                instructor=s.get("instructor", ""),
                instructor_rating=s.get("instructor_rating"),
                instructor_rating_source=s.get("instructor_rating_source", ""),
                modality=s.get("modality", "in_person"),
                meeting_times=mtimes,
                seats_total=s.get("seats_total", 40),
                seats_available=s.get("seats_available", 10),
                semester=raw["semester"],
            )
            self._sections.setdefault(s["course_id"], []).append(section)
        self._loaded = True

    async def get_course(self, course_id: str) -> Course | None:
        self._load()
        return self._courses.get(course_id)

    async def get_courses(self, course_ids: list[str]) -> list[Course]:
        self._load()
        return [self._courses[cid] for cid in course_ids if cid in self._courses]

    async def search_sections(self, course_id: str, semester: str) -> list[Section]:
        self._load()
        return [s for s in self._sections.get(course_id, []) if s.semester == semester]

    async def search_all_sections(self, course_ids: list[str], semester: str) -> dict[str, list[Section]]:
        self._load()
        result = {}
        for cid in course_ids:
            secs = [s for s in self._sections.get(cid, []) if s.semester == semester]
            if secs:
                result[cid] = secs
        return result
