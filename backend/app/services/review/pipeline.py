"""Review Pipeline Orchestrator executing steps 3 through 13."""

import time
from typing import Any

from app.core.logging import logger
from app.services.analyzers.complexity import analyze_code_quality
from app.services.analyzers.secrets import is_secret_bearing_file, scan_for_secrets
from app.services.analyzers.semgrep_runner import run_static_security_scan
from app.services.analyzers.syntax import analyze_syntax_errors
from app.services.github.publisher import GitHubPublisher
from app.services.llm.gemini import GeminiLLMClient
from app.services.review.config import parse_repo_rules_yaml
from app.services.review.filtering import filter_pr_files
from app.services.review.ranking import calculate_overall_risk, merge_and_rank_findings
from app.services.review.validate import validate_ai_finding


class ReviewPipeline:
    """Executes end-to-end review lifecycle for a pull request."""

    def __init__(self, installation_token: str):
        self.publisher = GitHubPublisher(installation_token)
        self.llm = GeminiLLMClient()

    async def run(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        head_sha: str,
        files_data: list[dict[str, Any]],
        rules_yaml: str | None = None,
    ) -> dict[str, Any]:
        """Runs complete review pipeline: filter -> static -> AI -> rank -> publish."""
        start_time = time.perf_counter()
        config = parse_repo_rules_yaml(rules_yaml)

        # 1. Filter changed files (supporting large directory sources)
        filtered = filter_pr_files(
            files_data,
            ignore_patterns=config.ignore_paths,
            max_files=100,
            max_lines=100000,
        )

        raw_findings: list[dict[str, Any]] = []

        # 2. Static & Secrets scan on accepted files
        for f in filtered.accepted_files:
            # Secrets scan
            secrets_found = scan_for_secrets(f.patch, f.path)
            for sf in secrets_found:
                raw_findings.append(
                    {
                        "file_path": f.path,
                        "line_start": sf.line_number,
                        "line_end": sf.line_number,
                        "severity": sf.severity,
                        "category": "security",
                        "source": "static",
                        "title": sf.rule_name,
                        "explanation": f"{sf.advice} Value: {sf.masked_value}",
                        "suggested_patch": (
                            "// Load secret safely from env or Vault:\n"
                            "const secretKey = process.env.SECRET_KEY || "
                            "process.env.API_KEY;"
                        ),
                    }
                )

            # Static rules scan
            static_hits = run_static_security_scan(f.path, f.patch)
            for sh in static_hits:
                patch = None
                if "SQL Injection" in sh.title:
                    patch = (
                        "// Parameterized query:\n"
                        'await db.query("SELECT * FROM items WHERE id = $1", [itemId]);'
                    )
                elif "Command Injection" in sh.title:
                    patch = (
                        "// Safe subprocess invocation without shell=True:\n"
                        'subprocess.run(["command", arg], shell=False, check=True)'
                    )
                elif "Deserialization" in sh.title:
                    patch = (
                        "# Safe yaml or json parser:\ndata = yaml.safe_load(raw_data)"
                    )
                elif "Cryptographic" in sh.title:
                    patch = (
                        "// Strong cryptographic digest:\n"
                        'hash = crypto.createHash("sha256").update(data)'
                        '.digest("hex");'
                    )
                elif "Hardcoded" in sh.title:
                    patch = "const apiKey = process.env.APP_SECRET_TOKEN;"
                elif "Cross-Site Scripting" in sh.title:
                    patch = (
                        "// Safe textContent or sanitized HTML:\n"
                        "element.textContent = userProvidedText;"
                    )
                elif "CORS" in sh.title:
                    patch = (
                        "// Whitelist trusted origins:\n"
                        'res.setHeader("Access-Control-Allow-Origin", '
                        '"https://app.yourdomain.com");'
                    )
                elif "Console Logging" in sh.title:
                    patch = (
                        "// Remove logging of credentials:\n"
                        'logger.info("User authentication requested");'
                    )
                elif "Insecure HTTP" in sh.title:
                    patch = (
                        "// Use HTTPS:\n"
                        'const API_URL = "https://api.yourdomain.com/v1";'
                    )
                elif "ReDoS" in sh.title:
                    patch = (
                        "// Simplified linear regex without backtracking:\n"
                        "const safeRegex = /^[a-zA-Z0-9_-]{1,64}$/;"
                    )
                raw_findings.append(
                    {
                        "file_path": f.path,
                        "line_start": sh.line_number,
                        "line_end": sh.line_number,
                        "severity": sh.severity,
                        "category": sh.category,
                        "source": "static",
                        "title": sh.title,
                        "explanation": sh.explanation,
                        "suggested_patch": patch,
                    }
                )

            # Code quality smells
            quality_hits = analyze_code_quality(f.path, f.patch)
            for qh in quality_hits:
                raw_findings.append(
                    {
                        "file_path": f.path,
                        "line_start": qh.line_number,
                        "line_end": qh.line_number,
                        "severity": qh.severity,
                        "category": "quality",
                        "source": "static",
                        "title": qh.title,
                        "explanation": qh.explanation,
                        "suggested_patch": (
                            "// Refactor function into decomposed helper modules "
                            "to reduce cyclomatic complexity."
                        ),
                    }
                )

            # Real Python AST & Syntax Error Analysis (Detects SyntaxErrors)
            syntax_hits = analyze_syntax_errors(f.path, f.patch)
            for syn in syntax_hits:
                raw_findings.append(
                    {
                        "file_path": f.path,
                        "line_start": syn.line_number,
                        "line_end": syn.line_number,
                        "severity": syn.severity,
                        "category": "bug",
                        "source": "static",
                        "title": syn.title,
                        "explanation": syn.explanation,
                        "suggested_patch": syn.suggested_patch,
                    }
                )

        # 3. AI review pass (Excluding secret-bearing files)
        ai_context_parts: list[str] = []
        for f in filtered.accepted_files:
            if not is_secret_bearing_file(f.path, f.patch):
                ai_context_parts.append(
                    f"### File: {f.path}\n```{f.language}\n{f.patch}\n```"
                )

        system_prompt = "You are PR Review AI. Return valid JSON only per schema."
        user_prompt = "Review these code changes:\n" + "\n\n".join(ai_context_parts)

        llm_resp = await self.llm.review_diff(user_prompt, system_prompt)

        # 4. Validate AI findings against actual diff lines
        for ai_finding in llm_resp.content.findings:
            matching_file = next(
                (f for f in filtered.accepted_files if f.path == ai_finding.file_path),
                None,
            )
            if matching_file and validate_ai_finding(ai_finding, matching_file.patch):
                raw_findings.append(
                    {
                        "file_path": ai_finding.file_path,
                        "line_start": ai_finding.line_start,
                        "line_end": ai_finding.line_end,
                        "severity": ai_finding.severity,
                        "category": ai_finding.category,
                        "source": "ai",
                        "title": ai_finding.title,
                        "explanation": ai_finding.explanation,
                        "suggested_patch": ai_finding.suggested_patch,
                    }
                )

        # 5. Merge, rank and compute risk
        ranked_findings = merge_and_rank_findings(
            raw_findings, min_severity=config.min_severity
        )
        risk_level = calculate_overall_risk(ranked_findings)

        # 6. Publish results to GitHub
        summary_md = self.publisher.build_summary_markdown(
            pr_summary=llm_resp.content.pr_summary,
            risk_level=risk_level,
            findings=ranked_findings,
            skipped_count=len(filtered.skipped_files),
            missing_tests=llm_resp.content.missing_tests,
        )

        # 6. Publish results to GitHub (only when running on a live GitHub installation)
        review_id = None
        check_run_id = None
        if owner != "local" and self.publisher._token != "local_dev_token":
            review_id = await self.publisher.post_review_and_comments(
                owner=owner,
                repo=repo,
                pull_number=pull_number,
                head_sha=head_sha,
                findings=ranked_findings,
                summary_markdown=summary_md,
            )

            has_critical = any(f.severity == "critical" for f in ranked_findings)
            check_run_id = await self.publisher.create_check_run(
                owner=owner,
                repo=repo,
                head_sha=head_sha,
                risk_level=risk_level,
                has_critical=has_critical,
                block_on_critical=config.block_on_critical,
            )

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        logger.info(
            "review_pipeline_completed",
            repo=f"{owner}/{repo}",
            pr=pull_number,
            findings=len(ranked_findings),
            risk=risk_level,
            duration_ms=duration_ms,
        )

        return {
            "status": "completed",
            "risk_level": risk_level,
            "findings_count": len(ranked_findings),
            "findings": ranked_findings,
            "files_reviewed": len(filtered.accepted_files),
            "files_skipped": len(filtered.skipped_files),
            "duration_ms": duration_ms,
            "github_review_id": review_id,
            "check_run_id": check_run_id,
        }
