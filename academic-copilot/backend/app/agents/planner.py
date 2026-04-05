"""Academic Planning Agent — generates semester-by-semester graduation plans."""
from __future__ import annotations
import json
from app.models.student import StudentProfile
from app.models.degree import DegreeAudit, RequirementStatus
from app.models.plan import (
    AcademicPlan, GraduationPath, SemesterPlan, PlannedCourse,
    Bottleneck, RiskFactor, RiskLevel, APCreditImpact,
)
from app.models.course import Course
from app.providers.asu_courses import ASUCourseProvider
from .base import BaseAgent


class PlanningAgent(BaseAgent):
    name = "planning_agent"
    system_prompt = (
        "You are an expert academic planner for Arizona State University. "
        "You create optimized semester-by-semester graduation plans that respect prerequisites, "
        "credit limits, course availability, and student preferences. "
        "You identify bottleneck courses and risk factors proactively."
    )

    def __init__(self):
        super().__init__()
        self.course_provider = ASUCourseProvider()

    async def generate_plan(self, student: StudentProfile, audit: DegreeAudit) -> AcademicPlan:
        """Generate a complete academic plan with bottleneck analysis."""
        # 1. Collect remaining courses
        remaining = self._get_remaining_courses(audit)
        completed_ids = {c.course_id for c in student.completed_courses}

        # 2. Load course data for prerequisite info
        all_course_ids = list(remaining.keys())
        courses = await self.course_provider.get_courses(all_course_ids)
        course_map = {c.course_id: c for c in courses}

        # 3. Detect bottlenecks
        bottlenecks = self._detect_bottlenecks(course_map, remaining, completed_ids)

        # 4. Compute AP credit impact
        ap_impact = self._compute_ap_impact(student, audit)

        # 5. Build topological ordering respecting prerequisites
        ordered = self._topological_sort(remaining, course_map, completed_ids)

        # 6. Generate primary plan
        primary_path = self._build_plan(
            ordered, course_map, student, audit,
            plan_name="Recommended Plan",
            max_credits=student.preferences.max_credits_per_semester,
        )
        primary_path.bottlenecks = bottlenecks
        primary_path.ap_credit_impact = ap_impact

        # 7. Generate accelerated alternative
        alt_path = self._build_plan(
            ordered, course_map, student, audit,
            plan_name="Accelerated Plan",
            max_credits=min(19, student.preferences.max_credits_per_semester + 3),
        )
        alt_path.bottlenecks = bottlenecks
        alt_path.ap_credit_impact = ap_impact

        # 8. Risk analysis
        primary_path.risk_factors = self._assess_risks(primary_path, student, bottlenecks)
        alt_path.risk_factors = self._assess_risks(alt_path, student, bottlenecks)

        # 9. Use Gemini to generate explanations
        primary_path.explanation = await self._explain_path(primary_path, student)
        alt_path.explanation = await self._explain_path(alt_path, student)
        alt_path.tradeoffs = "Higher course load per semester. May reduce time for extracurriculars and internships."

        risk_summary = await self._generate_risk_summary(primary_path, bottlenecks, ap_impact)

        return AcademicPlan(
            student_id=student.id,
            recommended_path=primary_path,
            alternative_paths=[alt_path],
            bottlenecks=bottlenecks,
            ap_credit_impact=ap_impact,
            risk_summary=risk_summary,
            explanation=primary_path.explanation,
        )

    def _get_remaining_courses(self, audit: DegreeAudit) -> dict[str, str]:
        """Extract courses still needed from the audit."""
        remaining: dict[str, str] = {}
        for cat in audit.categories:
            for req in cat.requirements:
                if req.status == RequirementStatus.FULFILLED:
                    continue
                # For specific required courses
                for co in req.courses_required:
                    if co.course_id not in [ca for ca in req.courses_applied]:
                        remaining[co.course_id] = req.category
                # For pick_n electives, suggest top options
                if req.pick_n > 0 and req.pick_from:
                    already_done = set(req.courses_applied)
                    needed = req.pick_n - len(already_done)
                    for opt in req.pick_from:
                        if opt.course_id not in already_done and needed > 0:
                            remaining[opt.course_id] = req.category
                            needed -= 1
        return remaining

    def _detect_bottlenecks(
        self,
        course_map: dict[str, Course],
        remaining: dict[str, str],
        completed: set[str],
    ) -> list[Bottleneck]:
        """Find courses that block the most downstream courses."""
        dependency_count: dict[str, list[str]] = {}
        for cid, course in course_map.items():
            if cid not in remaining:
                continue
            for prereq in course.prerequisites:
                pid = prereq.course_id
                if pid in remaining and pid not in completed:
                    dependency_count.setdefault(pid, []).append(cid)

        bottlenecks = []
        for cid, blocked in sorted(dependency_count.items(), key=lambda x: -len(x[1])):
            depth = self._chain_depth(cid, course_map, remaining, completed)
            if len(blocked) >= 1 or depth >= 2:
                course = course_map.get(cid)
                bottlenecks.append(Bottleneck(
                    course_id=cid,
                    title=course.title if course else "",
                    blocks=blocked,
                    depth=depth,
                    explanation=f"{cid} is a prerequisite for {', '.join(blocked)}. "
                                f"Delaying it would push back {len(blocked)} course(s) by at least 1 semester.",
                ))
        return sorted(bottlenecks, key=lambda b: -(len(b.blocks) + b.depth))

    def _chain_depth(self, course_id: str, course_map: dict[str, Course], remaining: dict, completed: set, seen: set | None = None) -> int:
        if seen is None:
            seen = set()
        if course_id in seen:
            return 0
        seen.add(course_id)
        max_d = 0
        for cid, course in course_map.items():
            if cid not in remaining:
                continue
            for prereq in course.prerequisites:
                if prereq.course_id == course_id:
                    d = 1 + self._chain_depth(cid, course_map, remaining, completed, seen)
                    max_d = max(max_d, d)
        return max_d

    def _compute_ap_impact(self, student: StudentProfile, audit: DegreeAudit) -> APCreditImpact:
        ap_courses = [c for c in student.completed_courses if c.source == "ap"]
        if not ap_courses:
            return APCreditImpact(explanation="No AP credits applied.")

        credits_saved = sum(c.credits for c in ap_courses)
        courses_skipped = [c.course_id for c in ap_courses]
        semesters_saved = round(credits_saved / 15, 1)  # ~15 credits per semester

        return APCreditImpact(
            credits_saved=credits_saved,
            courses_skipped=courses_skipped,
            semesters_saved=semesters_saved,
            explanation=f"Your AP credits saved you {credits_saved} credits ({len(courses_skipped)} courses), "
                        f"equivalent to approximately {semesters_saved} semester(s). "
                        f"Courses skipped: {', '.join(courses_skipped)}.",
        )

    def _topological_sort(
        self,
        remaining: dict[str, str],
        course_map: dict[str, Course],
        completed: set[str],
    ) -> list[str]:
        """Sort remaining courses by prerequisite ordering, prioritizing bottlenecks."""
        in_degree: dict[str, int] = {cid: 0 for cid in remaining}
        adj: dict[str, list[str]] = {cid: [] for cid in remaining}

        for cid in remaining:
            course = course_map.get(cid)
            if not course:
                continue
            for prereq in course.prerequisites:
                pid = prereq.course_id
                if pid in remaining and pid not in completed:
                    adj[pid].append(cid)
                    in_degree[cid] = in_degree.get(cid, 0) + 1

        # Count downstream dependents (courses that directly or indirectly need each course)
        downstream: dict[str, int] = {cid: len(adj.get(cid, [])) for cid in remaining}

        # Kahn's algorithm — prioritize courses that block the most others
        import heapq
        # Use (-downstream_count, course_id) for max-heap priority
        heap = [(-downstream[c], c) for c, d in in_degree.items() if d == 0]
        heapq.heapify(heap)
        result = []
        while heap:
            _, node = heapq.heappop(heap)
            result.append(node)
            for neighbor in adj.get(node, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    heapq.heappush(heap, (-downstream[neighbor], neighbor))
        # Add any remaining (cycles or missing prereqs)
        for cid in remaining:
            if cid not in result:
                result.append(cid)
        return result

    def _build_plan(
        self,
        ordered: list[str],
        course_map: dict[str, Course],
        student: StudentProfile,
        audit: DegreeAudit,
        plan_name: str,
        max_credits: int,
    ) -> GraduationPath:
        """Assign courses to semesters respecting constraints."""
        completed = {c.course_id for c in student.completed_courses}
        semesters: list[SemesterPlan] = []

        # Build semester sequence starting from current
        semester_names = self._generate_semester_sequence(
            student.preferences.target_graduation,
            student.current_semester,
            student.preferences.include_summer,
        )

        remaining_ordered = list(ordered)
        planned_prior: set[str] = set()  # Courses planned in PREVIOUS semesters

        for sem_name in semester_names:
            if not remaining_ordered:
                break
            is_summer = "Summer" in sem_name
            sem_max = max_credits if not is_summer else min(9, max_credits)
            sem_courses: list[PlannedCourse] = []
            sem_credits = 0
            still_remaining = []
            sem_planned: set[str] = set()  # Track courses in THIS semester

            for cid in remaining_ordered:
                if sem_credits >= sem_max:
                    still_remaining.append(cid)
                    continue

                course = course_map.get(cid)
                if not course:
                    still_remaining.append(cid)
                    continue

                # Check semester availability
                is_fall = "Fall" in sem_name
                is_spring = "Spring" in sem_name
                offered = course.typically_offered
                if offered:
                    if is_fall and "Fall" not in offered:
                        still_remaining.append(cid)
                        continue
                    if is_spring and "Spring" not in offered:
                        still_remaining.append(cid)
                        continue
                    if is_summer and "Summer" not in offered:
                        still_remaining.append(cid)
                        continue

                # Check prerequisites are met (must be completed or in a PRIOR semester, not current)
                prereqs_met = True
                for prereq in course.prerequisites:
                    if prereq.course_id not in completed and prereq.course_id not in planned_prior:
                        # Allow concurrent only if explicitly marked
                        if not prereq.can_be_concurrent or prereq.course_id not in sem_planned:
                            prereqs_met = False
                            break
                if not prereqs_met:
                    still_remaining.append(cid)
                    continue

                if sem_credits + course.credits > sem_max:
                    still_remaining.append(cid)
                    continue

                # Find what this course is a prerequisite for
                is_prereq_for = []
                for other_cid in remaining_ordered:
                    other = course_map.get(other_cid)
                    if other:
                        for p in other.prerequisites:
                            if p.course_id == cid:
                                is_prereq_for.append(other_cid)

                sem_courses.append(PlannedCourse(
                    course_id=cid,
                    title=course.title,
                    credits=course.credits,
                    is_prerequisite_for=is_prereq_for,
                    is_bottleneck=len(is_prereq_for) >= 2,
                    placement_reason=f"Placed in {sem_name} — prerequisites satisfied, course typically offered in {'Fall' if is_fall else 'Spring' if is_spring else 'Summer'}",
                ))
                sem_credits += course.credits
                sem_planned.add(cid)

            remaining_ordered = still_remaining
            planned_prior.update(sem_planned)
            if sem_courses:
                semesters.append(SemesterPlan(
                    semester=sem_name,
                    courses=sem_courses,
                    total_credits=sem_credits,
                ))

        total_credits = sum(s.total_credits for s in semesters)
        grad_term = semesters[-1].semester if semesters else student.preferences.target_graduation

        return GraduationPath(
            id=plan_name.lower().replace(" ", "_"),
            name=plan_name,
            semesters=semesters,
            total_semesters=len(semesters),
            graduation_term=grad_term,
            total_credits=total_credits,
            risk_factors=[],
            bottlenecks=[],
            explanation="",
        )

    def _generate_semester_sequence(self, target: str, current: str, include_summer: bool) -> list[str]:
        """Generate semester names from current to target."""
        semesters = []
        # Parse current and target
        parts = current.split()
        cur_season, cur_year = parts[0], int(parts[1])
        t_parts = target.split()
        target_season, target_year = t_parts[0], int(t_parts[1])

        year = cur_year
        season = cur_season
        while year < target_year + 2:  # Safety limit
            semesters.append(f"{season} {year}")
            if season == "Fall":
                season = "Spring"
                year += 1
            elif season == "Spring":
                if include_summer:
                    season = "Summer"
                else:
                    season = "Fall"
            elif season == "Summer":
                season = "Fall"

            if year > target_year + 1:
                break
            if len(semesters) > 12:
                break
        return semesters

    def _assess_risks(self, path: GraduationPath, student: StudentProfile, bottlenecks: list[Bottleneck]) -> list[RiskFactor]:
        risks = []
        # High credit semesters
        for sem in path.semesters:
            if sem.total_credits > 17:
                risks.append(RiskFactor(
                    description=f"{sem.semester} has {sem.total_credits} credits — heavy course load",
                    level=RiskLevel.MEDIUM,
                    mitigation="Consider moving one course to a lighter semester or taking a summer course",
                ))
        # Bottleneck risk
        for bn in bottlenecks[:2]:
            risks.append(RiskFactor(
                description=f"{bn.course_id} is a critical bottleneck — blocks {len(bn.blocks)} courses",
                level=RiskLevel.HIGH,
                mitigation=f"Prioritize {bn.course_id} in the earliest available semester. Failing or withdrawing would delay graduation.",
            ))
        # Capstone sequence
        has_capstone = any(any(c.course_id == "CSE 485" for c in s.courses) for s in path.semesters)
        if has_capstone:
            risks.append(RiskFactor(
                description="CSE 485 → CSE 486 is a two-semester capstone sequence that cannot be rearranged",
                level=RiskLevel.LOW,
                mitigation="Ensure CSE 485 is taken in Fall and CSE 486 in the following Spring",
            ))
        return risks

    async def _explain_path(self, path: GraduationPath, student: StudentProfile) -> str:
        sem_summary = "\n".join(
            f"- {s.semester}: {', '.join(c.course_id for c in s.courses)} ({s.total_credits} cr)"
            for s in path.semesters
        )
        prompt = f"""Explain this graduation plan to a student in 2-3 concise paragraphs.

Plan: {path.name}
Total semesters remaining: {path.total_semesters}
Graduation term: {path.graduation_term}
Student target: {student.preferences.target_graduation}

Semester breakdown:
{sem_summary}

Bottleneck courses: {', '.join(b.course_id for b in path.bottlenecks) if path.bottlenecks else 'None'}
Risk factors: {len(path.risk_factors)} identified

Explain:
1. Why this sequence was chosen
2. Key bottleneck awareness
3. Overall assessment
Keep it under 150 words, encouraging but honest."""
        return await self._generate(prompt)

    async def _generate_risk_summary(self, path: GraduationPath, bottlenecks: list[Bottleneck], ap_impact: APCreditImpact) -> str:
        prompt = f"""Write a brief "Risk to Graduation Timeline" summary (3-5 bullet points).

Graduation target: {path.graduation_term}
Semesters remaining: {path.total_semesters}
Bottlenecks: {json.dumps([{"course": b.course_id, "blocks": b.blocks, "depth": b.depth} for b in bottlenecks[:3]])}
Risk factors: {json.dumps([{"desc": r.description, "level": r.level.value} for r in path.risk_factors])}
AP credit impact: saved {ap_impact.credits_saved} credits ({ap_impact.semesters_saved} semesters)

Format as bullet points. Be specific about what could go wrong and how to mitigate. Under 100 words."""
        return await self._generate(prompt)
