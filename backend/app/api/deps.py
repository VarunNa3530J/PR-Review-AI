"""Multi-tenant isolation dependency guard."""

from typing import Annotated

from fastapi import Cookie, Depends
from pydantic import BaseModel

from app.api.v1.auth import ACTIVE_SESSIONS
from app.core.errors import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import hash_token


class CurrentAccount(BaseModel):
    """Holds validated account context derived from session."""

    account_id: str
    user_id: str
    role: str  # owner, member


async def get_current_account(
    session_token: str | None = Cookie(None),
) -> CurrentAccount:
    """Resolves account_id strictly from session (never client request).

    Guarantees cross-tenant boundary isolation.
    """
    if not session_token:
        # In local dev environment, provide fallback current account
        # so frontend preview works seamlessly
        from app.core.config import settings

        if settings.APP_ENV == "local":
            return CurrentAccount(
                account_id="dev-account-local-001",
                user_id="dev-user-local-001",
                role="owner",
            )
        raise UnauthorizedError("Authentication required.")

    token_hash = hash_token(session_token)
    session_data = ACTIVE_SESSIONS.get(token_hash)
    if not session_data:
        from app.core.config import settings

        if settings.APP_ENV == "local":
            return CurrentAccount(
                account_id="dev-account-local-001",
                user_id="dev-user-local-001",
                role="owner",
            )
        raise UnauthorizedError("Invalid or expired session.")

    return CurrentAccount(
        account_id=session_data["account_id"],
        user_id=session_data["user_id"],
        role=session_data["role"],
    )


def require_owner(
    current: Annotated[CurrentAccount, Depends(get_current_account)],
) -> CurrentAccount:
    """Enforces owner-only permission guard."""
    if current.role != "owner":
        raise ForbiddenError("Only account owners can perform this action.")
    return current


def verify_account_resource(resource_account_id: str, caller_account_id: str) -> None:
    """Verifies that the requested resource belongs to caller's account.

    Always returns 404 on mismatch to avoid leaking resource existence.
    """
    if str(resource_account_id) != str(caller_account_id):
        raise NotFoundError("Resource not found.")
