"""Database tables for the demo application."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class StudentProfileRecord(Base):
    __tablename__ = "student_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    university: Mapped[str] = mapped_column(String(255), default="Arizona State University")
    major: Mapped[str] = mapped_column(String(255), default="")
    major_code: Mapped[str] = mapped_column(String(64), index=True, default="")
    catalog_year: Mapped[str] = mapped_column(String(32), default="2024-2025")
    current_semester: Mapped[str] = mapped_column(String(32), default="Fall 2026")
    profile_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class WorkflowSnapshotRecord(Base):
    __tablename__ = "workflow_snapshots"

    student_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("student_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[str] = mapped_column(String(32), default="ready")
    audit_json: Mapped[str] = mapped_column(Text, default="")
    plan_json: Mapped[str] = mapped_column(Text, default="")
    schedules_json: Mapped[str] = mapped_column(Text, default="[]")
    agent_log_json: Mapped[str] = mapped_column(Text, default="[]")
    selected_schedule_id: Mapped[str] = mapped_column(String(64), default="")
    calendar_result_json: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
