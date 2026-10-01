"""AI findings validation against actual PR git diffs."""

from app.services.llm.gemini import AIReviewFinding


def parse_diff_lines(patch: str) -> set[int]:
    """Parses unified diff to extract set of added/modified lines in head version."""
    modified_lines: set[int] = set()
    current_line = 0

    for line in patch.splitlines():
        if line.startswith("@@"):
            # Header format: @@ -old,count +new,count @@
            try:
                plus_part = line.split("+")[1].split("@@")[0].strip()
                start_line = int(plus_part.split(",")[0])
                current_line = start_line
            except Exception:
                continue
        elif line.startswith("+") and not line.startswith("+++"):
            modified_lines.add(current_line)
            current_line += 1
        elif not line.startswith("-"):
            current_line += 1

    return modified_lines


def validate_ai_finding(finding: AIReviewFinding, diff_patch: str) -> bool:
    """Validates that AI finding maps strictly to modified lines in the actual diff.

    Prevents hallucinated comments outside the PR scope.
    """
    valid_lines = parse_diff_lines(diff_patch)
    if not valid_lines:
        # If diff_patch is whole file content (no unified headers), allow lines within file boundary
        lines = diff_patch.splitlines()
        if len(lines) > 0 and 1 <= finding.line_start <= len(lines):
            return True
        return False

    # Check if finding line range intersects modified lines
    finding_range = set(range(finding.line_start, finding.line_end + 1))
    return len(finding_range.intersection(valid_lines)) > 0

