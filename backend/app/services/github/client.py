"""GitHub App authentication and client services."""

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.core.errors import AppError, NotFoundError, UnauthorizedError
from app.core.logging import logger

# Note on installation token lifetime:
# Per official GitHub REST docs (and re-confirmed 1 Oct 2026):
# "Installation access tokens expire after 1 hour."
TOKEN_EXPIRY_SECONDS = 3600
TOKEN_CACHE_BUFFER_SECONDS = 300  # Refresh 5 mins before expiry


class GitHubAuth:
    """Manages GitHub App RS256 JWT signing and installation token caching."""

    def __init__(self) -> None:
        self._tokens: dict[int, tuple[str, datetime]] = {}

    def create_app_jwt(self) -> str:
        """Creates a signed RS256 JWT for authenticating as the GitHub App.

        Valid for 10 minutes (maximum permitted by GitHub).
        """
        now = datetime.now(UTC)
        payload = {
            "iat": int((now - timedelta(seconds=60)).timestamp()),  # 60s clock skew
            "exp": int((now + timedelta(minutes=9)).timestamp()),
            "iss": settings.GITHUB_APP_ID,
        }
        if not settings.GITHUB_APP_PRIVATE_KEY:
            raise UnauthorizedError("GitHub App private key is not configured.")

        # Ensure correct key formatting
        key_bytes = settings.GITHUB_APP_PRIVATE_KEY.encode("utf-8")
        return jwt.encode(payload, key_bytes, algorithm="RS256")

    async def get_installation_token(self, installation_id: int) -> str:
        """Returns valid installation token, exchanging or refreshing if near expiry."""
        now = datetime.now(UTC)
        if installation_id in self._tokens:
            token, expiry = self._tokens[installation_id]
            if expiry - now > timedelta(seconds=TOKEN_CACHE_BUFFER_SECONDS):
                return token

        # Exchange app JWT for installation token
        app_jwt = self.create_app_jwt()
        url = (
            f"https://api.github.com/app/installations/{installation_id}/access_tokens"
        )
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers)
            if resp.status_code == 404:
                raise NotFoundError(
                    f"Installation {installation_id} not found on GitHub."
                )
            if resp.status_code != 201:
                logger.error(
                    "github_token_exchange_failed",
                    installation_id=installation_id,
                    status_code=resp.status_code,
                )
                raise UnauthorizedError("Failed to obtain installation token.")

            data = resp.json()
            token = str(data["token"])
            expires_at = datetime.fromisoformat(
                data["expires_at"].replace("Z", "+00:00")
            )
            # Store in-memory only (Never persist or log installation tokens)
            self._tokens[installation_id] = (token, expires_at)
            return token


class GitHubClient:
    """HTTP client for GitHub REST calls with rate limiting and exponential backoff."""

    def __init__(self, token: str):
        self._token = token
        self._base_url = "https://api.github.com"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "PR-Review-AI",
        }

    @retry(
        retry=retry_if_exception_type((httpx.NetworkError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def get_pull_request_files(
        self, owner: str, repo: str, pull_number: int
    ) -> list[dict[str, Any]]:
        """Lists changed files and patches for a pull request."""
        url = f"{self._base_url}/repos/{owner}/{repo}/pulls/{pull_number}/files"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                url, headers=self._headers(), params={"per_page": 100}
            )
            if resp.status_code == 404:
                raise NotFoundError(f"PR #{pull_number} not found in {owner}/{repo}")
            if resp.status_code == 403 and "rate limit" in resp.text.lower():
                raise AppError(
                    "GITHUB_RATE_LIMIT", "GitHub API rate limit exceeded", 429
                )
            resp.raise_for_status()
            return resp.json()  # type: ignore[no-any-return]

    async def get_file_content(
        self, owner: str, repo: str, path: str, ref: str
    ) -> str | None:
        """Fetches raw content of a specific file at a commit ref."""
        url = f"{self._base_url}/repos/{owner}/{repo}/contents/{path}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                headers={
                    **self._headers(),
                    "Accept": "application/vnd.github.raw+json",
                },
                params={"ref": ref},
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.text
