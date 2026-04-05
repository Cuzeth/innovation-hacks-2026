"""Base agent class with Gemini integration."""
from __future__ import annotations
import json
import logging
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger(__name__)


class BaseAgent:
    """Base class for all agents. Provides Gemini chat and structured output."""

    name: str = "base"
    system_prompt: str = ""

    def __init__(self):
        settings = get_settings()
        self._api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self._api_key:
                raise ValueError("GEMINI_API_KEY is required for AI features")
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def _generate(self, prompt: str, response_schema: dict | None = None) -> str:
        """Call Gemini with a prompt and optional JSON schema for structured output."""
        config_kwargs: dict = {}
        if self.system_prompt:
            config_kwargs["system_instruction"] = self.system_prompt

        if response_schema:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = response_schema

        config = types.GenerateContentConfig(**config_kwargs)

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            logger.error(f"Agent {self.name} Gemini call failed: {e}")
            raise

    async def _generate_json(self, prompt: str, response_schema: dict | None = None) -> dict:
        """Call Gemini and parse JSON response."""
        text = await self._generate(prompt, response_schema)
        # Strip markdown code fences if present
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)
