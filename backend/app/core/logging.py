"""Structured logging with security redaction filter."""

import logging
import re
from collections.abc import MutableMapping
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

# Patterns to redact from logs: tokens, keys, authorization headers
REDACT_PATTERNS = [
    re.compile(r"(?i)(authorization:\s*bearer\s+)[^\s,'\"]+"),
    re.compile(r"(?i)(token=)[^\s,'\"&]+"),
    re.compile(r"(?i)(api[_-]?key=)[^\s,'\"&]+"),
    re.compile(r"(?i)(secret=)[^\s,'\"&]+"),
    re.compile(r"(?i)(password=)[^\s,'\"&]+"),
    re.compile(r"ghp_[a-zA-Z0-9]{36}"),
    re.compile(r"ghs_[a-zA-Z0-9]{36}"),
    re.compile(r"ghr_[a-zA-Z0-9]{36}"),
    re.compile(r"AIzaSy[a-zA-Z0-9_\-]{33}"),
]


def redact_sensitive_str(text: str) -> str:
    """Masks secret substrings in string content."""
    result = text
    for pattern in REDACT_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    return result


def redact_sensitive_data(val: Any) -> Any:
    """Recursively redacts dictionary keys and values."""
    sensitive_keys = {
        "authorization",
        "token",
        "access_token",
        "secret",
        "password",
        "gemini_api_key",
        "github_app_private_key",
        "code_content",
    }
    if isinstance(val, (dict, MutableMapping)):
        new_dict: dict[str, Any] = {}
        for k, v in val.items():
            if str(k).lower() in sensitive_keys:
                new_dict[str(k)] = "[REDACTED]"
            else:
                new_dict[str(k)] = redact_sensitive_data(v)
        return new_dict
    if isinstance(val, list):
        return [redact_sensitive_data(item) for item in val]
    if isinstance(val, str):
        return redact_sensitive_str(val)
    return val


def redaction_filter_processor(
    _logger: WrappedLogger, _method_name: str, event_dict: EventDict
) -> EventDict:
    """Structlog processor ensuring no secrets or tokens appear in log events."""
    return redact_sensitive_data(event_dict)  # type: ignore[no-any-return]


def setup_logging(log_level: str = "INFO") -> None:
    """Configures structured JSON logging."""
    level_num = getattr(logging, log_level.upper(), logging.INFO)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            redaction_filter_processor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level_num),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


logger = structlog.get_logger()
