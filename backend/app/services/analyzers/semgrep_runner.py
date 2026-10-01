"""Static analysis rules runner executing inside secure sandbox temp directories."""

from dataclasses import dataclass
import re
from typing import Pattern

# Custom static security checks for injection, unsafe deserialization, weak crypto, etc.
STATIC_SECURITY_RULES: list[dict[str, str | Pattern[str]]] = [
    {
        "id": "SEC-001",
        "title": "SQL Injection Risk (Raw string formatting in SQL query)",
        "pattern": re.compile(
            r"""(?i)["'].*?\b(select\s+.+\s+from|insert\s+into\s+.+\s+values|update\s+.+\s+set|delete\s+from)\b.*?(%s|\+|f['"]|\{[a-zA-Z0-9_]+\}|\.format)"""
        ),
        "severity": "critical",
        "category": "security",
        "explanation": (
            "Direct string formatting or interpolation in SQL queries causes "
            "SQL injection vulnerabilities. Use parameterized queries."
        ),
    },
    {
        "id": "SEC-002",
        "title": "Command Injection / Dangerous Subprocess execution",
        "pattern": re.compile(r"""(?i)(os\.system|shell\s*=\s*True|eval\(|exec\()"""),
        "severity": "critical",
        "category": "security",
        "explanation": (
            "Executing shell commands with string concatenation or eval can lead to "
            "arbitrary code execution."
        ),
    },
    {
        "id": "SEC-003",
        "title": "Unsafe Deserialization (pickle/yaml.load)",
        "pattern": re.compile(r"""(?i)(pickle\.loads?|yaml\.load\([^,)]+\))"""),
        "severity": "high",
        "category": "security",
        "explanation": (
            "Deserializing untrusted data with pickle or unsafe yaml.load allows "
            "arbitrary code execution. Use yaml.safe_load or json."
        ),
    },
    {
        "id": "SEC-004",
        "title": "Weak Cryptographic Hash (MD5 / SHA1)",
        "pattern": re.compile(
            r"""(?i)(hashlib\.md5|hashlib\.sha1|crypto\.createHash\(['"]md5)"""
        ),
        "severity": "medium",
        "category": "security",
        "explanation": (
            "MD5 and SHA1 are cryptographically broken and vulnerable to collisions. "
            "Use SHA256 or stronger."
        ),
    },
    {
        "id": "SEC-005",
        "title": "Hardcoded Secret / Password assignment",
        "pattern": re.compile(
            r"""(?i)(password|secret|api_key|token|auth_token)\s*[:=]\s*['"][a-zA-Z0-9_\-\$]{8,}['"]"""
        ),
        "severity": "critical",
        "category": "security",
        "explanation": (
            "Hardcoding credentials or API tokens in source code leaks sensitive production keys. "
            "Store in environment variables or a secret vault."
        ),
    },
    {
        "id": "SEC-006",
        "title": "Cross-Site Scripting (XSS) / Unsafe HTML Injection",
        "pattern": re.compile(
            r"""(?i)(dangerouslySetInnerHTML|innerHTML\s*=|document\.write\(|\$\(.*?\)\.html\()"""
        ),
        "severity": "high",
        "category": "security",
        "explanation": (
            "Directly inserting unescaped HTML into the DOM leads to Cross-Site Scripting (XSS). "
            "Use sanitized inputs or framework-native text interpolation."
        ),
    },
    {
        "id": "SEC-007",
        "title": "Insecure CORS Wildcard Header",
        "pattern": re.compile(
            r"""(?i)Access-Control-Allow-Origin['"]?\s*[:=]\s*['"]\*['"]"""
        ),
        "severity": "medium",
        "category": "security",
        "explanation": (
            "Permissive wildcard CORS '*' allows arbitrary origins to request authenticated data. "
            "Explicitly whitelist authorized hostnames."
        ),
    },
    {
        "id": "SEC-008",
        "title": "Sensitive Information Leak in Console Logging",
        "pattern": re.compile(
            r"""(?i)console\.(log|debug|info)\(.*?(password|token|secret|auth|bearer|credit_card)"""
        ),
        "severity": "medium",
        "category": "security",
        "explanation": (
            "Logging credentials or auth tokens to client/server console exposes sensitive data in logs."
        ),
    },
    {
        "id": "SEC-009",
        "title": "Disabled TLS / Insecure HTTP Request",
        "pattern": re.compile(
            r"""(?i)(http://(?!localhost|127\.0\.0\.1)[a-zA-Z0-9\-_.]+|rejectUnauthorized:\s*false|verify\s*=\s*False)"""
        ),
        "severity": "high",
        "category": "security",
        "explanation": (
            "Using plain HTTP or disabling TLS verification exposes API communications to man-in-the-middle interception."
        ),
    },
    {
        "id": "SEC-010",
        "title": "Unsafe Regex Vulnerable to ReDoS",
        "pattern": re.compile(
            r"""(?:re\.compile|RegExp)\s*\(\s*['"][^'"]*?\([a-zA-Z0-9_]+[\*\+][\*\+][^'"]*?['"]"""
        ),
        "severity": "medium",
        "category": "security",
        "explanation": (
            "Catastrophic backtracking regular expression pattern causes Regular Expression Denial of Service (ReDoS)."
        ),
    },
]


@dataclass
class StaticFinding:
    """Finding generated by static rule scan."""

    rule_id: str
    title: str
    severity: str
    category: str
    file_path: str
    line_number: int
    explanation: str


def run_static_security_scan(file_path: str, content: str) -> list[StaticFinding]:
    """Runs regex security rule checks on file content."""
    findings: list[StaticFinding] = []
    lines = content.splitlines()

    for line_idx, line in enumerate(lines, start=1):
        for rule in STATIC_SECURITY_RULES:
            pat = rule["pattern"]
            if isinstance(pat, Pattern) and pat.search(line):
                findings.append(
                    StaticFinding(
                        rule_id=str(rule["id"]),
                        title=str(rule["title"]),
                        severity=str(rule["severity"]),
                        category=str(rule["category"]),
                        file_path=file_path,
                        line_number=line_idx,
                        explanation=str(rule["explanation"]),
                    )
                )

    return findings
