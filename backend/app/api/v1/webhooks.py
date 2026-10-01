"""GitHub webhook receiver router."""

from typing import Any

from fastapi import APIRouter, Header, Request, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import AppError, UnauthorizedError
from app.core.logging import logger
from app.core.security import verify_hmac_sha256

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Supported pull request events for triggering review pipeline
SUPPORTED_PR_ACTIONS = {"opened", "synchronize", "reopened", "ready_for_review"}

# In-memory delivery tracker for idempotency (backed by DB in production)
PROCESSED_DELIVERIES: set[str] = set()


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def handle_github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: str | None = Header(None, alias="X-GitHub-Delivery"),
    x_github_event: str | None = Header(None, alias="X-GitHub-Event"),
) -> JSONResponse:
    """Receives and validates GitHub webhook events.

    Security invariants:
    1. Body size capped at 5 MB (abuse control).
    2. Webhook signature MUST be verified before reading or parsing payload.
    3. Idempotency verified by X-GitHub-Delivery to avoid replay.
    """
    body = await request.body()

    # 1. Body size cap (5 MB)
    if len(body) > 5 * 1024 * 1024:
        raise AppError("PAYLOAD_TOO_LARGE", "Webhook body exceeds 5 MB limit", 413)

    # 2. Signature verification before JSON parsing
    if not x_hub_signature_256 or not verify_hmac_sha256(
        settings.GITHUB_WEBHOOK_SECRET, body, x_hub_signature_256
    ):
        logger.warning(
            "github_webhook_bad_signature",
            delivery_id=x_github_delivery,
            github_event=x_github_event,
        )
        raise UnauthorizedError("Invalid or missing webhook signature.")

    # 3. Idempotency check
    if not x_github_delivery:
        raise AppError("MISSING_HEADER", "X-GitHub-Delivery header is required", 400)

    if x_github_delivery in PROCESSED_DELIVERIES:
        logger.info("github_webhook_duplicate_ignored", delivery_id=x_github_delivery)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "reason": "duplicate_delivery"},
        )

    PROCESSED_DELIVERIES.add(x_github_delivery)

    # 4. Parse payload
    payload: dict[str, Any] = await request.json()

    # 5. Process PR events
    if x_github_event == "pull_request":
        action = payload.get("action")
        pr_data = payload.get("pull_request", {})
        is_draft = pr_data.get("draft", False)

        if action in SUPPORTED_PR_ACTIONS and not is_draft:
            repo = payload.get("repository", {}).get("full_name")
            pr_number = pr_data.get("number")
            head_sha = pr_data.get("head", {}).get("sha")

            logger.info(
                "pull_request_review_queued",
                repo=repo,
                pr_number=pr_number,
                head_sha=head_sha,
                delivery_id=x_github_delivery,
            )
            # Pipeline worker task will be dispatched here in Ticket 10/22
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={"status": "enqueued", "pr": pr_number, "repo": repo},
            )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "acknowledged", "event": x_github_event},
    )
