"""Pattern and regex based secrets scanner with output masking."""

import re
from dataclasses import dataclass

# Secret detection patterns with identifying name and severity
SECRET_PATTERNS = [
    (
        "GitHub Personal Access Token",
        re.compile(r"\bghp_[a-zA-Z0-9]{36}\b"),
        "critical",
    ),
    (
        "GitHub Fine-Grained Token",
        re.compile(r"\bgithub_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}\b"),
        "critical",
    ),
    (
        "AWS Access Key ID",
        re.compile(r"\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b"),
        "critical",
    ),
    (
        "Google API Key",
        re.compile(r"\bAIzaSy[a-zA-Z0-9_\-]{33}\b"),
        "critical",
    ),
    (
        "Slack Bot Token",
        re.compile(r"\bxoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}\b"),
        "critical",
    ),
    (
        "Generic Private Key Block",
        re.compile(r"-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----"),
        "critical",
    ),
    (
        "Razorpay Secret Key",
        re.compile(r"\brzp_(test|live)_[a-zA-Z0-9]{14}\b"),
        "critical",
    ),
]


@dataclass
class SecretFinding:
    """Detected secret finding with masked content."""

    rule_name: str
    severity: str
    line_number: int
    masked_value: str
    advice: str


def mask_secret(raw_secret: str) -> str:
    """Retains first 4 characters and masks the remainder."""
    if len(raw_secret) <= 4:
        return "****"
    return raw_secret[:4] + "*" * (min(len(raw_secret) - 4, 16))


def scan_for_secrets(content: str, file_path: str = "") -> list[SecretFinding]:
    """Scans text line-by-line for leaked secrets.

    Returns findings with masked secret values (never exposes full key).
    """
    findings: list[SecretFinding] = []
    lines = content.splitlines()

    for line_idx, line in enumerate(lines, start=1):
        for name, pattern, severity in SECRET_PATTERNS:
            match = pattern.search(line)
            if match:
                matched_val = match.group(0)
                masked = mask_secret(matched_val)
                findings.append(
                    SecretFinding(
                        rule_name=name,
                        severity=severity,
                        line_number=line_idx,
                        masked_value=masked,
                        advice=(
                            f"Revoke this {name} immediately and remove it from git history."
                        ),
                    )
                )

    return findings


def is_secret_bearing_file(file_path: str, content: str) -> bool:
    """Checks if file contains live secrets or looks like a credentials file.

    Secret-bearing files are NEVER sent to AI (per 03-security.md).
    """
    lower = file_path.lower()
    if lower.endswith((".env", ".pem", ".key", ".pfx", ".p12")) or "id_rsa" in lower:
        return True

    # Check for live high-severity findings
    findings = scan_for_secrets(content, file_path)
    return len(findings) > 0
