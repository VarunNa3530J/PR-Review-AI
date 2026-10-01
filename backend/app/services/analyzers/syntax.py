"""Real AST and Language-Specific Syntax Error Analyzers."""

import ast
import re
from dataclasses import dataclass


@dataclass
class SyntaxFinding:
    """Finding for syntax errors, unexpected dots, or invalid language constructs."""

    file_path: str
    line_number: int
    column_number: int
    severity: str
    title: str
    explanation: str
    suggested_patch: str | None = None


def analyze_syntax_errors(file_path: str, content: str) -> list[SyntaxFinding]:
    """Analyzes source code using real Python AST and JS/TS regex checks.

    Detects syntax errors such as:
    - Trailing dots: `obj.` or `var.`
    - Double dots: `obj..prop`
    - Stray dot operators: `x. + y` or `a . b`
    - Incomplete member accesses: `import os.` or `from math import .`
    - Indentation & unclosed brackets
    """
    findings: list[SyntaxFinding] = []
    lines = content.splitlines()

    # 1. Real Python AST Syntax & Parse Error Detection
    is_python = file_path.endswith((".py", ".pyw")) or (
        not file_path.endswith((".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css"))
        and ("def " in content or "import " in content or "print(" in content)
    )

    if is_python:
        try:
            ast.parse(content, filename=file_path)
        except SyntaxError as syn_err:
            line_no = syn_err.lineno or 1
            col_no = syn_err.offset or 1
            err_line = lines[line_no - 1] if 0 < line_no <= len(lines) else ""
            err_msg = syn_err.msg or "invalid syntax"

            candidates: list[str] = []

            # Candidate 1: Dot before operator/punctuation e.g. a. + b -> a + b
            c1 = re.sub(r"\.\s*([\)\,\:\;\]\}])", r"\1", err_line)
            c1 = re.sub(r"\.\s*([\+\-\*\/\%\=])", r" \1", c1)
            if c1.rstrip() != err_line.rstrip():
                candidates.append(c1.rstrip())

            # Candidate 2: Trailing dot e.g. return x. -> return x
            c2 = re.sub(r"\.\s*$", "", err_line)
            if c2.rstrip() != err_line.rstrip():
                candidates.append(c2.rstrip())

            # Candidate 3: Consecutive double dots e.g. user..name -> user.name
            c3 = re.sub(r"\.\.+", ".", err_line)
            if c3.rstrip() != err_line.rstrip():
                candidates.append(c3.rstrip())

            # Candidate 4: Stray dot around col_no offset
            if col_no > 0 and col_no <= len(err_line) + 1:
                idx = col_no - 1
                for search_idx in [idx, idx - 1, idx + 1]:
                    if 0 <= search_idx < len(err_line) and err_line[search_idx] == ".":
                        c4 = err_line[:search_idx] + err_line[search_idx + 1 :]
                        if c4.rstrip() != err_line.rstrip():
                            candidates.append(c4.rstrip())

            # Candidate 5: General removal of orphan dot on identifier
            c5 = re.sub(r"([a-zA-Z0-9_])\.(?=[^\w\d\.]|$)", r"\1", err_line)
            if c5.rstrip() != err_line.rstrip():
                candidates.append(c5.rstrip())

            # Candidate 6: Unclosed parenthesis / brackets / braces
            open_parens = err_line.count("(") - err_line.count(")")
            open_brackets = err_line.count("[") - err_line.count("]")
            open_braces = err_line.count("{") - err_line.count("}")
            if open_parens > 0 or open_brackets > 0 or open_braces > 0:
                c6 = (
                    err_line.rstrip()
                    + (")" * max(0, open_parens))
                    + ("]" * max(0, open_brackets))
                    + ("}" * max(0, open_braces))
                )
                candidates.append(c6)
                # Also check if lowercase built-in e.g. Print(x -> print(x)
                if re.match(r"^\s*Print\(", err_line):
                    c6_lower = re.sub(r"^(\s*)Print\(", r"\1print(", c6)
                    candidates.insert(0, c6_lower)

            # Candidate 7: Missing colon at end of statement
            if re.search(
                r"^\s*(def|if|elif|else|for|while|class|try|except|finally|with)\b",
                err_line,
            ) and not err_line.rstrip().endswith(":"):
                candidates.append(err_line.rstrip() + ":")

            # Candidate 8: Single or double quote unclosed on line
            if err_line.count('"') % 2 != 0:
                candidates.append(err_line.rstrip() + '"')
            if err_line.count("'") % 2 != 0:
                candidates.append(err_line.rstrip() + "'")

            # Validate candidates against AST parser to pick the exact verified fix
            best_candidate = None
            for cand in candidates:
                test_lines = list(lines)
                test_lines[line_no - 1] = cand
                test_content = "\n".join(test_lines)
                try:
                    ast.parse(test_content, filename=file_path)
                    best_candidate = cand
                    break
                except SyntaxError as next_err:
                    if (next_err.lineno or 1) > line_no:
                        best_candidate = cand
                        break

            if not best_candidate and candidates:
                best_candidate = candidates[0]

            suggested = None
            if best_candidate and best_candidate.rstrip() != err_line.rstrip():
                suggested = f"- {err_line.rstrip()}\n+ {best_candidate.rstrip()}"
                title = (
                    "Python Syntax Error: Invalid Dot Typo"
                    if "." in err_line and "." not in best_candidate
                    else f"Python Syntax Error: {err_msg.capitalize()}"
                )
                expl = (
                    f"Invalid syntax on line {line_no}: '{err_line.strip()}'. "
                    "Auto-correction fixes the statement."
                )
            else:
                title = f"Python SyntaxError: {err_msg.capitalize()}"
                expl = (
                    f"Python syntax parser failed at line {line_no}, col {col_no}: "
                    f"{err_msg}."
                )

            findings.append(
                SyntaxFinding(
                    file_path=file_path,
                    line_number=line_no,
                    column_number=col_no,
                    severity="critical",
                    title=title,
                    explanation=expl,
                    suggested_patch=suggested,
                )
            )

    # 2. General Code Stray/Orphan Dot Checks across Python, JS, TS, etc.
    # Checks every line for suspicious orphan dots (not floats or ellipses)
    for idx, raw_line in enumerate(lines, start=1):
        # Skip comment lines
        stripped = raw_line.strip()
        if stripped.startswith(("#", "//", "/*", "*")):
            continue

        # Pattern A: Double dots: e.g. `obj..method()` or `user..name`
        if re.search(r"[a-zA-Z0-9_\)]\.\.[a-zA-Z0-9_\(]", raw_line):
            if not any(f.line_number == idx for f in findings):
                clean_line = re.sub(r"\.\.", ".", raw_line)
                findings.append(
                    SyntaxFinding(
                        file_path=file_path,
                        line_number=idx,
                        column_number=raw_line.find("..") + 1,
                        severity="critical",
                        title="Syntax Error: Double Dot Typo (..)",
                        explanation=(
                            f"Double dot detected on line {idx}: '{stripped}'. "
                            "Member access requires a single dot."
                        ),
                        suggested_patch=(
                            f"- {raw_line.rstrip()}\n+ {clean_line.rstrip()}"
                        ),
                    )
                )

        # Pattern B: Stray dot followed by operators or punctuation
        if re.search(r"\b[a-zA-Z_][a-zA-Z0-9_]*\.\s*[\+\-\*\/\%\=\,\)\:\;]", raw_line):
            if not any(f.line_number == idx for f in findings):
                clean_line = re.sub(r"\.\s*([\)\,\:\;\]\}])", r"\1", raw_line)
                clean_line = re.sub(r"\.\s*([\+\-\*\/\%\=])", r" \1", clean_line)
                findings.append(
                    SyntaxFinding(
                        file_path=file_path,
                        line_number=idx,
                        column_number=1,
                        severity="critical",
                        title="Syntax Error: Stray Dot Before Operator/Punctuation",
                        explanation=(
                            f"Incomplete attribute access at line {idx}: '{stripped}'. "
                            "A dot was placed without specifying the property name."
                        ),
                        suggested_patch=(
                            f"- {raw_line.rstrip()}\n+ {clean_line.rstrip()}"
                        ),
                    )
                )

        # Pattern C: Stray trailing dot at end of statement
        if re.search(r"[a-zA-Z0-9_\)]\.\s*$", raw_line) and not stripped.endswith(
            "..."
        ):
            if not any(f.line_number == idx for f in findings):
                clean_line = re.sub(r"\.\s*$", "", raw_line)
                findings.append(
                    SyntaxFinding(
                        file_path=file_path,
                        line_number=idx,
                        column_number=len(raw_line),
                        severity="critical",
                        title="Syntax Error: Trailing Dot At End of Statement",
                        explanation=(
                            f"Trailing dot at line {idx}: '{stripped}'. "
                            "Remove trailing dot or append attribute."
                        ),
                        suggested_patch=f"- {raw_line.strip()}\n+ {clean_line.strip()}",
                    )
                )

    return findings
