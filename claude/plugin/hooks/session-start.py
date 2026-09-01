#!/usr/bin/env python3
"""Inject o90's two routing rules and its command list into each Claude Code session."""

from __future__ import annotations

import json

CONTEXT = """<other-ninety>
Ask only when two readings of the request would produce materially different work: a missing requirement, competing approaches with real tradeoffs, or a multi-cause bug. File count is not ambiguity.

Stakes decide review, not size: auth, money, data integrity, security, privacy, or hard-to-undo changes get an independent adversarial-reviewer pass even when the diff is one line. When unsure, round up.

/brainstorm writes a spec, /impl executes with its classification printed first, /plan writes a reviewable plan, /trim finds what to delete.
</other-ninety>"""


def main() -> int:
    payload = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": CONTEXT}}
    print(json.dumps(payload, ensure_ascii=False), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
