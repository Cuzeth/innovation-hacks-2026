"""Tests for agent logic (non-AI parts — no Gemini API key needed)."""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.student import StudentProfile, CompletedCourse, StudentPreferences
from app.models.degree import DegreeRequirements, RequirementStatus
from app.providers.asu_requirements import ASURequirementsProvider
from app.agents.credit_eval import CreditEvaluationAgent
from app.agents.planner import PlanningAgent


def _load_sample_student() -> StudentProfile:
    data_path = os.path.join(os.path.dirname(__file__), "..", "app", "data", "sample_student.json")
    with open(data_path) as f:
        data = json.load(f)
    courses = [CompletedCourse(**c) for c in data["completed_courses"]]
    prefs = StudentPreferences(**data["preferences"])
    student = StudentProfile(
        id=data["id"],
        name=data["name"],
        university=data["university"],
        major=data["major"],
        major_code=data["major_code"],
        completed_courses=courses,
        preferences=prefs,
    )
    student.compute_credits()
    return student


def test_credit_evaluation():
    """Test credit evaluation without AI (evaluates the matching logic)."""
    student = _load_sample_student()
    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))

    agent = CreditEvaluationAgent()
    audit = asyncio.run(agent.evaluate(student, reqs))

    assert audit.total_credits_completed > 0
    assert audit.overall_progress_pct > 0
    assert audit.fulfilled_count > 0

    # CSE 110 should be fulfilled
    cse110_exp = next((e for e in audit.explanations if "Introduction to Programming" in e.requirement_name), None)
    assert cse110_exp is not None
    assert cse110_exp.status == RequirementStatus.FULFILLED.value or cse110_exp.status == "fulfilled"

    # MAT 265 should be fulfilled (AP credit)
    mat265_exp = next((e for e in audit.explanations if "Calculus I" in e.requirement_name), None)
    assert mat265_exp is not None
    assert mat265_exp.status == "fulfilled"

    # CSE 330 should be unmet (not in completed courses)
    cse330_exp = next((e for e in audit.explanations if "Operating Systems" in e.requirement_name), None)
    assert cse330_exp is not None
    assert cse330_exp.status == "unmet"

    print("  credit_evaluation: PASS")
    print(f"    Progress: {audit.overall_progress_pct}%")
    print(f"    Fulfilled: {audit.fulfilled_count}, Partial: {audit.partial_count}, Unmet: {audit.unmet_count}")


def test_planner_remaining_courses():
    """Test that the planner correctly identifies remaining courses."""
    student = _load_sample_student()
    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))

    eval_agent = CreditEvaluationAgent()
    audit = asyncio.run(eval_agent.evaluate(student, reqs))

    planner = PlanningAgent()
    remaining = planner._get_remaining_courses(audit)

    # CSE 330 should be in remaining
    assert "CSE 330" in remaining, f"CSE 330 should be remaining, got: {remaining}"
    # CSE 110 should NOT be remaining
    assert "CSE 110" not in remaining

    print("  planner_remaining: PASS")
    print(f"    Remaining courses: {len(remaining)}")
    print(f"    Courses: {sorted(remaining.keys())}")


def test_bottleneck_detection():
    """Test prerequisite bottleneck detection."""
    student = _load_sample_student()
    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))

    eval_agent = CreditEvaluationAgent()
    audit = asyncio.run(eval_agent.evaluate(student, reqs))

    planner = PlanningAgent()
    remaining = planner._get_remaining_courses(audit)
    from app.providers.asu_courses import ASUCourseProvider
    course_provider = ASUCourseProvider()
    courses = asyncio.run(course_provider.get_courses(list(remaining.keys())))
    course_map = {c.course_id: c for c in courses}
    completed_ids = {c.course_id for c in student.completed_courses}

    bottlenecks = planner._detect_bottlenecks(course_map, remaining, completed_ids)

    # There should be at least one bottleneck
    assert len(bottlenecks) > 0, "Expected at least one bottleneck"

    print("  bottleneck_detection: PASS")
    for bn in bottlenecks[:3]:
        print(f"    {bn.course_id}: blocks {bn.blocks}, depth {bn.depth}")


if __name__ == "__main__":
    print("Running agent tests (no API key needed)...")
    test_credit_evaluation()
    test_planner_remaining_courses()
    test_bottleneck_detection()
    print("All agent tests passed!")
