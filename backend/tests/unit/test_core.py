"""Tests for backend core functionality (config, logging, errors)."""

import pytest

from app.core.config import Settings
from app.core.errors import AppError, RateLimitError
from app.core.logging import redact_sensitive_data, redact_sensitive_str


def test_config_minimum_key_length() -> None:
    """Session and encryption keys must be >= 32 characters."""
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(SESSION_SIGNING_KEY="short")

    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(FIELD_ENCRYPTION_KEY="short")


def test_production_invariants() -> None:
    """Production mode refuses free-tier Gemini or missing keys."""
    prod_settings = Settings(
        APP_ENV="production",
        GEMINI_KEY_TIER="free",
        SESSION_SIGNING_KEY="a" * 32,
        FIELD_ENCRYPTION_KEY="b" * 32,
    )
    with pytest.raises(ValueError, match="paid GEMINI_KEY_TIER"):
        prod_settings.validate_production()


def test_log_redaction_strings() -> None:
    """Tests redaction of tokens and keys in log text."""
    log_sample = (
        "User logged in with token=ghp_123456789012345678901234567890123456 and key"
    )
    redacted = redact_sensitive_str(log_sample)
    assert "ghp_" not in redacted
    assert "[REDACTED]" in redacted


def test_log_redaction_dict() -> None:
    """Tests dictionary field masking."""
    data = {
        "user": "developer",
        "authorization": "Bearer secret_jwt_token",
        "nested": {"token": "my_secret_token", "info": "safe"},
    }
    redacted = redact_sensitive_data(data)
    assert redacted["authorization"] == "[REDACTED]"
    assert redacted["nested"]["token"] == "[REDACTED]"
    assert redacted["nested"]["info"] == "safe"


def test_error_classes() -> None:
    """Tests standard AppError structure."""
    err = AppError("INVALID_INPUT", "Bad format", 400)
    assert err.code == "INVALID_INPUT"
    assert err.status_code == 400

    rate_err = RateLimitError(retry_after=45)
    assert rate_err.code == "RATE_LIMITED"
    assert rate_err.retry_after == 45
