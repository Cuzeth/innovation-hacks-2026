"""Credit Evaluation Agent — matches completed courses and AP/transfer credits to requirements."""
from __future__ import annotations
from app.models.student import StudentProfile, CompletedCourse
from app.models.degree import (
    DegreeRequirements, DegreeAudit, RequirementCategory,
    Requirement, RequirementStatus, AuditExplanation,
)
from .base import BaseAgent


class CreditEvaluationAgent(BaseAgent):
    name = "credit_eval_agent"
    system_prompt = (
        "You are a credit evaluation specialist for Arizona State University. "
        "You match completed courses, AP credits, and transfer credits to degree requirements. "
        "When uncertain about an equivalency, mark it as 'needs advisor review' rather than guessing."
    )

    async def evaluate(self, student: StudentProfile, requirements: DegreeRequirements) -> DegreeAudit:
        """Evaluate student's credits against degree requirements."""
        completed_map = {c.course_id: c for c in student.completed_courses}
        in_progress_ids = {c.course_id for c in student.completed_courses if c.grade == "NR"}
        # D is not passing for most ASU major courses (C minimum required).
        # Only count courses with C- or better, or NR (in-progress).
        failing_grades = {"D+", "D", "D-", "E", "W", "EN"}
        completed_ids = {
            c.course_id for c in student.completed_courses
            if c.grade not in failing_grades
        }

        audit_categories: list[RequirementCategory] = []
        explanations: list[AuditExplanation] = []
        total_fulfilled = 0
        total_partial = 0
        total_unmet = 0
        total_credits_applied = 0

        for category in requirements.categories:
            cat_credits_fulfilled = 0
            audited_reqs: list[Requirement] = []

            for req in category.requirements:
                status, credits_applied, courses_applied, explanation = self._evaluate_requirement(
                    req, completed_ids, completed_map, in_progress_ids
                )
                audited_req = req.model_copy()
                audited_req.status = status
                audited_req.credits_applied = credits_applied
                audited_req.courses_applied = courses_applied
                audited_reqs.append(audited_req)
                cat_credits_fulfilled += credits_applied

                if status == RequirementStatus.FULFILLED:
                    total_fulfilled += 1
                elif status == RequirementStatus.PARTIALLY_FULFILLED:
                    total_partial += 1
                else:
                    total_unmet += 1

                # Determine confidence based on source
                confidence = "high"
                needs_review = False
                source_used = "ASU course records"
                for cid in courses_applied:
                    cc = completed_map.get(cid)
                    if cc and cc.source == "ap":
                        source_used = f"AP Credit: {cc.transfer_institution}"
                        confidence = "high"
                    elif cc and cc.source == "transfer":
                        source_used = f"Transfer: {cc.transfer_institution}"
                        confidence = "medium"
                        needs_review = True

                explanations.append(AuditExplanation(
                    requirement_id=req.id,
                    requirement_name=req.name,
                    status=status,
                    reasoning=explanation,
                    confidence=confidence,
                    source_used=source_used,
                    needs_advisor_review=needs_review,
                ))

            total_credits_applied += cat_credits_fulfilled
            audit_categories.append(RequirementCategory(
                name=category.name,
                display_name=category.display_name,
                credits_required=category.credits_required,
                credits_fulfilled=cat_credits_fulfilled,
                requirements=audited_reqs,
            ))

        total_completed = student.compute_credits()
        total_remaining = max(0, requirements.total_credits_required - total_completed)
        progress = round(total_completed / requirements.total_credits_required * 100, 1) if requirements.total_credits_required > 0 else 0

        return DegreeAudit(
            student_id=student.id,
            degree_requirements=requirements,
            total_credits_completed=total_completed,
            total_credits_remaining=total_remaining,
            overall_progress_pct=min(100.0, progress),
            categories=audit_categories,
            fulfilled_count=total_fulfilled,
            partial_count=total_partial,
            unmet_count=total_unmet,
            explanations=explanations,
        )

    def _evaluate_requirement(
        self,
        req: Requirement,
        completed_ids: set[str],
        completed_map: dict[str, CompletedCourse],
        in_progress_ids: set[str] | None = None,
    ) -> tuple[RequirementStatus, int, list[str], str]:
        """Evaluate a single requirement. Returns (status, credits_applied, courses_applied, explanation)."""
        ip = in_progress_ids or set()

        # Case 1: Specific required courses
        if req.courses_required:
            required_ids = {c.course_id for c in req.courses_required}
            matched = required_ids & completed_ids
            if matched == required_ids:
                credits = sum(c.credits for c in req.courses_required if c.course_id in matched)
                in_prog = matched & ip
                if in_prog:
                    return (
                        RequirementStatus.PARTIALLY_FULFILLED,
                        credits,
                        list(matched),
                        f"In progress: {', '.join(sorted(in_prog))}. Will be fulfilled when completed.",
                    )
                return (
                    RequirementStatus.FULFILLED,
                    credits,
                    list(matched),
                    f"All required courses completed: {', '.join(sorted(matched))}",
                )
            elif matched:
                credits = sum(c.credits for c in req.courses_required if c.course_id in matched)
                still_need = required_ids - matched
                return (
                    RequirementStatus.PARTIALLY_FULFILLED,
                    credits,
                    list(matched),
                    f"Completed {', '.join(sorted(matched))}. Still need: {', '.join(sorted(still_need))}",
                )
            else:
                return (
                    RequirementStatus.UNMET,
                    0,
                    [],
                    f"Need to complete: {', '.join(sorted(required_ids))}",
                )

        # Case 2: Pick N from list
        if req.pick_n > 0 and req.pick_from:
            option_ids = {c.course_id for c in req.pick_from}
            matched = option_ids & completed_ids
            if len(matched) >= req.pick_n:
                applied = list(matched)[:req.pick_n]
                pick_map = {c.course_id: c.credits for c in req.pick_from}
                credits = sum(pick_map.get(cid, 3) for cid in applied)
                in_prog = set(applied) & ip
                if in_prog:
                    return (
                        RequirementStatus.PARTIALLY_FULFILLED,
                        credits,
                        applied,
                        f"In progress: {', '.join(sorted(in_prog))}. Completed: {', '.join(sorted(set(applied) - ip))}",
                    )
                return (
                    RequirementStatus.FULFILLED,
                    credits,
                    applied,
                    f"Satisfied by completing {', '.join(applied)} (needed {req.pick_n} from elective list)",
                )
            elif matched:
                pick_map = {c.course_id: c.credits for c in req.pick_from}
                credits = sum(pick_map.get(cid, 3) for cid in matched)
                remaining = req.pick_n - len(matched)
                return (
                    RequirementStatus.PARTIALLY_FULFILLED,
                    credits,
                    list(matched),
                    f"Completed {', '.join(sorted(matched))}. Need {remaining} more from elective list.",
                )
            else:
                return (
                    RequirementStatus.UNMET,
                    0,
                    [],
                    f"Need to choose {req.pick_n} course(s) from the elective list",
                )

        # Case 3: Free electives (credit-count only)
        if req.category == "free_elective":
            # Count all credits beyond what's needed for specific requirements
            # For simplicity, mark as partially fulfilled with a note
            return (
                RequirementStatus.PARTIALLY_FULFILLED,
                0,
                [],
                "Free elective credits are computed from total credits minus required course credits. See overall credit total.",
            )

        return (RequirementStatus.UNMET, 0, [], "Unable to evaluate this requirement automatically")

    async def explain_audit(self, audit: DegreeAudit) -> str:
        """Generate AI-powered explanation of the audit results."""
        ap_courses = []
        for exp in audit.explanations:
            if "AP Credit" in exp.source_used:
                ap_courses.append(f"{exp.requirement_name}: {exp.source_used}")

        prompt = f"""Summarize this degree audit for a student in a helpful, concise way.

Progress: {audit.overall_progress_pct}% ({audit.total_credits_completed}/{audit.degree_requirements.total_credits_required} credits)
Fulfilled requirements: {audit.fulfilled_count}
Partially fulfilled: {audit.partial_count}
Unmet: {audit.unmet_count}
Credits remaining: {audit.total_credits_remaining}

AP Credits applied:
{chr(10).join(ap_courses) if ap_courses else "None"}

Category progress:
{chr(10).join(f"- {c.display_name}: {c.credits_fulfilled}/{c.credits_required} credits" for c in audit.categories)}

Items needing advisor review:
{chr(10).join(f"- {e.requirement_name}: {e.reasoning}" for e in audit.explanations if e.needs_advisor_review) or "None"}

Write 2-3 paragraphs:
1. Overall progress and what's been accomplished (celebrate AP credits if applicable)
2. What's remaining and key priorities
3. Any items to discuss with an advisor
Keep it encouraging and under 200 words."""

        return await self._generate(prompt)
