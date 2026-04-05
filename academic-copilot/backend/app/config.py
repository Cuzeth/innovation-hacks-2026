from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Academic Copilot"
    debug: bool = False

    # Persistence
    database_url: str = "sqlite:///./academic_copilot.db"

    # Gemini / Vertex AI
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Google Calendar
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/api/auth/callback"

    # Google Maps
    google_maps_api_key: str = ""

    # CORS
    frontend_url: str = "http://localhost:3000"

    # Data paths
    data_dir: str = "app/data"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
