"""Auth routes — Google OAuth for calendar integration."""
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from app.config import get_settings

router = APIRouter()

# In-memory token store (demo)
_tokens: dict[str, dict] = {}


@router.get("/google/login")
async def google_login():
    """Redirect to Google OAuth consent screen for Calendar access."""
    settings = get_settings()
    if not settings.google_client_id:
        return {"error": "Google OAuth not configured. Calendar export will use mock mode."}

    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uris": [settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/calendar.events"],
        redirect_uri=settings.google_redirect_uri,
    )
    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    return {"auth_url": auth_url}


@router.get("/google/callback")
async def google_callback(code: str):
    """Handle Google OAuth callback."""
    settings = get_settings()
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uris": [settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/calendar.events"],
        redirect_uri=settings.google_redirect_uri,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials
    _tokens["demo-student"] = {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
    }
    return RedirectResponse(url=f"{settings.frontend_url}/calendar?auth=success")


@router.get("/google/status")
async def google_status():
    """Check if Google Calendar auth is available."""
    settings = get_settings()
    has_tokens = "demo-student" in _tokens
    has_config = bool(settings.google_client_id)
    return {
        "configured": has_config,
        "authenticated": has_tokens,
        "mock_mode": not has_config,
    }


def get_credentials(student_id: str = "demo-student") -> dict:
    """Get stored credentials for a student."""
    return _tokens.get(student_id, {})
