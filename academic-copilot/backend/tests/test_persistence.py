"""Tests for persistence and calendar preview flows."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agents.calendar import CalendarAgent
from app.agents.orchestrator import WorkflowState
from app.db import init_db
from app.db.repository import (
    clear_workflow_state,
    delete_student_profile,
    ensure_demo_profile,
    get_workflow_state,
    save_workflow_state,
)
from app.models.course import SectionWithScore
from app.models.schedule import ProposedSchedule, ScheduleEntry
from app.providers.asu_courses import ASUCourseProvider


def _build_demo_schedule() -> ProposedSchedule:
    provider = ASUCourseProvider()
    cse330 = asyncio.run(provider.search_sections("CSE 330", "Fall 2026"))[0]
    cse340 = asyncio.run(provider.search_sections("CSE 340", "Fall 2026"))[0]

    return ProposedSchedule(
        id="schedule-1",
        name="Best Overall",
        semester="Fall 2026",
        entries=[
            ScheduleEntry(
                section=SectionWithScore(section=cse330, score=0.91, commute_minutes=15),
                commute_before_minutes=15,
                commute_after_minutes=15,
            ),
            ScheduleEntry(
                section=SectionWithScore(section=cse340, score=0.89, commute_minutes=15),
                commute_before_minutes=15,
                commute_after_minutes=15,
            ),
        ],
        total_credits=6,
        overall_score=0.9,
        weekly_commute_minutes=120,
    )


def test_workflow_persistence():
    init_db()
    delete_student_profile("demo-student")
    clear_workflow_state("demo-student")

    student = ensure_demo_profile("demo-student")
    schedule = _build_demo_schedule()
    state = WorkflowState(student)
    state.schedules = [schedule]
    state.selected_schedule = schedule
    state.add_step("orchestrator", "Loaded persisted student context", "completed")

    save_workflow_state(student.id, state)
    restored = get_workflow_state(student.id)

    assert restored is not None
    assert restored.student.id == student.id
    assert restored.selected_schedule is not None
    assert restored.selected_schedule.id == schedule.id
    assert len(restored.agent_log) == 1

    print("  workflow_persistence: PASS")


def test_calendar_preview_blocks():
    schedule = _build_demo_schedule()
    agent = CalendarAgent()
    events = agent.generate_events(schedule, include_commute=True)

    class_events = [event for event in events if not event.is_commute_block]
    commute_events = [event for event in events if event.is_commute_block]

    assert len(class_events) == 2
    assert len(commute_events) >= 2
    assert any("Commute →" in event.summary for event in commute_events)
    assert any("Commute home" in event.summary for event in commute_events)

    print("  calendar_preview_blocks: PASS")


if __name__ == "__main__":
    print("Running persistence tests...")
    test_workflow_persistence()
    test_calendar_preview_blocks()
    print("All persistence tests passed!")
