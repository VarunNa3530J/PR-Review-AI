"""Base mixins and database models definitions."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.session import Base


def utc_now() -> datetime:
    """Returns timezone-aware UTC datetime."""
    return datetime.now(UTC)


class UUIDMixin:
    """Standard UUID primary key and timestamps for all entities."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class EncryptedString(TypeDecorator[str]):
    """Decorator type for encrypting sensitive fields before storing."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        # Encrypt value with field-encryption helper
        from app.core.security import encrypt_field

        return encrypt_field(value)

    def process_result_value(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        from app.core.security import decrypt_field

        return decrypt_field(value)


class User(Base, UUIDMixin):
    """Dashboard user."""

    __tablename__ = "users"

    github_user_id: Mapped[int] = mapped_column(
        Integer, unique=True, index=True, nullable=False
    )
    login: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    sessions: Mapped[list["Session"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    account_memberships: Mapped[list["AccountMember"]] = relationship(
        back_populates="user"
    )


class Session(Base, UUIDMixin):
    """Server-side login session."""

    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="sessions")


class Account(Base, UUIDMixin):
    """Billing and ownership unit (GitHub user or organisation)."""

    __tablename__ = "accounts"

    github_account_id: Mapped[int] = mapped_column(
        Integer, unique=True, index=True, nullable=False
    )
    login: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # User or Organization
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plans.id"), nullable=True
    )

    members: Mapped[list["AccountMember"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    installations: Mapped[list["Installation"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class AccountMember(Base, UUIDMixin):
    """Membership mapping users to accounts with role."""

    __tablename__ = "account_members"
    __table_args__ = (Index("ix_account_user", "account_id", "user_id", unique=True),)

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # owner, member

    account: Mapped[Account] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="account_memberships")


class Installation(Base, UUIDMixin):
    """GitHub App installation."""

    __tablename__ = "installations"

    github_installation_id: Mapped[int] = mapped_column(
        Integer, unique=True, index=True, nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    suspended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    account: Mapped[Account] = relationship(back_populates="installations")
    repositories: Mapped[list["Repository"]] = relationship(
        back_populates="installation", cascade="all, delete-orphan"
    )


class Repository(Base, UUIDMixin):
    """Tracked GitHub repository."""

    __tablename__ = "repositories"

    github_repo_id: Mapped[int] = mapped_column(
        Integer, unique=True, index=True, nullable=False
    )
    installation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("installations.id", ondelete="CASCADE"),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    installation: Mapped[Installation] = relationship(back_populates="repositories")
    settings: Mapped["RepoSettings | None"] = relationship(
        back_populates="repository", uselist=False, cascade="all, delete-orphan"
    )
    pull_requests: Mapped[list["PullRequest"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )


class RepoSettings(Base, UUIDMixin):
    """Cached repo configuration from .prreview.yml and dashboard overrides."""

    __tablename__ = "repo_settings"

    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    config_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    config_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)

    repository: Mapped[Repository] = relationship(back_populates="settings")


class PullRequest(Base, UUIDMixin):
    """Pull request snapshot."""

    __tablename__ = "pull_requests"
    __table_args__ = (Index("ix_repo_pr_num", "repo_id", "number", unique=True),)

    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    author_login: Mapped[str] = mapped_column(String(255), nullable=False)
    head_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(
        String(50), default="open"
    )  # open, closed, merged

    repository: Mapped[Repository] = relationship(back_populates="pull_requests")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="pull_request", cascade="all, delete-orphan"
    )


class Review(Base, UUIDMixin):
    """One review run instance."""

    __tablename__ = "reviews"

    pr_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pull_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    head_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="queued"
    )  # queued, running, completed, failed
    risk_level: Mapped[str] = mapped_column(
        String(50), default="low"
    )  # low, medium, high
    files_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    files_skipped: Mapped[int] = mapped_column(Integer, default=0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd_estimate: Mapped[int] = mapped_column(
        Integer, default=0
    )  # micro-dollars ($1 = 1,000,000)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    github_review_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    check_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    pull_request: Mapped[PullRequest] = relationship(back_populates="reviews")
    findings: Mapped[list["Finding"]] = relationship(
        back_populates="review", cascade="all, delete-orphan"
    )


class Finding(Base, UUIDMixin):
    """Individual issue or recommendation found."""

    __tablename__ = "findings"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
    )
    fingerprint: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False
    )  # hash for deduplication
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    line_start: Mapped[int] = mapped_column(Integer, nullable=False)
    line_end: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # critical, high, medium, low, info
    category: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # bug, security, performance, style
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # static, ai
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_patch: Mapped[str | None] = mapped_column(Text, nullable=True)
    code_excerpt: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # max 10 lines (retention 90 days)
    github_comment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="open"
    )  # open, resolved, dismissed

    review: Mapped[Review] = relationship(back_populates="findings")
    feedback: Mapped[list["FindingFeedback"]] = relationship(
        back_populates="finding", cascade="all, delete-orphan"
    )


class FindingFeedback(Base, UUIDMixin):
    """User feedback on findings (helpful, not helpful, ignore-kind)."""

    __tablename__ = "finding_feedback"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("findings.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # helpful, not_helpful, ignore_kind
    rule_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    finding: Mapped[Finding] = relationship(back_populates="feedback")


class WebhookDelivery(Base, UUIDMixin):
    """Idempotency log for received webhooks."""

    __tablename__ = "webhook_deliveries"

    delivery_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # github, razorpay
    event: Mapped[str] = mapped_column(String(100), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Plan(Base, UUIDMixin):
    """Plan limits and pricing metadata."""

    __tablename__ = "plans"

    key: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )  # free, pro, team
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    monthly_review_limit_public: Mapped[int] = mapped_column(
        Integer, default=100
    )  # PRD default
    monthly_review_limit_private: Mapped[int] = mapped_column(
        Integer, default=20
    )  # PRD default
    price_inr_paise: Mapped[int] = mapped_column(
        Integer, default=0
    )  # Integer paise (never float)
    features_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Subscription(Base, UUIDMixin):
    """Paid subscription status."""

    __tablename__ = "subscriptions"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(50), default="razorpay")
    provider_subscription_id: Mapped[str] = mapped_column(
        String(255), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default="active"
    )  # active, past_due, canceled
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class UsageCounter(Base, UUIDMixin):
    """Reviews used per account per monthly period."""

    __tablename__ = "usage_counters"
    __table_args__ = (Index("ix_account_period", "account_id", "period", unique=True),)

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    period: Mapped[str] = mapped_column(
        String(7), nullable=False
    )  # Format YYYY-MM (e.g. 2026-10)
    public_used: Mapped[int] = mapped_column(Integer, default=0)
    private_used: Mapped[int] = mapped_column(Integer, default=0)


class NotificationSettings(Base, UUIDMixin):
    """Account alert configuration."""

    __tablename__ = "notification_settings"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    slack_webhook_encrypted: Mapped[str | None] = mapped_column(
        EncryptedString, nullable=True
    )


class AuditLog(Base, UUIDMixin):
    """Security and action audit trail."""

    __tablename__ = "audit_log"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
