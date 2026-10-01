"""Tests for security primitives: HMAC verification, AES-GCM encryption, safe paths."""

import hashlib
import hmac
from pathlib import Path

import pytest

from app.core.security import (
    decrypt_field,
    encrypt_field,
    generate_secure_token,
    hash_token,
    safe_path_join,
    verify_hmac_sha256,
)


def test_hmac_verification() -> None:
    """Verifies constant time HMAC-SHA256 signature verification."""
    secret = "test_webhook_secret_key"
    body = b'{"action": "opened", "number": 42}'
    computed_hex = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    # Valid signature with sha256= prefix
    assert verify_hmac_sha256(secret, body, f"sha256={computed_hex}") is True
    # Valid signature without prefix (Razorpay style)
    assert verify_hmac_sha256(secret, body, computed_hex) is True

    # Tampered body
    tampered_body = b'{"action": "opened", "number": 43}'
    assert verify_hmac_sha256(secret, tampered_body, f"sha256={computed_hex}") is False

    # Wrong secret or missing
    assert verify_hmac_sha256("wrong_secret", body, f"sha256={computed_hex}") is False
    assert verify_hmac_sha256("", body, f"sha256={computed_hex}") is False
    assert verify_hmac_sha256(secret, body, "") is False


def test_field_encryption_roundtrip() -> None:
    """Tests AES-GCM field encryption and decryption."""
    original_text = "https://hooks.slack.com/services/T000/B000/secret_token_12345"
    encrypted = encrypt_field(original_text)

    assert encrypted != original_text
    assert len(encrypted) > 20

    decrypted = decrypt_field(encrypted)
    assert decrypted == original_text


def test_secure_tokens() -> None:
    """Tests token generation and deterministic hashing."""
    tok1 = generate_secure_token()
    tok2 = generate_secure_token()
    assert tok1 != tok2

    h1 = hash_token(tok1)
    h2 = hash_token(tok1)
    assert h1 == h2
    assert len(h1) == 64


def test_safe_path_join(tmp_path: Path) -> None:
    """Ensures directory traversal attempts are rejected."""
    base_dir = tmp_path / "sandbox"
    base_dir.mkdir()

    # Safe subpath
    safe = safe_path_join(base_dir, "src/components/Button.tsx")
    assert safe == (base_dir / "src/components/Button.tsx").resolve()

    # Malicious relative paths
    with pytest.raises(ValueError, match="Path traversal"):
        safe_path_join(base_dir, "../../../etc/passwd")

    with pytest.raises(ValueError, match="Path traversal"):
        safe_path_join(base_dir, "..")
