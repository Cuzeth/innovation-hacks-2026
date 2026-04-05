"""Calendar Execution Agent — creates Google Calendar events for approved schedule."""
from __future__ import annotations
from datetime import datetime, timedelta
from app.models.schedule import ProposedSchedule, CalendarEvent, CalendarExportRequest, CalendarExportResult
from app.providers.google_calendar import GoogleCalendarProvider, MockCalendarProvider
from app.providers.google_maps import GoogleMapsCommuteProvider
from app.config import get_settings
from .base import BaseAgent

# Map day abbreviations to iCalendar day names and Python weekday numbers
DAY_MAP = {
    "Mon": ("MO", 0), "Tue": ("TU", 1), "Wed": ("WE", 2),
    "Thu": ("TH", 3), "Fri": ("FR", 4), "Sat": ("SA", 5), "Sun": ("SU", 6),
}

# Semester date ranges (approximate)
SEMESTER_DATES = {
    "Fall 2026": {"start": "2026-08-20", "end": "2026-12-04"},
    "Spring 2027": {"start": "2027-01-11", "end": "2027-04-30"},
    "Fall 2027": {"start": "2027-08-19", "end": "2027-12-03"},
    "Spring 2028": {"start": "2028-01-10", "end": "2028-04-28"},
}


class CalendarAgent(BaseAgent):
    name = "calendar_agent"
    system_prompt = (
        "You are a scheduling assistant that creates Google Calendar events "
        "for ASU class schedules, including commute buffer time."
    )

    def __init__(self):
        super().__init__()
        settings = get_settings()
        self.commute_provider = GoogleMapsCommuteProvider()
        if settings.google_client_id and settings.google_client_secret:
            self.calendar_provider = GoogleCalendarProvider()
        else:
            self.calendar_provider = MockCalendarProvider()

    def generate_events(self, schedule: ProposedSchedule, include_commute: bool = True) -> list[CalendarEvent]:
        """Convert a schedule to calendar events."""
        events: list[CalendarEvent] = []
        semester_dates = SEMESTER_DATES.get(schedule.semester, {"start": "2026-08-20", "end": "2026-12-04"})
        sem_start = datetime.strptime(semester_dates["start"], "%Y-%m-%d")
        sem_end = datetime.strptime(semester_dates["end"], "%Y-%m-%d")
        meetings_by_day: dict[str, list[dict]] = {}

        for entry in schedule.entries:
            section = entry.section.section
            for mt in section.meeting_times:
                # Find the first occurrence of each meeting day
                ical_days = []
                for day_abbr in mt.days:
                    ical_day, py_weekday = DAY_MAP.get(day_abbr, ("MO", 0))
                    ical_days.append(ical_day)

                # Calculate first meeting date
                first_day_abbr = mt.days[0]
                _, py_weekday = DAY_MAP.get(first_day_abbr, ("MO", 0))
                first_date = sem_start
                while first_date.weekday() != py_weekday:
                    first_date += timedelta(days=1)

                # Build recurrence rule
                rrule = f"RRULE:FREQ=WEEKLY;BYDAY={','.join(ical_days)};UNTIL={sem_end.strftime('%Y%m%dT235959Z')}"

                # Class event
                start_dt = f"{first_date.strftime('%Y-%m-%d')}T{mt.start_time}:00"
                end_dt = f"{first_date.strftime('%Y-%m-%d')}T{mt.end_time}:00"

                location = mt.location
                if mt.building:
                    location = f"{mt.building}, ASU {mt.campus} Campus"

                events.append(CalendarEvent(
                    summary=f"{section.course_id}: {section.title}",
                    description=(
                        f"Instructor: {section.instructor}\n"
                        f"Section: {section.section_id}\n"
                        f"Modality: {section.modality}\n"
                        f"Room: {mt.location}"
                    ),
                    location=location,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    recurrence=[rrule],
                    color_id="9",  # Blueberry
                    is_commute_block=False,
                ))
                for day_abbr in mt.days:
                    meetings_by_day.setdefault(day_abbr, []).append(
                        {
                            "entry": entry,
                            "section": section,
                            "meeting": mt,
                            "location": location,
                            "day_abbr": day_abbr,
                        }
                    )

        if include_commute:
            for day_abbr, meetings in meetings_by_day.items():
                meetings.sort(key=lambda item: _time_to_minutes(item["meeting"].start_time))
                first_date = _first_date_for_day(sem_start, day_abbr)
                rrule = _recurrence_for_day(day_abbr, sem_end)

                in_person = [meeting for meeting in meetings if meeting["section"].modality != "online"]
                if not in_person:
                    continue

                first_meeting = in_person[0]
                commute_before = int(first_meeting["entry"].commute_before_minutes)
                if commute_before > 0:
                    start_minutes = _time_to_minutes(first_meeting["meeting"].start_time) - commute_before
                    start_time = _minutes_to_time(start_minutes)
                    events.append(CalendarEvent(
                        summary=f"Commute → {first_meeting['section'].course_id}",
                        description=f"Travel to {first_meeting['location']} before class.",
                        location="",
                        start_datetime=f"{first_date.strftime('%Y-%m-%d')}T{start_time}:00",
                        end_datetime=f"{first_date.strftime('%Y-%m-%d')}T{first_meeting['meeting'].start_time}:00",
                        recurrence=[rrule],
                        color_id="6",
                        is_commute_block=True,
                    ))

                for idx in range(len(in_person) - 1):
                    current = in_person[idx]
                    upcoming = in_person[idx + 1]
                    current_end = _time_to_minutes(current["meeting"].end_time)
                    next_start = _time_to_minutes(upcoming["meeting"].start_time)
                    if next_start <= current_end:
                        continue
                    required_minutes = int(
                        self.commute_provider.estimate_campus_walk(
                            current["location"], upcoming["location"]
                        )
                    )
                    if required_minutes <= 0:
                        continue
                    block_end = min(next_start, current_end + required_minutes)
                    events.append(CalendarEvent(
                        summary=f"Walk to {upcoming['section'].course_id}",
                        description=(
                            f"Transition from {current['section'].course_id} to {upcoming['section'].course_id}."
                        ),
                        location="",
                        start_datetime=f"{first_date.strftime('%Y-%m-%d')}T{_minutes_to_time(current_end)}:00",
                        end_datetime=f"{first_date.strftime('%Y-%m-%d')}T{_minutes_to_time(block_end)}:00",
                        recurrence=[rrule],
                        color_id="5",
                        is_commute_block=True,
                    ))

                last_meeting = in_person[-1]
                commute_after = int(last_meeting["entry"].commute_after_minutes)
                if commute_after > 0:
                    last_end = _time_to_minutes(last_meeting["meeting"].end_time)
                    events.append(CalendarEvent(
                        summary=f"Commute home ← {last_meeting['section'].course_id}",
                        description="Return commute block after your last on-campus class.",
                        location="",
                        start_datetime=f"{first_date.strftime('%Y-%m-%d')}T{last_meeting['meeting'].end_time}:00",
                        end_datetime=f"{first_date.strftime('%Y-%m-%d')}T{_minutes_to_time(last_end + commute_after)}:00",
                        recurrence=[rrule],
                        color_id="6",
                        is_commute_block=True,
                    ))

        return events

    async def export_to_calendar(
        self,
        schedule: ProposedSchedule,
        credentials: dict,
        include_commute: bool = True,
        calendar_id: str = "primary",
    ) -> CalendarExportResult:
        """Export schedule events to Google Calendar."""
        events = self.generate_events(schedule, include_commute)

        # Convert to Google Calendar API format
        api_events = []
        for ev in events:
            timezone = "America/Phoenix"  # ASU timezone (no DST)
            api_event = {
                "summary": ev.summary,
                "description": ev.description,
                "location": ev.location,
                "start": {"dateTime": ev.start_datetime, "timeZone": timezone},
                "end": {"dateTime": ev.end_datetime, "timeZone": timezone},
                "recurrence": ev.recurrence,
                "colorId": ev.color_id,
            }
            api_events.append(api_event)

        try:
            event_ids = await self.calendar_provider.create_events_batch(
                api_events, calendar_id, credentials
            )
            return CalendarExportResult(
                success=True,
                events_created=len(event_ids),
                event_ids=event_ids,
                calendar_url=f"https://calendar.google.com/calendar/r",
                message=f"Successfully created {len(event_ids)} calendar events ({len([e for e in events if not e.is_commute_block])} classes + {len([e for e in events if e.is_commute_block])} commute blocks)",
            )
        except Exception as e:
            return CalendarExportResult(
                success=False,
                message=f"Failed to export to calendar: {str(e)}",
            )


def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _minutes_to_time(minutes: int) -> str:
    minutes = max(0, minutes)
    hours, mins = divmod(minutes, 60)
    return f"{hours:02d}:{mins:02d}"


def _first_date_for_day(semester_start: datetime, day_abbr: str) -> datetime:
    _, py_weekday = DAY_MAP.get(day_abbr, ("MO", 0))
    first_date = semester_start
    while first_date.weekday() != py_weekday:
        first_date += timedelta(days=1)
    return first_date


def _recurrence_for_day(day_abbr: str, semester_end: datetime) -> str:
    ical_day, _ = DAY_MAP.get(day_abbr, ("MO", 0))
    return f"RRULE:FREQ=WEEKLY;BYDAY={ical_day};UNTIL={semester_end.strftime('%Y%m%dT235959Z')}"
