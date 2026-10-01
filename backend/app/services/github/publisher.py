"""Publishes review comments, summaries, and commit checks to GitHub."""

from typing import Any

import httpx

from app.core.logging import logger
from app.services.review.ranking import UnifiedFinding

MAX_INLINE_COMMENTS = 25  # Limit comment volume to avoid noise


class GitHubPublisher:
    """Posts PR review comments and check runs via GitHub REST API."""

    def __init__(self, installation_token: str):
        self._token = installation_token
        self._base_url = "https://api.github.com"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "PR-Review-AI",
        }

    def build_summary_markdown(
        self,
        pr_summary: str,
        risk_level: str,
        findings: list[UnifiedFinding],
        skipped_count: int,
        missing_tests: list[str],
    ) -> str:
        """Constructs safe markdown summary comment without mentions or raw HTML."""
        crit_count = sum(1 for f in findings if f.severity == "critical")
        high_count = sum(1 for f in findings if f.severity == "high")
        med_count = sum(1 for f in findings if f.severity == "medium")
        low_count = sum(1 for f in findings if f.severity == "low")

        badge = {
            "high": "🔴 HIGH RISK",
            "medium": "🟠 MEDIUM RISK",
            "low": "🟢 LOW RISK",
        }.get(risk_level.lower(), "⚪ LOW RISK")

        lines = [
            "### 🤖 PR Review AI Summary",
            "",
            f"**Risk Level:** `{badge}`",
            "",
            f"> {pr_summary}",
            "",
            "#### Findings Breakdown",
            f"- **Critical:** {crit_count}",
            f"- **High:** {high_count}",
            f"- **Medium:** {med_count}",
            f"- **Low / Info:** {low_count}",
        ]

        if skipped_count > 0:
            lines.append(f"\n*Note: {skipped_count} file(s) were skipped (limits).*")

        if missing_tests:
            lines.append("\n#### Suggested Test Cases")
            for t in missing_tests:
                # Neutralize @ mentions in test descriptions
                safe_t = t.replace("@", "[at]")
                lines.append(f"- [ ] {safe_t}")

        lines.append(
            "\n---\n*Need clarification? Reply to comments or `@pr-review-ai`.*"
        )
        return "\n".join(lines)

    async def post_review_and_comments(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        head_sha: str,
        findings: list[UnifiedFinding],
        summary_markdown: str,
    ) -> int | None:
        """Creates unified GitHub PR Review containing inline comments."""
        url = f"{self._base_url}/repos/{owner}/{repo}/pulls/{pull_number}/reviews"

        comments_payload: list[dict[str, Any]] = []
        for finding in findings[:MAX_INLINE_COMMENTS]:
            body = (
                f"**[{finding.severity.upper()}] {finding.title}**\n\n"
                f"{finding.explanation}"
            )
            if finding.suggested_patch:
                body += f"\n\n```suggestion\n{finding.suggested_patch.strip()}\n```"

            # Prevent raw user mentions
            safe_body = body.replace("@", "[at]")

            comments_payload.append(
                {
                    "path": finding.file_path,
                    "line": finding.line_end,
                    "body": safe_body,
                }
            )

        payload = {
            "commit_id": head_sha,
            "body": summary_markdown,
            "event": "COMMENT",
            "comments": comments_payload,
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=payload, headers=self._headers())
                if resp.status_code == 200:
                    return int(resp.json().get("id", 0))
                logger.warning(
                    "github_publish_review_status", status_code=resp.status_code
                )
        except Exception as exc:
            logger.error("github_publish_review_failed", error=str(exc))

        return None

    async def create_check_run(
        self,
        owner: str,
        repo: str,
        head_sha: str,
        risk_level: str,
        has_critical: bool,
        block_on_critical: bool,
    ) -> int | None:
        """Posts pass/fail/neutral check run status on commit head."""
        url = f"{self._base_url}/repos/{owner}/{repo}/check-runs"

        conclusion = "success"
        if has_critical and block_on_critical:
            conclusion = "failure"

        payload = {
            "name": "PR Review AI",
            "head_sha": head_sha,
            "status": "completed",
            "conclusion": conclusion,
            "output": {
                "title": f"Review Completed - {risk_level.capitalize()} Risk",
                "summary": (
                    "Review completed successfully."
                    if conclusion == "success"
                    else "Merge blocked due to Critical findings."
                ),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=self._headers())
                if resp.status_code == 201:
                    return int(resp.json().get("id", 0))
        except Exception as exc:
            logger.error("github_check_run_failed", error=str(exc))

        return None
