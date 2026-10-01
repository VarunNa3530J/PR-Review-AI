"""Safe repository rules file (.prreview.yml) parser and schema."""

from typing import Any

import yaml
from pydantic import BaseModel, Field

from app.core.logging import logger

MAX_RULES_FILE_BYTES = 64 * 1024  # 64 KB limit per 03-security.md


class RepoReviewConfig(BaseModel):
    """Schema for repository-level review configuration."""

    ignore_paths: list[str] = Field(default_factory=list)
    min_severity: str = Field(default="low")  # critical, high, medium, low, info
    block_on_critical: bool = False
    review_drafts: bool = False
    custom_rules: list[str] = Field(default_factory=list, max_length=20)


def parse_repo_rules_yaml(content: str | None) -> RepoReviewConfig:
    """Safely loads and validates .prreview.yml with safe YAML parser.

    Falls back cleanly to safe defaults on oversized or invalid content.
    """
    if not content:
        return RepoReviewConfig()

    # Enforce file size limit
    if len(content.encode("utf-8")) > MAX_RULES_FILE_BYTES:
        logger.warning(
            "repo_rules_file_oversized",
            size_bytes=len(content.encode("utf-8")),
        )
        return RepoReviewConfig()

    try:
        data: Any = yaml.safe_load(content)
        if not isinstance(data, dict):
            return RepoReviewConfig()

        # Enforce max 20 custom rules
        custom = data.get("custom_rules", [])
        if isinstance(custom, list) and len(custom) > 20:
            data["custom_rules"] = custom[:20]

        return RepoReviewConfig.model_validate(data)
    except Exception as exc:
        logger.warning("repo_rules_parse_error", error=str(exc))
        return RepoReviewConfig()
