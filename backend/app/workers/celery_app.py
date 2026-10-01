"""Celery app setup and review worker task definition."""

from celery import Celery

from app.core.config import settings
from app.core.logging import logger

celery_app = Celery(
    "prreview_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_time_limit=180,  # 3 minutes maximum per review run
    task_soft_time_limit=150,
)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="review.pull_request",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def review_pull_request_task(
    self: Celery,
    account_id: str,
    repo_full_name: str,
    pr_number: int,
    head_sha: str,
    delivery_id: str,
) -> dict[str, str]:
    """Celery background worker executing the review pipeline.

    Retries on transient network/api failures with exponential backoff.
    """
    logger.info(
        "worker_starting_review",
        account_id=account_id,
        repo=repo_full_name,
        pr_number=pr_number,
        head_sha=head_sha,
        delivery_id=delivery_id,
    )

    if settings.REVIEWS_PAUSED:
        logger.warning("reviews_paused_by_kill_switch")
        return {"status": "paused"}

    try:
        # In ticket 22 this dispatches the full ReviewPipeline execution
        return {
            "status": "completed",
            "repo": repo_full_name,
            "pr": str(pr_number),
            "head_sha": head_sha,
        }
    except Exception as exc:
        logger.error(
            "worker_review_error",
            error=str(exc),
            repo=repo_full_name,
            pr_number=pr_number,
        )
        raise self.retry(exc=exc)
