"""Tests for data providers."""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.providers.asu_requirements import ASURequirementsProvider
from app.providers.asu_courses import ASUCourseProvider
from app.providers.ap_equivalency import ASUEquivalencyProvider


def test_requirements_provider():
    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))

    assert reqs.university == "Arizona State University"
    assert reqs.major == "Computer Science"
    assert reqs.total_credits_required == 120
    assert len(reqs.categories) == 6

    # Check category names
    cat_names = [c.name for c in reqs.categories]
    assert "major_core" in cat_names
    assert "math" in cat_names
    assert "science" in cat_names
    assert "general_studies" in cat_names

    # Check major core has right number of courses
    major_core = next(c for c in reqs.categories if c.name == "major_core")
    assert len(major_core.requirements) == 13  # 13 core CS courses

    print("  requirements_provider: PASS")


def test_course_provider():
    provider = ASUCourseProvider()

    # Test single course
    course = asyncio.run(provider.get_course("CSE 310"))
    assert course is not None
    assert course.title == "Data Structures and Algorithms"
    assert course.credits == 3
    assert len(course.prerequisites) >= 2

    # Test sections
    sections = asyncio.run(provider.search_sections("CSE 330", "Fall 2026"))
    assert len(sections) >= 2

    # Test bulk sections
    all_secs = asyncio.run(
        provider.search_all_sections(["CSE 330", "CSE 340", "CSE 355"], "Fall 2026")
    )
    assert "CSE 330" in all_secs
    assert "CSE 340" in all_secs

    print("  course_provider: PASS")


def test_equivalency_provider():
    provider = ASUEquivalencyProvider()

    # AP Calculus BC → MAT 265 + MAT 266
    result = asyncio.run(provider.resolve_ap("AP Calculus BC", 5))
    assert len(result) >= 1
    assert result[0]["asu_equivalent"] in ("MAT 265+MAT 266", "MAT 265")

    # AP CS A → CSE 110
    result = asyncio.run(provider.resolve_ap("AP Computer Science A", 4))
    assert len(result) >= 1
    assert result[0]["asu_equivalent"] == "CSE 110"

    # Transfer from Maricopa
    result = asyncio.run(provider.resolve_transfer("Maricopa", "CSC 110"))
    assert result is not None
    assert result["asu_equivalent"] == "CSE 110"

    print("  equivalency_provider: PASS")


if __name__ == "__main__":
    print("Running provider tests...")
    test_requirements_provider()
    test_course_provider()
    test_equivalency_provider()
    print("All provider tests passed!")
