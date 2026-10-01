"""Merge, rank, deduplicate and fingerprint findings across static and AI analyzers."""

import hashlib
from dataclasses import dataclass
from typing import Any

SEVERITY_ORDER = {
    "critical": 5,
    "high": 4,
    "medium": 3,
    "low": 2,
    "info": 1,
}


@dataclass
class UnifiedFinding:
    """Consolidated finding representation."""

    fingerprint: str
    file_path: str
    line_start: int
    line_end: int
    severity: str
    category: str
    source: str  # static, ai
    title: str
    explanation: str
    suggested_patch: str | None = None


def compute_fingerprint(file_path: str, rule_or_title: str, line_start: int) -> str:
    """Creates deterministic SHA-256 fingerprint hash to prevent duplicate comments."""
    raw = f"{file_path}:{rule_or_title.strip().lower()}:{line_start}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def merge_and_rank_findings(
    raw_findings: list[dict[str, Any]],
    min_severity: str = "low",
    ignored_fingerprints: set[str] | None = None,
) -> list[UnifiedFinding]:
    """Combines, dedupes, filters by min severity, and sorts findings."""
    ignored = ignored_fingerprints or set()
    min_rank = SEVERITY_ORDER.get(min_severity.lower(), 2)

    seen_fingerprints: set[str] = set()
    unified: list[UnifiedFinding] = []

    for item in raw_findings:
        sev = str(item.get("severity", "info")).lower()
        if SEVERITY_ORDER.get(sev, 1) < min_rank:
            continue

        file_path = str(item.get("file_path", ""))
        title = str(item.get("title", ""))
        line_start = int(item.get("line_start", 1))
        line_end = int(item.get("line_end", line_start))

        fp = compute_fingerprint(file_path, title, line_start)
        if fp in seen_fingerprints or fp in ignored:
            continue
        seen_fingerprints.add(fp)

        unified.append(
            UnifiedFinding(
                fingerprint=fp,
                file_path=file_path,
                line_start=line_start,
                line_end=line_end,
                severity=sev,
                category=str(item.get("category", "quality")),
                source=str(item.get("source", "static")),
                title=title,
                explanation=str(item.get("explanation", "")),
                suggested_patch=item.get("suggested_patch"),
            )
        )

    # Sort descending by severity, then by file path and line number
    unified.sort(
        key=lambda f: (
            -SEVERITY_ORDER.get(f.severity, 0),
            f.file_path,
            f.line_start,
        )
    )

    return unified


def calculate_overall_risk(findings: list[UnifiedFinding]) -> str:
    """Derives PR risk badge: High if Critical/High, Medium if Medium, else Low."""
    has_critical_or_high = any(f.severity in ("critical", "high") for f in findings)
    if has_critical_or_high:
        return "high"
    has_medium = any(f.severity == "medium" for f in findings)
    if has_medium:
        return "medium"
    return "low"
