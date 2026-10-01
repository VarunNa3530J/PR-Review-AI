"""Application configuration using Pydantic Settings."""

from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Core
    APP_ENV: Literal["local", "staging", "production"] = "local"
    API_BASE_URL: str = "http://localhost:8000"
    WEB_BASE_URL: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"
    SESSION_SIGNING_KEY: str = Field(
        default="local_dev_session_signing_key_32_characters_minimum"
    )
    FIELD_ENCRYPTION_KEY: str = Field(
        default="local_dev_field_encryption_key_32_chars_min!"
    )
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/prreview"
    REDIS_URL: str = "redis://localhost:6379/0"

    # GitHub
    GITHUB_APP_ID: int = 0
    GITHUB_APP_SLUG: str = "pr-review-ai-dev"
    GITHUB_APP_PRIVATE_KEY: str = ""
    GITHUB_WEBHOOK_SECRET: str = "dev_webhook_secret_key"
    GITHUB_OAUTH_CLIENT_ID: str = ""
    GITHUB_OAUTH_CLIENT_SECRET: str = ""

    # AI
    GEMINI_API_KEY: str = ""
    GEMINI_KEY_TIER: Literal["free", "paid"] = "free"
    LLM_REVIEW_MODEL: str = "gemini-3.8-flash"
    LLM_LIGHT_MODEL: str = "gemini-3.5-flash-lite"
    LLM_PRICE_REVIEW_IN_PER_M: int = 750000  # micro-dollars per 1M tokens ($0.75)
    LLM_PRICE_REVIEW_OUT_PER_M: int = 3750000  # micro-dollars ($3.75)
    LLM_PRICE_LIGHT_IN_PER_M: int = 300000  # micro-dollars ($0.30)
    LLM_PRICE_LIGHT_OUT_PER_M: int = 2500000  # micro-dollars ($2.50)
    MAX_FILES_PER_REVIEW: int = 40
    MAX_LINES_PER_REVIEW: int = 2000
    MAX_TOKENS_PER_REVIEW: int = 30000

    # Billing and Notifications
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    EMAIL_PROVIDER_API_KEY: str = ""
    EMAIL_FROM: str = "alerts@prreview.ai"

    # Safety Switches
    REVIEWS_PAUSED: bool = False
    DAILY_SPEND_ALARM_USD: int = 50
    ERROR_TRACKING_DSN: str = ""

    @field_validator("SESSION_SIGNING_KEY")
    @classmethod
    def validate_session_key(cls, v: str) -> str:
        """Enforces minimum 32 chars for secure session signing."""
        if len(v.strip()) < 32:
            raise ValueError("SESSION_SIGNING_KEY must be at least 32 characters long.")
        return v

    @field_validator("FIELD_ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        """Enforces minimum length for field encryption key."""
        if len(v.strip()) < 32:
            raise ValueError(
                "FIELD_ENCRYPTION_KEY must be at least 32 characters long."
            )
        return v

    def validate_production(self) -> None:
        """Validates security invariants for production deployment."""
        if self.APP_ENV == "production":
            if self.GEMINI_KEY_TIER != "paid":
                raise ValueError("Production mode requires paid GEMINI_KEY_TIER.")
            if not self.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is required in production.")
            if not self.GITHUB_APP_PRIVATE_KEY:
                raise ValueError("GITHUB_APP_PRIVATE_KEY is required in production.")
            if not self.GITHUB_WEBHOOK_SECRET:
                raise ValueError("GITHUB_WEBHOOK_SECRET is required in production.")


settings = Settings()
