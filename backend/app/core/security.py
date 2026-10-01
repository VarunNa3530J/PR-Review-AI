"""Security primitives: HMAC, encryption, tokens, hashing, and safe paths."""

import base64
import hashlib
import hmac
import os
import secrets
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def verify_hmac_sha256(secret: str, body: bytes, signature_header: str) -> bool:
    """Constant-time HMAC-SHA256 signature verification.

    Accepts signature formatted either as 'sha256=HEX' (GitHub) or raw hex (Razorpay).
    """
    if not secret or not signature_header or not body:
        return False

    expected_sig = signature_header
    if expected_sig.startswith("sha256="):
        expected_sig = expected_sig.split("sha256=")[-1]

    computed_hmac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hmac, expected_sig)


def _get_aes_key() -> bytes:
    """Derives 32-byte AES key from settings."""
    raw_key = settings.FIELD_ENCRYPTION_KEY.encode("utf-8")
    return hashlib.sha256(raw_key).digest()


def encrypt_field(plaintext: str) -> str:
    """Encrypts plaintext string using AES-GCM (authenticated encryption)."""
    if not plaintext:
        return ""
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # Pack nonce + ciphertext and base64-encode
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_field(encrypted_b64: str) -> str:
    """Decrypts base64-encoded AES-GCM ciphertext."""
    if not encrypted_b64:
        return ""
    try:
        data = base64.b64decode(encrypted_b64.encode("utf-8"))
        if len(data) < 12:
            return ""
        nonce = data[:12]
        ciphertext = data[12:]
        key = _get_aes_key()
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception:
        return ""


def generate_secure_token(length: int = 32) -> str:
    """Generates URL-safe random string for sessions/tokens."""
    return secrets.token_urlsafe(length)


def hash_token(token: str) -> str:
    """Generates SHA-256 hash of token to store in database."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def safe_path_join(base_dir: Path | str, untrusted_relative_path: str) -> Path:
    """Safely joins paths, rejecting traversal attacks, absolute paths, or symlinks.

    Raises ValueError if path escapes base_dir.
    """
    base = Path(base_dir).resolve()
    # Reject leading slashes and Windows drive letters
    cleaned = untrusted_relative_path.lstrip("/\\")
    target = (base / cleaned).resolve()

    # Verify target stays strictly within base directory
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise ValueError(
            f"Path traversal detected for '{untrusted_relative_path}'."
        ) from exc

    return target
