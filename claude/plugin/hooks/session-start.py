#!/usr/bin/env python3
"""Inject o90 routing and output policy into each Claude Code session."""

from __future__ import annotations

import json
import os
from pathlib import Path


MODE_BLURBS = {
    "cautious": "confirm on ambiguous tasks AND medium/complex tasks",
    "default": "confirm only when ambiguous, regardless of complexity",
    "autonomous": (
        "even ambiguous tasks get a sensible stated default and proceed; "
        "only destructive ops confirm"
    ),
}


def read_mode() -> str:
    project_dir = Path(os.environ.get("CLAUDE_PROJECT_DIR", Path.cwd()))
    try:
        mode = (project_dir / ".claude" / "other-ninety-mode").read_text().strip().lower()
    except OSError:
        return "default"
    return mode if mode in MODE_BLURBS else "default"


def main() -> int:
    mode = read_mode()
    output_style = (Path(__file__).resolve().parent.parent / "output-style.md").read_text().strip()
    context = "\n".join(
        (
            "<other-ninety>",
            (
                "Routing philosophy (active even without /impl). Assess every dev task on "
                "three axes and keep them separate:"
            ),
            "",
            (
                "- Clarity (clear / ambiguous) decides whether to ASK. Ambiguous = 2+ "
                "approaches with real tradeoffs, a genuinely missing requirement, or a "
                "multi-cause bug. It is not \"many files touched\" and not \"I would like "
                "to confirm.\""
            ),
            (
                "- Complexity (simple / medium / complex) decides how to ROUTE: "
                "1 file / 2-3 files / >3 files."
            ),
            (
                "- Stakes (normal / high) decides how hard to VERIFY: high = auth, "
                "money, data integrity, security, privacy, or hard to undo. Orthogonal "
                "to file count; when unsure, round up."
            ),
            "",
            (
                "Confirm only when clarity is ambiguous, or for destructive/irreversible "
                "operations. Do not seek rubber-stamp approval on routine work."
            ),
            "",
            (
                "Mark deliberate borderline routing calls in-code with a `// o90:` "
                "comment (`# o90:` for Python/shell) that names the upgrade trigger, "
                "e.g. `// o90: routed simple, escalate if sorting grows past this file`. "
                "/debt audits these."
            ),
            "",
            f"Mode: {mode} — {MODE_BLURBS[mode]}. (/mode changes it.)",
            "",
            (
                "Run /impl to execute work through this rubric; /trim to review what to "
                "delete; /debt to audit routing markers."
            ),
            "</other-ninety>",
            "",
            output_style,
        )
    )
    payload = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }
    print(json.dumps(payload, ensure_ascii=False), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
