"""Persistence helpers for student profiles and workflow snapshots."""
from __future__ import annotations

import json
from pathlib import Path

from app.agents.orchestrator import AgentStep, WorkflowState
from app.contracts import WorkflowSnapshot
from app.models.degree import DegreeAudit
from app.models.plan import AcademicPlan
from app.models.schedule import CalendarExportResult, ProposedSchedule
from app.models.student import CompletedCourse, StudentPreferences, StudentProfile

from .models import StudentProfileRecord, WorkflowSnapshotRecord
from .session import session_scope

DATA_DIR = Path(__file__).parent.parent / "data"


def _model_to_json(model) -> str:
    return json.dumps(model.model_dump())


def _model_from_json(model_cls, raw: str):
    return model_cls.model_validate(json.loads(raw))


def load_demo_profile() -> StudentProfile:
    with open(DATA_DIR / "sample_student.json") as f:
        data = json.load(f)

    student = StudentProfile(
        id=data["id"],
        name=data["name"],
        email=data.get("email", ""),
        university=data["university"],
        major=data["major"],
        major_code=data["major_code"],
        catalog_year=data.get("catalog_year", "2024-2025"),
        current_semester=data.get("current_semester", "Fall 2026"),
        completed_courses=[CompletedCourse(**c) for c in data.get("completed_courses", [])],
        preferences=StudentPreferences(**data.get("preferences", {})),
    )
    student.compute_credits()
    return student


def get_student_profile(student_id: str = "demo-student") -> StudentProfile | None:
    with session_scope() as session:
        record = session.get(StudentProfileRecord, student_id)
        if not record:
            return None
        return _model_from_json(StudentProfile, record.profile_json)


def upsert_student_profile(profile: StudentProfile) -> StudentProfile:
    profile.compute_credits()
    payload = _model_to_json(profile)

    with session_scope() as session:
        record = session.get(StudentProfileRecord, profile.id)
        if record is None:
            record = StudentProfileRecord(
                id=profile.id,
                name=profile.name,
                email=profile.email,
                university=profile.university,
                major=profile.major,
                major_code=profile.major_code,
                catalog_year=profile.catalog_year,
                current_semester=profile.current_semester,
                profile_json=payload,
            )
            session.add(record)
        else:
            record.name = profile.name
            record.email = profile.email
            record.university = profile.university
            record.major = profile.major
            record.major_code = profile.major_code
            record.catalog_year = profile.catalog_year
            record.current_semester = profile.current_semester
            record.profile_json = payload

    return profile


def ensure_demo_profile(student_id: str = "demo-student") -> StudentProfile:
    profile = get_student_profile(student_id)
    if profile:
        return profile
    return upsert_student_profile(load_demo_profile())


def delete_student_profile(student_id: str = "demo-student"):
    with session_scope() as session:
        snapshot = session.get(WorkflowSnapshotRecord, student_id)
        if snapshot is not None:
            session.delete(snapshot)
        record = session.get(StudentProfileRecord, student_id)
        if record is not None:
            session.delete(record)


def save_workflow_state(student_id: str, state: WorkflowState, status: str = "completed"):
    snapshot = WorkflowSnapshot(
        student=state.student,
        audit=state.audit,
        plan=state.plan,
        schedules=state.schedules,
        selected_schedule_id=state.selected_schedule.id if state.selected_schedule else "",
        calendar_result=state.calendar_result,
        agent_log=state.agent_log,
    )

    with session_scope() as session:
        record = session.get(WorkflowSnapshotRecord, student_id)
        if record is None:
            record = WorkflowSnapshotRecord(student_id=student_id)
            session.add(record)

        record.status = status
        record.audit_json = _model_to_json(snapshot.audit) if snapshot.audit else ""
        record.plan_json = _model_to_json(snapshot.plan) if snapshot.plan else ""
        record.schedules_json = json.dumps([s.model_dump() for s in snapshot.schedules])
        record.agent_log_json = json.dumps([step.model_dump() for step in snapshot.agent_log])
        record.selected_schedule_id = snapshot.selected_schedule_id
        record.calendar_result_json = (
            _model_to_json(snapshot.calendar_result) if snapshot.calendar_result else ""
        )


def get_workflow_state(student_id: str = "demo-student") -> WorkflowState | None:
    student = get_student_profile(student_id)
    if not student:
        return None

    with session_scope() as session:
        record = session.get(WorkflowSnapshotRecord, student_id)
        if not record:
            return None
        audit_json = record.audit_json
        plan_json = record.plan_json
        schedules_json = record.schedules_json
        agent_log_json = record.agent_log_json
        selected_schedule_id = record.selected_schedule_id
        calendar_result_json = record.calendar_result_json

    state = WorkflowState(student)
    if audit_json:
        state.audit = _model_from_json(DegreeAudit, audit_json)
    if plan_json:
        state.plan = _model_from_json(AcademicPlan, plan_json)
    if schedules_json:
        state.schedules = [ProposedSchedule.model_validate(item) for item in json.loads(schedules_json)]
    if agent_log_json:
        state.agent_log = [AgentStep.model_validate(item) for item in json.loads(agent_log_json)]
    if selected_schedule_id:
        state.selected_schedule = next(
            (schedule for schedule in state.schedules if schedule.id == selected_schedule_id),
            None,
        )
    if calendar_result_json:
        state.calendar_result = _model_from_json(CalendarExportResult, calendar_result_json)
    return state


def clear_workflow_state(student_id: str = "demo-student"):
    with session_scope() as session:
        record = session.get(WorkflowSnapshotRecord, student_id)
        if record is not None:
            session.delete(record)
