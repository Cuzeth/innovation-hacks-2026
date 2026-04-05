"""Section Ranking Agent — finds and ranks course sections for the next semester."""
from __future__ import annotations
import itertools
from app.models.student import StudentProfile, ScheduleStyle
from app.models.course import Section, SectionWithScore, MeetingTime
from app.models.plan import SemesterPlan
from app.models.schedule import ProposedSchedule, ScheduleEntry
from app.providers.asu_courses import ASUCourseProvider
from app.providers.google_maps import GoogleMapsCommuteProvider
from .base import BaseAgent


def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


class SectionRankingAgent(BaseAgent):
    name = "section_ranking_agent"
    system_prompt = (
        "You are an expert schedule optimizer for ASU students. "
        "You rank course sections based on timing, professor quality, modality, "
        "commute time, and overall schedule compactness."
    )

    def __init__(self):
        super().__init__()
        self.course_provider = ASUCourseProvider()
        self.commute_provider = GoogleMapsCommuteProvider()

    async def rank_schedules(
        self,
        student: StudentProfile,
        next_semester: SemesterPlan,
    ) -> list[ProposedSchedule]:
        """Find sections and generate ranked schedule proposals."""
        course_ids = [c.course_id for c in next_semester.courses]
        semester = next_semester.semester

        # 1. Fetch all available sections
        all_sections = await self.course_provider.search_all_sections(course_ids, semester)

        # 2. Score each section individually
        scored_sections: dict[str, list[SectionWithScore]] = {}
        for cid, sections in all_sections.items():
            scored = []
            for section in sections:
                s = await self._score_section(section, student)
                scored.append(s)
            scored.sort(key=lambda x: -x.score)
            scored_sections[cid] = scored

        # 3. Generate schedule combinations (limited for performance)
        schedules = self._generate_schedules(scored_sections, student, semester)

        # 4. Use Gemini to explain top schedules
        for sched in schedules[:3]:
            sched.explanation = await self._explain_schedule(sched, student)

        return schedules

    async def _score_section(self, section: Section, student: StudentProfile) -> SectionWithScore:
        """Score a single section based on student preferences."""
        prefs = student.preferences
        time_score = self._score_time(section.meeting_times, prefs.preferred_start_time, prefs.preferred_end_time)
        day_score = self._score_days(section.meeting_times, prefs.avoid_days)
        modality_score = self._score_modality(section.modality, prefs.modality.value)
        instructor_score = self._score_instructor(section.instructor_rating, prefs.min_professor_rating)

        # Commute
        commute_minutes = None
        if section.modality == "in_person" and section.meeting_times:
            loc = section.meeting_times[0].building or section.meeting_times[0].location
            if loc and prefs.home_address:
                commute_minutes = await self.commute_provider.estimate_commute(prefs.home_address, loc)

        # Weighted total
        total = (
            time_score * 0.30 +
            day_score * 0.15 +
            modality_score * 0.15 +
            instructor_score * 0.25 +
            (1.0 - min(1.0, (commute_minutes or 0) / 30.0)) * 0.15
        )

        explanation = (
            f"{section.course_id} ({section.section_id}): "
            f"Time={time_score:.0%}, Days={day_score:.0%}, "
            f"Modality={modality_score:.0%}, Instructor={instructor_score:.0%}"
        )
        if commute_minutes is not None:
            explanation += f", Commute={commute_minutes:.0f}min"

        return SectionWithScore(
            section=section,
            score=round(total, 3),
            time_score=round(time_score, 3),
            day_score=round(day_score, 3),
            modality_score=round(modality_score, 3),
            compactness_score=0.0,
            instructor_score=round(instructor_score, 3),
            commute_minutes=commute_minutes,
            explanation=explanation,
        )

    def _score_time(self, meetings: list[MeetingTime], pref_start: str, pref_end: str) -> float:
        if not meetings:
            return 0.5
        start_min = _time_to_minutes(pref_start)
        end_min = _time_to_minutes(pref_end)
        score = 1.0
        for m in meetings:
            m_start = _time_to_minutes(m.start_time)
            m_end = _time_to_minutes(m.end_time)
            if m_start < start_min:
                score -= min(0.5, (start_min - m_start) / 120)
            if m_end > end_min:
                score -= min(0.5, (m_end - end_min) / 120)
        return max(0.0, score)

    def _score_days(self, meetings: list[MeetingTime], avoid_days: list[str]) -> float:
        if not avoid_days or not meetings:
            return 1.0
        for m in meetings:
            for day in m.days:
                if day in avoid_days or day[:3] in [d[:3] for d in avoid_days]:
                    return 0.0
        return 1.0

    def _score_modality(self, section_modality: str, preferred: str) -> float:
        if preferred == "any":
            return 1.0
        if section_modality == preferred:
            return 1.0
        if section_modality == "hybrid":
            return 0.7
        return 0.3

    def _score_instructor(self, rating: float | None, min_rating: float) -> float:
        if rating is None:
            return 0.5
        if rating >= 4.5:
            return 1.0
        if rating >= 4.0:
            return 0.85
        if rating >= min_rating:
            return 0.65
        return max(0.1, rating / 5.0)

    def _generate_schedules(
        self,
        scored_sections: dict[str, list[SectionWithScore]],
        student: StudentProfile,
        semester: str,
    ) -> list[ProposedSchedule]:
        """Generate non-conflicting schedule combinations."""
        # Take top 3 sections per course to limit combinations
        top_per_course = {cid: secs[:3] for cid, secs in scored_sections.items()}

        if not top_per_course:
            return []

        course_ids = list(top_per_course.keys())
        section_lists = [top_per_course[cid] for cid in course_ids]

        # Generate all combinations
        combos = list(itertools.product(*section_lists))

        # Filter conflicts and score
        valid_schedules: list[ProposedSchedule] = []
        for i, combo in enumerate(combos[:50]):  # Limit to 50 combos
            if self._has_conflict(combo):
                continue

            entries = []
            total_score = 0
            total_credits = 0
            total_commute = 0
            for scored in combo:
                commute_before = scored.commute_minutes or 0
                entries.append(ScheduleEntry(
                    section=scored,
                    commute_before_minutes=commute_before,
                    commute_after_minutes=commute_before,
                ))
                total_score += scored.score
                total_credits += scored.section.credits
                if scored.commute_minutes:
                    # Estimate weekly commute based on meeting days
                    days_per_week = sum(len(m.days) for m in scored.section.meeting_times)
                    total_commute += scored.commute_minutes * days_per_week * 2

            avg_score = total_score / len(combo) if combo else 0
            compactness = self._score_compactness(combo, student.preferences.schedule_style)
            final_score = avg_score * 0.7 + compactness * 0.3

            valid_schedules.append(ProposedSchedule(
                id=f"schedule-{i+1}",
                name=f"Option {i+1}",
                semester=semester,
                entries=entries,
                total_credits=total_credits,
                overall_score=round(final_score, 3),
                weekly_commute_minutes=round(total_commute, 1),
            ))

        # Sort and name top 3
        valid_schedules.sort(key=lambda s: -s.overall_score)
        names = ["Best Overall", "Runner-Up", "Alternative"]
        for i, sched in enumerate(valid_schedules[:3]):
            sched.name = names[i] if i < len(names) else f"Option {i+1}"
            sched.id = f"schedule-{i+1}"

        return valid_schedules[:3]

    def _has_conflict(self, combo: tuple[SectionWithScore, ...]) -> bool:
        """Check if any two sections overlap in time."""
        all_slots = []
        for scored in combo:
            for mt in scored.section.meeting_times:
                for day in mt.days:
                    start = _time_to_minutes(mt.start_time)
                    end = _time_to_minutes(mt.end_time)
                    all_slots.append((day, start, end))

        for i in range(len(all_slots)):
            for j in range(i + 1, len(all_slots)):
                d1, s1, e1 = all_slots[i]
                d2, s2, e2 = all_slots[j]
                if d1 == d2 and s1 < e2 and s2 < e1:
                    return True
        return False

    def _score_compactness(self, combo: tuple[SectionWithScore, ...], style: ScheduleStyle) -> float:
        """Score how compact/spread the schedule is."""
        day_slots: dict[str, list[tuple[int, int]]] = {}
        for scored in combo:
            for mt in scored.section.meeting_times:
                for day in mt.days:
                    start = _time_to_minutes(mt.start_time)
                    end = _time_to_minutes(mt.end_time)
                    day_slots.setdefault(day, []).append((start, end))

        if not day_slots:
            return 0.5

        total_gap = 0
        total_span = 0
        for day, slots in day_slots.items():
            slots.sort()
            if len(slots) >= 2:
                span = slots[-1][1] - slots[0][0]
                class_time = sum(e - s for s, e in slots)
                gap = span - class_time
                total_gap += gap
                total_span += span

        if total_span == 0:
            return 0.5

        gap_ratio = total_gap / total_span if total_span > 0 else 0

        if style == ScheduleStyle.COMPACT:
            return max(0, 1.0 - gap_ratio * 2)
        elif style == ScheduleStyle.SPREAD:
            return min(1.0, gap_ratio * 2)
        return 0.7

    async def _explain_schedule(self, schedule: ProposedSchedule, student: StudentProfile) -> str:
        sections_info = "\n".join(
            f"- {e.section.section.course_id} ({e.section.section.section_id}): "
            f"{e.section.section.instructor} (rating: {e.section.section.instructor_rating}), "
            f"{e.section.section.modality}, "
            f"{''.join(m.days[0] for m in e.section.section.meeting_times)} "
            f"{e.section.section.meeting_times[0].start_time if e.section.section.meeting_times else 'TBA'}-"
            f"{e.section.section.meeting_times[0].end_time if e.section.section.meeting_times else 'TBA'}, "
            f"score: {e.section.score:.0%}"
            for e in schedule.entries
        )
        prompt = f"""Explain why this schedule was ranked #{schedule.name} for the student. Be specific.

Schedule: {schedule.name} (score: {schedule.overall_score:.0%})
Weekly commute: {schedule.weekly_commute_minutes:.0f} minutes

Sections:
{sections_info}

Student preferences:
- Preferred time: {student.preferences.preferred_start_time} - {student.preferences.preferred_end_time}
- Avoid days: {student.preferences.avoid_days or 'none'}
- Style: {student.preferences.schedule_style.value}
- Min professor rating: {student.preferences.min_professor_rating}
- Modality: {student.preferences.modality.value}

Write 2-3 sentences explaining the key strengths and any tradeoffs of this schedule. Be specific about instructor quality, timing, and commute."""
        return await self._generate(prompt)
