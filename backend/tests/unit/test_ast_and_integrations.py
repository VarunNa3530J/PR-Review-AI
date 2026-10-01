"""Unit tests for AST verification, Gemini LLM fallback/resilience,
and GitHub publisher.
"""

import pytest

from app.services.analyzers.syntax import analyze_syntax_errors
from app.services.github.publisher import GitHubPublisher
from app.services.llm.gemini import AIReviewFinding, GeminiLLMClient
from app.services.review.ranking import UnifiedFinding
from app.services.review.validate import validate_ai_finding


def test_ast_syntax_error_detection_and_patch() -> None:
    """Verifies that real Python AST catches syntax errors and patches them."""
    invalid_code = "def add(x, y):\n    return x. + y\n"
    findings = analyze_syntax_errors("math_utils.py", invalid_code)

    assert len(findings) >= 1
    syntax_err = findings[0]
    assert syntax_err.severity == "critical"
    assert syntax_err.line_number == 2
    assert "Invalid Dot Typo" in syntax_err.title or "Syntax" in syntax_err.title
    assert syntax_err.suggested_patch is not None
    assert "x + y" in syntax_err.suggested_patch


def test_ast_syntax_valid_python_passes() -> None:
    """Valid Python code passes AST parse with 0 syntax findings."""
    valid_code = "def multiply(a: int, b: int) -> int:\n    return a * b\n"
    findings = analyze_syntax_errors("calc.py", valid_code)
    assert len(findings) == 0


def test_diff_boundary_validation() -> None:
    """Verifies that AI findings outside modified diff lines are rejected."""
    patch = (
        "@@ -10,3 +10,4 @@\n"
        " def process():\n"
        "+    user_id = sanitize(input)\n"
        "+    db.save(user_id)\n"
        "     return True"
    )

    # In-bounds finding
    in_bound = AIReviewFinding(
        file_path="service.py",
        line_start=11,
        line_end=11,
        severity="high",
        category="security",
        title="Input Validation",
        explanation="Check user input",
    )
    assert validate_ai_finding(in_bound, patch) is True

    # Out-of-bounds finding (e.g. line 99 not in diff)
    out_of_bound = AIReviewFinding(
        file_path="service.py",
        line_start=99,
        line_end=99,
        severity="medium",
        category="style",
        title="Style issue",
        explanation="Hallucinated line",
    )
    assert validate_ai_finding(out_of_bound, patch) is False


@pytest.mark.asyncio
async def test_gemini_client_fallback_resilience() -> None:
    """When API keys are unavailable, client returns safe fallback response."""
    client = GeminiLLMClient(model_name="gemini-invalid-model")
    resp = await client.review_diff(
        prompt="Review this code snippet",
        system_instruction="You are PR Review AI",
    )

    assert resp is not None
    assert resp.content.risk_score == "low"
    assert resp.tokens_in > 0
    assert resp.tokens_out > 0
    assert isinstance(resp.content.findings, list)


def test_github_publisher_markdown_neutralizes_mentions() -> None:
    """GitHub publisher must neutralize @mentions and build formatted summary."""
    publisher = GitHubPublisher("dummy_token")
    finding = UnifiedFinding(
        fingerprint="fp-123456",
        file_path="app.py",
        line_start=10,
        line_end=12,
        severity="critical",
        category="bug",
        title="Uncaught Exception",
        explanation="Contact @alice and @admin",
        suggested_patch="try:\n    run()\nexcept Exception:\n    pass",
        source="ai",
    )

    markdown = publisher.build_summary_markdown(
        pr_summary="Adds database migration",
        risk_level="high",
        findings=[finding],
        skipped_count=2,
        missing_tests=["Test @auth edge case"],
    )

    assert "🔴 HIGH RISK" in markdown
    assert "**Critical:** 1" in markdown
    assert "*Note: 2 file(s) were skipped (limits).*" in markdown
    # Verifies @ mentions are neutralized to avoid pinging users
    assert "[at]auth" in markdown
    assert "@auth" not in markdown
