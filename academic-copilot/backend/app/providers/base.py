"""Provider interfaces — adaptor pattern for all external data sources."""
from __future__ import annotations
from abc import ABC, abstractmethod
from app.models.degree import DegreeRequirements
from app.models.course import Course, Section


class RequirementsProvider(ABC):
    """Retrieves degree requirements for a given major."""

    @abstractmethod
    async def get_requirements(self, major_code: str, catalog_year: str) -> DegreeRequirements:
        ...

    @abstractmethod
    async def list_majors(self) -> list[dict]:
        ...


class CourseProvider(ABC):
    """Retrieves course catalog information."""

    @abstractmethod
    async def get_course(self, course_id: str) -> Course | None:
        ...

    @abstractmethod
    async def get_courses(self, course_ids: list[str]) -> list[Course]:
        ...

    @abstractmethod
    async def search_sections(self, course_id: str, semester: str) -> list[Section]:
        ...

    @abstractmethod
    async def search_all_sections(self, course_ids: list[str], semester: str) -> dict[str, list[Section]]:
        ...


class EquivalencyProvider(ABC):
    """Resolves AP / transfer credit equivalencies."""

    @abstractmethod
    async def resolve_ap(self, exam: str, score: int) -> list[dict]:
        ...

    @abstractmethod
    async def resolve_transfer(self, institution: str, course_id: str) -> dict | None:
        ...


class ProfessorRatingProvider(ABC):
    """Retrieves professor quality signals."""

    @abstractmethod
    async def get_rating(self, instructor: str, course_id: str = "") -> dict | None:
        ...


class SyllabusArchiveProvider(ABC):
    """Retrieves historical syllabus context for a course."""

    @abstractmethod
    async def get_course_context(self, course_id: str) -> dict | None:
        ...


class CommuteProvider(ABC):
    """Estimates commute/travel time."""

    @abstractmethod
    async def estimate_commute(self, origin: str, destination: str) -> float:
        """Returns estimated commute time in minutes."""
        ...


class CalendarProvider(ABC):
    """Manages calendar events."""

    @abstractmethod
    async def create_event(self, event: dict, calendar_id: str, credentials: dict) -> str:
        ...

    @abstractmethod
    async def create_events_batch(self, events: list[dict], calendar_id: str, credentials: dict) -> list[str]:
        ...
