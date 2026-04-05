"""Requirements Retrieval Agent — fetches and structures degree requirements."""
from __future__ import annotations
from app.models.degree import DegreeRequirements
from app.providers.asu_requirements import ASURequirementsProvider
from .base import BaseAgent


class RequirementsAgent(BaseAgent):
    name = "requirements_agent"
    system_prompt = (
        "You are an academic requirements specialist for Arizona State University. "
        "You help students understand their degree requirements clearly and accurately. "
        "Always cite the data source used. Never fabricate requirements."
    )

    def __init__(self):
        super().__init__()
        self.provider = ASURequirementsProvider()

    async def get_requirements(self, major_code: str, catalog_year: str) -> DegreeRequirements:
        """Retrieve structured degree requirements."""
        return await self.provider.get_requirements(major_code, catalog_year)

    async def explain_requirements(self, requirements: DegreeRequirements) -> str:
        """Generate a student-friendly summary of the requirements."""
        prompt = f"""Summarize these degree requirements for a student in 3-4 concise paragraphs.

Degree: {requirements.degree} in {requirements.major} at {requirements.university}
Total credits: {requirements.total_credits_required}
Min GPA: {requirements.minimum_gpa}
Residency credits: {requirements.residency_credits}
Upper-division credits: {requirements.upper_division_credits}

Categories:
{chr(10).join(f"- {c.display_name}: {c.credits_required} credits ({len(c.requirements)} requirements)" for c in requirements.categories)}

Important notes: {'; '.join(requirements.notes)}

Write a warm, encouraging summary that helps the student understand:
1. The overall structure
2. Key milestones
3. Any important rules (GPA, residency)
Keep it under 200 words."""

        return await self._generate(prompt)
