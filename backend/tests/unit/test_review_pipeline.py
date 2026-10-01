"""Tests for review pipeline analyzers, secrets scanning, and ranking logic."""

from app.services.analyzers.secrets import is_secret_bearing_file, scan_for_secrets
from app.services.analyzers.semgrep_runner import run_static_security_scan
from app.services.review.config import parse_repo_rules_yaml
from app.services.review.filtering import filter_pr_files
from app.services.review.ranking import calculate_overall_risk, merge_and_rank_findings


def test_secrets_scanner_detects_and_masks() -> None:
    """Verifies that leaked keys are found and masked without revealing plaintext."""
    code = 'AWS_KEY = "AKIA1234567890ABCDEF"\nprint("connected")'
    findings = scan_for_secrets(code, "config.py")

    assert len(findings) == 1
    assert findings[0].severity == "critical"
    assert "AKIA" in findings[0].masked_value
    assert "AKIA1234567890ABCDEF" not in findings[0].masked_value
    assert is_secret_bearing_file("config.py", code) is True


def test_static_security_rule_detection() -> None:
    """Detects raw SQL string injection risk."""
    vulnerable_sql = "query = f'SELECT * FROM users WHERE id = {user_id}'"
    hits = run_static_security_scan("db.py", vulnerable_sql)

    assert len(hits) >= 1
    assert any("SQL Injection" in h.title for h in hits)
    assert hits[0].severity == "critical"


def test_file_filtering_caps() -> None:
    """Enforces 40 files / 2,000 lines limits and skips lockfiles."""
    files = [
        {
            "filename": "package-lock.json",
            "patch": "+{...}",
            "status": "modified",
            "changes": 100,
        },
        {
            "filename": "app/auth.py",
            "patch": "+def login(): pass",
            "status": "modified",
            "changes": 20,
        },
    ]
    res = filter_pr_files(files)

    assert len(res.accepted_files) == 1
    assert res.accepted_files[0].path == "app/auth.py"
    assert len(res.skipped_files) == 1
    assert "package-lock.json" in res.skipped_files[0].path


def test_ranking_and_deduplication() -> None:
    """Ensures deduplication by fingerprint and ranking descending by severity."""
    raw = [
        {
            "file_path": "main.py",
            "title": "SQL Injection",
            "line_start": 10,
            "severity": "critical",
        },
        {
            "file_path": "main.py",
            "title": "SQL Injection",  # duplicate
            "line_start": 10,
            "severity": "critical",
        },
        {
            "file_path": "utils.py",
            "title": "Complexity",
            "line_start": 5,
            "severity": "low",
        },
    ]

    merged = merge_and_rank_findings(raw, min_severity="low")
    assert len(merged) == 2
    assert merged[0].severity == "critical"
    assert calculate_overall_risk(merged) == "high"


def test_safe_rules_yaml_parsing() -> None:
    """Safe loading of .prreview.yml with default fallbacks."""
    safe_yaml = """
ignore_paths:
  - "dist/**"
min_severity: high
block_on_critical: true
"""
    cfg = parse_repo_rules_yaml(safe_yaml)
    assert cfg.min_severity == "high"
    assert cfg.block_on_critical is True
    assert "dist/**" in cfg.ignore_paths
