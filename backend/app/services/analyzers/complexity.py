"""Code quality and complexity analyzer."""

from dataclasses import dataclass

MAX_FUNCTION_LINES = 60
MAX_NESTING_LEVEL = 4


@dataclass
class QualityFinding:
    """Finding for code smell or complexity issue."""

    file_path: str
    line_number: int
    severity: str
    title: str
    explanation: str


def analyze_code_quality(file_path: str, content: str) -> list[QualityFinding]:
    """Analyzes function length and indentation depth as complexity indicators."""
    findings: list[QualityFinding] = []
    lines = content.splitlines()

    current_fn_start = 0
    fn_line_count = 0

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Simple detection of function start (Python, JS/TS, Java)
        if (
            stripped.startswith(("def ", "function ", "public ", "private "))
            and "(" in stripped
        ):
            if fn_line_count > MAX_FUNCTION_LINES:
                findings.append(
                    QualityFinding(
                        file_path=file_path,
                        line_number=current_fn_start,
                        severity="low",
                        title="Long Function Exceeds Threshold",
                        explanation=(
                            f"Function has {fn_line_count} lines. Consider refactoring "
                            f"functions larger than {MAX_FUNCTION_LINES} lines."
                        ),
                    )
                )
            current_fn_start = idx
            fn_line_count = 0
        elif current_fn_start > 0:
            fn_line_count += 1

        # Check excessive nesting
        leading_spaces = len(line) - len(line.lstrip(" "))
        indent_level = leading_spaces // 4
        if indent_level > MAX_NESTING_LEVEL and stripped:
            findings.append(
                QualityFinding(
                    file_path=file_path,
                    line_number=idx,
                    severity="info",
                    title="Deeply Nested Code Block",
                    explanation=(
                        f"Nesting level ({indent_level}) exceeds recommended maximum "
                        f"of {MAX_NESTING_LEVEL}. Consider early return or "
                        "extracting helpers."
                    ),
                )
            )

    return findings
