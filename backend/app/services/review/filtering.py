"""Diff fetching, file filtering, language detection and risk scoring."""

import fnmatch
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Binary and lockfile extensions to skip unconditionally
BINARY_OR_GENERATED_EXTENSIONS = {
    ".lock",
    ".min.js",
    ".min.css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".pyc",
    ".class",
    ".jar",
    ".map",
}

# Recognized programming languages for full multi-language code review
SUPPORTED_LANGUAGES = {
    # Python
    ".py": "python",
    ".pyw": "python",
    ".ipynb": "python",
    # JavaScript & TypeScript
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    # Web & Style
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".vue": "vue",
    ".svelte": "svelte",
    # Systems & Compiled
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".java": "java",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".go": "go",
    ".rs": "rust",
    ".swift": "swift",
    ".scala": "scala",
    ".dart": "dart",
    # Scripting & Backend
    ".php": "php",
    ".rb": "ruby",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".ps1": "powershell",
    ".bat": "bat",
    ".cmd": "bat",
    ".lua": "lua",
    ".r": "r",
    # Data & Query
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    # Config & Markup
    ".json": "json",
    ".jsonc": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".md": "markdown",
    ".mdx": "markdown",
    ".env": "properties",
    ".ini": "ini",
    ".dockerfile": "dockerfile",
}


# Sensitive path keywords indicating higher risk
SENSITIVE_PATH_KEYWORDS = {
    "auth",
    "login",
    "password",
    "token",
    "crypto",
    "payment",
    "billing",
    "secret",
    "credential",
    "session",
    "admin",
}

MAX_FILE_BYTES_ANALYSIS = 256 * 1024  # 256 KB


@dataclass
class FilteredFile:
    """File candidate accepted for code review."""

    path: str
    language: str
    patch: str
    lines_changed: int
    risk_score: int


@dataclass
class SkippedFile:
    """File bypassed with an explicit reason for summary reporting."""

    path: str
    reason: str


@dataclass
class FilterResult:
    """Outcome of filtering PR files."""

    accepted_files: list[FilteredFile] = field(default_factory=list)
    skipped_files: list[SkippedFile] = field(default_factory=list)


def detect_language(file_path: str, content: str | None = None) -> str:
    """Detects programming language by filename, extension, or content keywords."""
    path_obj = Path(file_path)
    base_name = path_obj.name.lower()
    suffix = path_obj.suffix.lower()

    # Special exact filenames
    if base_name in ("dockerfile", "containerfile"):
        return "dockerfile"
    if base_name in ("makefile", "gnumakefile"):
        return "makefile"
    if base_name == "jenkinsfile":
        return "groovy"
    if base_name in (".gitignore", ".dockerignore", ".npmignore"):
        return "ignore"
    if base_name in (".env", ".env.local", ".env.example", ".env.production"):
        return "properties"

    # Extension mapping
    lang = SUPPORTED_LANGUAGES.get(suffix)
    if lang:
        return lang

    # Content-based heuristic detection
    if content:
        sample = content[:1000]
        if sample.startswith("#!/bin/bash") or sample.startswith("#!/bin/sh"):
            return "shell"
        if (
            sample.startswith("#!/usr/bin/env python")
            or "def " in sample
            and "import " in sample
        ):
            return "python"
        if (
            sample.startswith("#!/usr/bin/env node")
            or "const " in sample
            and "=>" in sample
        ):
            return "javascript"

    return "text"


def compute_file_risk(file_path: str, lines_changed: int) -> int:
    """Computes a risk priority score based on paths and diff volume."""
    score = min(lines_changed, 500)
    lower_path = file_path.lower()
    for keyword in SENSITIVE_PATH_KEYWORDS:
        if keyword in lower_path:
            score += 200
    return score


def filter_pr_files(
    files: list[dict[str, Any]],
    ignore_patterns: list[str] | None = None,
    max_files: int = 40,
    max_lines: int = 2000,
) -> FilterResult:
    """Filters changed files by type, size, patterns, and ranks by risk."""
    ignore_patterns = ignore_patterns or []
    result = FilterResult()
    candidates: list[FilteredFile] = []

    for file_info in files:
        filename = file_info.get("filename", "")
        patch = file_info.get("patch", "")
        status = file_info.get("status", "")
        changes = file_info.get("changes", 0)

        # Removed or deleted file
        if status == "removed":
            result.skipped_files.append(
                SkippedFile(path=filename, reason="File was deleted")
            )
            continue

        # Ignore patterns from repository rules (.prreview.yml)
        matched_ignore = False
        for pattern in ignore_patterns:
            if fnmatch.fnmatch(filename, pattern):
                result.skipped_files.append(
                    SkippedFile(
                        path=filename, reason=f"Matched ignore pattern: {pattern}"
                    )
                )
                matched_ignore = True
                break
        if matched_ignore:
            continue

        # Extension and generated lockfiles check
        lower_name = Path(filename).name.lower()
        suffix = Path(filename).suffix.lower()
        if (
            suffix in BINARY_OR_GENERATED_EXTENSIONS
            or "lock" in lower_name
            or lower_name.endswith(".min.js")
            or lower_name.endswith(".min.css")
        ):
            result.skipped_files.append(
                SkippedFile(
                    path=filename, reason="Binary or generated lock/minified file"
                )
            )
            continue

        # Language support check (Supports all languages & code file types)
        language = detect_language(filename, patch)
        if not language:
            language = "text"

        # Empty patch
        if not patch:
            result.skipped_files.append(
                SkippedFile(path=filename, reason="No diff content")
            )
            continue

        # Compute risk and collect
        risk = compute_file_risk(filename, changes)
        candidates.append(
            FilteredFile(
                path=filename,
                language=language,
                patch=patch,
                lines_changed=changes,
                risk_score=risk,
            )
        )

    # Sort candidates by risk score descending
    candidates.sort(key=lambda f: f.risk_score, reverse=True)

    # Apply review caps: top 40 files, 2,000 lines
    total_lines = 0
    for idx, candidate in enumerate(candidates):
        if idx >= max_files:
            result.skipped_files.append(
                SkippedFile(
                    path=candidate.path,
                    reason=f"Exceeded max review limit of {max_files} files",
                )
            )
            continue

        if total_lines + candidate.lines_changed > max_lines:
            result.skipped_files.append(
                SkippedFile(
                    path=candidate.path,
                    reason=f"Exceeded max review limit of {max_lines} changed lines",
                )
            )
            continue

        total_lines += candidate.lines_changed
        result.accepted_files.append(candidate)

    return result
