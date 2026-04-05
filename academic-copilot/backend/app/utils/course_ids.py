"""Course ID normalization helpers."""
from __future__ import annotations

import re


def normalize_course_id(value: str) -> str:
    text = " ".join(value.upper().strip().split())
    match = re.match(r"^([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)", text)
    if match:
        number = match.group(2)
        number = re.match(r"^(\d{3})", number).group(1) if re.match(r"^(\d{3})", number) else number
        return f"{match.group(1)} {number}"
    return text
