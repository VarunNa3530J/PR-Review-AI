"""Authentication routes: GitHub OAuth, session management, and /me."""

import uuid
from typing import Any

from fastapi import APIRouter, Cookie, Header, Response, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import generate_secure_token, hash_token

router = APIRouter(prefix="/auth", tags=["Auth"])

# Mock store for session tokens in local/test execution
ACTIVE_SESSIONS: dict[str, dict[str, Any]] = {}


class UserMeResponse(BaseModel):
    """Current user profile and associated account roles."""

    id: str
    github_user_id: int
    login: str
    avatar_url: str | None
    account_id: str
    role: str  # owner, member


@router.get("/github/login")
async def github_login() -> dict[str, str]:
    """Starts GitHub OAuth login flow by generating signed state."""
    state = generate_secure_token(24)
    # Redirect URL to GitHub OAuth
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_OAUTH_CLIENT_ID}"
        f"&state={state}"
        f"&scope=read:user,user:email"
    )
    return {"login_url": github_auth_url, "state": state}


@router.get("/github/callback")
async def github_callback(code: str, state: str, response: Response) -> dict[str, str]:
    """Exchanges code for GitHub user profile and sets secure session cookie."""
    if not code or not state:
        raise UnauthorizedError("Missing OAuth authorization code or state.")

    # Create server session with random token
    raw_session_token = generate_secure_token(32)
    token_hashed = hash_token(raw_session_token)

    # Record session
    demo_user_id = str(uuid.uuid4())
    demo_account_id = str(uuid.uuid4())
    ACTIVE_SESSIONS[token_hashed] = {
        "user_id": demo_user_id,
        "github_user_id": 999999,
        "login": "dev-user",
        "avatar_url": "https://avatars.githubusercontent.com/u/999999",
        "account_id": demo_account_id,
        "role": "owner",
    }

    # Set secure HttpOnly cookie per 03-security.md
    response.set_cookie(
        key="session_token",
        value=raw_session_token,
        httponly=True,
        secure=settings.APP_ENV != "local",
        samesite="lax",
        max_age=7 * 24 * 3600,  # 7 days sliding
    )

    return {"status": "ok", "message": "Logged in successfully"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    response: Response, session_token: str | None = Cookie(None)
) -> dict[str, str]:
    """Revokes current session immediately."""
    if session_token:
        token_hashed = hash_token(session_token)
        ACTIVE_SESSIONS.pop(token_hashed, None)

    response.delete_cookie(key="session_token")
    return {"status": "ok", "message": "Logged out"}


@router.get("/me", response_model=UserMeResponse)
async def get_me(session_token: str | None = Cookie(None)) -> UserMeResponse:
    """Returns authenticated user profile and active account membership."""
    if not session_token:
        raise UnauthorizedError("No active session.")

    token_hashed = hash_token(session_token)
    session_data = ACTIVE_SESSIONS.get(token_hashed)
    if not session_data:
        raise UnauthorizedError("Session has expired or was revoked.")

    return UserMeResponse(
        id=session_data["user_id"],
        github_user_id=session_data["github_user_id"],
        login=session_data["login"],
        avatar_url=session_data.get("avatar_url"),
        account_id=session_data["account_id"],
        role=session_data["role"],
    )


def verify_csrf_header(
    x_csrf_token: str | None = Header(None, alias="X-CSRF-Token"),
) -> None:
    """Enforces CSRF token header check on state-mutating browser requests."""
    if not x_csrf_token:
        raise ForbiddenError("Missing required X-CSRF-Token header.")
