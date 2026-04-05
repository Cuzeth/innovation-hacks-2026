"""Regression tests for transcript post-processing."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agents.transcript import _postprocess_extracted_courses


def test_repeated_course_with_earned_credit_is_kept():
    courses = _postprocess_extracted_courses([
        {
            "course_id": "Repeated:",
            "title": "CSE 360 Intro to Software Engineering",
            "credits": 3,
            "earned_credits": 3.0,
            "grade": "B-",
            "semester": "Fall 2024",
            "repeat_status": "Repeat - Excluded from GPA and Hours Earned",
        }
    ])

    assert len(courses) == 1
    assert courses[0]["course_id"] == "CSE 360"
    assert courses[0]["grade"] == "B-"
    assert courses[0]["earned_credits"] == 3.0
    assert "Intro to Software" in courses[0]["title"]


def test_zero_credit_repeat_does_not_beat_passing_attempt():
    courses = _postprocess_extracted_courses([
        {
            "course_id": "CSE 360",
            "title": "Intro to Software Engineering",
            "credits": 3,
            "earned_credits": 3.0,
            "grade": "C",
            "semester": "Spring 2024",
        },
        {
            "course_id": "Repeated:",
            "title": "CSE 360 Intro to Software Engineering",
            "credits": 3,
            "earned_credits": 0.0,
            "grade": "E",
            "semester": "Fall 2024",
            "repeat_status": "Repeat - Excluded from GPA and Hours Earned",
        },
    ])

    assert len(courses) == 1
    assert courses[0]["course_id"] == "CSE 360"
    assert courses[0]["semester"] == "Spring 2024"
    assert courses[0]["grade"] == "C"


if __name__ == "__main__":
    print("Running transcript parser tests...")
    test_repeated_course_with_earned_credit_is_kept()
    test_zero_credit_repeat_does_not_beat_passing_attempt()
    print("  transcript_parser: PASS")
