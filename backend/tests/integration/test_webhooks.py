"""Tests for GitHub webhook signature validation and replay defense."""

import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_webhook_missing_signature() -> None:
    """Rejects webhooks with missing signature."""
    payload = {"action": "opened"}
    response = client.post(
        "/api/v1/webhooks/github",
        json=payload,
        headers={"X-GitHub-Delivery": "deliv-1", "X-GitHub-Event": "pull_request"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_webhook_invalid_signature() -> None:
    """Rejects webhooks with bad signature."""
    payload = {"action": "opened"}
    response = client.post(
        "/api/v1/webhooks/github",
        json=payload,
        headers={
            "X-Hub-Signature-256": "sha256=invalidhex000000000000000000000000000000",
            "X-GitHub-Delivery": "deliv-2",
            "X-GitHub-Event": "pull_request",
        },
    )
    assert response.status_code == 401


def test_webhook_valid_pr_and_replay_defense() -> None:
    """Valid signed payload accepts PR and ignores replay duplicate."""
    payload = {
        "action": "opened",
        "repository": {"full_name": "owner/repo"},
        "pull_request": {"number": 101, "draft": False, "head": {"sha": "abc1234"}},
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    sig = hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(), body_bytes, hashlib.sha256
    ).hexdigest()

    delivery_id = "unique-delivery-id-999"

    # First delivery -> 202 Accepted
    resp1 = client.post(
        "/api/v1/webhooks/github",
        content=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": f"sha256={sig}",
            "X-GitHub-Delivery": delivery_id,
            "X-GitHub-Event": "pull_request",
        },
    )
    assert resp1.status_code == 202
    assert resp1.json()["status"] == "enqueued"

    # Second delivery (replay attack/retry) -> 200 ignored
    resp2 = client.post(
        "/api/v1/webhooks/github",
        content=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": f"sha256={sig}",
            "X-GitHub-Delivery": delivery_id,
            "X-GitHub-Event": "pull_request",
        },
    )
    assert resp2.status_code == 200
    assert resp2.json()["reason"] == "duplicate_delivery"
