#!/usr/bin/env python3
"""Inject o90's scope and review rules and its command list into each Claude Code session."""

from __future__ import annotations

import json

CONTEXT = """<other-ninety>
Finish the requested outcome, including necessary supporting changes and verification, without asking again about work already authorized. Reversibility does not expand scope: preserve unrelated behavior and deliberate design decisions. Investigate technical uncertainty yourself; ask only for a missing product decision, materially broader scope, or an external action not yet authorized. Honor explicit proposal-only limits and carry scope and existing authorization into every delegation.

Stakes decide review, not size: auth, money, data integrity, security, privacy, or hard-to-undo changes get an independent adversarial-reviewer pass even when the diff is one line. When unsure, round up.

/brainstorm writes a spec, /impl executes with its classification printed first, /plan writes a reviewable plan, /trim finds what to delete.
</other-ninety>"""


def main() -> int:
    payload = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": CONTEXT}}
    print(json.dumps(payload, ensure_ascii=False), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
