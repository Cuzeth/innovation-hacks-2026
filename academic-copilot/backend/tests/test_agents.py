"""Tests for agent logic (non-AI parts — no Gemini API key needed)."""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.student import StudentProfile, CompletedCourse, StudentPreferences
from app.models.degree import DegreeRequirements, RequirementStatus
from app.models.plan import SemesterPlan, PlannedCourse
from app.providers.asu_requirements import ASURequirementsProvider
from app.agents.credit_eval import CreditEvaluationAgent
from app.agents.planner import PlanningAgent
from app.agents.section_ranker import SectionRankingAgent


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


def test_what_if_failure_for_upcoming_course():
    """Test failure simulation for an upcoming bottleneck course."""
    student = _load_sample_student()
    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))

    eval_agent = CreditEvaluationAgent()
    audit = asyncio.run(eval_agent.evaluate(student, reqs))

    planner = PlanningAgent()
    baseline = asyncio.run(planner.generate_plan(student, audit))
    analysis = asyncio.run(
        planner.analyze_failure_scenario(
            student,
            audit,
            baseline,
            "CSE 330",
            "What if I fail CSE 330?",
        )
    )

    assert analysis.target_course_id == "CSE 330"
    assert analysis.target_context == "upcoming"
    assert planner._semester_rank(analysis.scenario_graduation_term) >= planner._semester_rank(analysis.baseline_graduation_term)
    assert "CSE 485" in analysis.blocked_courses or "CSE 485" in analysis.impacted_courses
    assert len(analysis.recovery_actions) > 0

    print("  what_if_upcoming_course: PASS")
    print(f"    Delay: {analysis.delay_semesters} semester(s)")
    print(f"    Blocked: {analysis.blocked_courses}")


def test_what_if_failure_for_in_progress_course():
    """Test failure simulation for an in-progress course."""
    student = _load_sample_student()
    student.completed_courses.append(
        CompletedCourse(
            course_id="CSE 330",
            title="Operating Systems",
            credits=3,
            grade="NR",
            semester="Fall 2026",
            source="asu",
        )
    )
    student.compute_credits()

    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))

    eval_agent = CreditEvaluationAgent()
    audit = asyncio.run(eval_agent.evaluate(student, reqs))

    planner = PlanningAgent()
    baseline = asyncio.run(planner.generate_plan(student, audit))
    analysis = asyncio.run(
        planner.analyze_failure_scenario(
            student,
            audit,
            baseline,
            "CSE 330",
            "What if I fail my in-progress CSE 330 course?",
        )
    )

    assert analysis.target_context == "in_progress"
    assert planner._semester_rank(analysis.scenario_graduation_term) >= planner._semester_rank(analysis.baseline_graduation_term)
    assert len(analysis.recovery_actions) > 0

    print("  what_if_in_progress_course: PASS")
    print(f"    Delay: {analysis.delay_semesters} semester(s)")
    print(f"    Scenario term: {analysis.scenario_graduation_term}")


def test_course_id_normalization_prevents_repeat_suggestions():
    """Messy course IDs should still count as completed."""
    student = _load_sample_student()
    student.completed_courses.append(
        CompletedCourse(
            course_id="cse360",
            title="Introduction to Software Engineering",
            credits=3,
            grade="A",
            semester="Spring 2026",
            source="asu",
        )
    )
    student.compute_credits()

    provider = ASURequirementsProvider()
    reqs = asyncio.run(provider.get_requirements("ESCSCI", "2024-2025"))
    audit = asyncio.run(CreditEvaluationAgent().evaluate(student, reqs))
    planner = PlanningAgent()
    plan = asyncio.run(planner.generate_plan(student, audit))

    assert not any(
        course.course_id == "CSE 360"
        for semester in plan.recommended_path.semesters
        for course in semester.courses
    )

    print("  course_id_normalization: PASS")


def test_schedule_ranker_filters_completed_courses():
    """Schedule ranking should never re-recommend a completed course."""
    student = _load_sample_student()
    student.completed_courses.append(
        CompletedCourse(
            course_id="CSE 360",
            title="Introduction to Software Engineering",
            credits=3,
            grade="A",
            semester="Spring 2026",
            source="asu",
        )
    )
    next_semester = SemesterPlan(
        semester="Fall 2026",
        courses=[
            PlannedCourse(course_id="CSE 360", title="Introduction to Software Engineering", credits=3),
            PlannedCourse(course_id="CSE 330", title="Operating Systems", credits=3),
        ],
        total_credits=6,
    )

    schedules = asyncio.run(SectionRankingAgent().rank_schedules(student, next_semester))

    assert len(schedules) > 0
    assert all(
        all(entry.section.section.course_id != "CSE 360" for entry in schedule.entries)
        for schedule in schedules
    )

    print("  schedule_ranker_filter: PASS")


if __name__ == "__main__":
    print("Running agent tests (no API key needed)...")
    test_credit_evaluation()
    test_planner_remaining_courses()
    test_bottleneck_detection()
    test_what_if_failure_for_upcoming_course()
    test_what_if_failure_for_in_progress_course()
    test_course_id_normalization_prevents_repeat_suggestions()
    test_schedule_ranker_filters_completed_courses()
    print("All agent tests passed!")
