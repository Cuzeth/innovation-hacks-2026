"""Google Calendar integration provider."""
from __future__ import annotations
from .base import CalendarProvider


class GoogleCalendarProvider(CalendarProvider):
    """Creates Google Calendar events via the Calendar API."""

    async def create_event(self, event: dict, calendar_id: str, credentials: dict) -> str:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=credentials.get("access_token"),
            refresh_token=credentials.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=credentials.get("client_id"),
            client_secret=credentials.get("client_secret"),
        )
        service = build("calendar", "v3", credentials=creds)
        result = service.events().insert(calendarId=calendar_id, body=event).execute()
        return result.get("id", "")

    async def create_events_batch(self, events: list[dict], calendar_id: str, credentials: dict) -> list[str]:
        ids = []
        for event in events:
            eid = await self.create_event(event, calendar_id, credentials)
            ids.append(eid)
        return ids


class MockCalendarProvider(CalendarProvider):
    """Mock calendar provider for demo without Google OAuth."""

    async def create_event(self, event: dict, calendar_id: str, credentials: dict) -> str:
        import uuid
        return f"mock-event-{uuid.uuid4().hex[:8]}"

    async def create_events_batch(self, events: list[dict], calendar_id: str, credentials: dict) -> list[str]:
        ids = []
        for event in events:
            eid = await self.create_event(event, calendar_id, credentials)
            ids.append(eid)
        return ids
