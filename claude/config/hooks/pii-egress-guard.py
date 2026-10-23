#!/usr/bin/env python3
"""PreToolUse hook: asks before a tool call sends the owner's email address off
the machine, or writes it into a header string in code.

Rationale: public APIs (Wikipedia, Wikidata, SEC EDGAR) ask clients for
contact details in the User-Agent, and the model fills one in with whatever
address it knows: the claude.ai account email or the git author. An audit of
~/.claude/projects on 2026-10-23 found the address in over 100 User-Agent
strings, several of them committed into shipped clients (tangent, wormhole).

Addresses come from `git config --global user.email`, any
*@users.noreply.github.com address, and the comma-separated PII_EGRESS_EMAILS
env var, so this public repository never holds them.

Checked:
  Bash          command contains an address and a network or header word
  WebFetch      URL contains an address
  Write/Edit    new text has an address on the same line as a header word

Decision is "ask", not deny: a hard deny in auto mode turns into a puzzle the
model routes around. Known gap: an address assembled at run time ($(git
config …), string concatenation) is invisible to a text match, and tools
outside the matcher (NotebookEdit, MCP browser and fetch tools) are not checked.
"""
import json
import os
import re
import subprocess
import sys

NETWORK = re.compile(
    r"\b(curl|wget|http|https|fetch|requests|urllib|httpx|aiohttp|nc|ssh|scp|gh\s+api)\b"
    r"|user-agent|\bfrom:|user_agent",
    re.I,
)
UA_NAME = re.compile(r"\bUA\b|_UA\b")
HEADER = re.compile(r"user-agent|user_agent|\bfrom:|['\"]from['\"]\s*:", re.I)
NOREPLY = re.compile(r"[\w.+-]+@users\.noreply\.github\.com", re.I)


def addresses():
    found = set()
    try:
        out = subprocess.run(["git", "config", "--global", "user.email"],
                             capture_output=True, text=True, timeout=2).stdout.strip()
        if out:
            found.add(out.lower())
    except (OSError, subprocess.SubprocessError):
        pass
    for item in os.environ.get("PII_EGRESS_EMAILS", "").split(","):
        if item.strip():
            found.add(item.strip().lower())
    return found


def hit(text, emails):
    low = text.lower().replace("%40", "@")
    return any(e in low for e in emails) or bool(NOREPLY.search(low))


def header(text):
    return bool(HEADER.search(text) or UA_NAME.search(text))


def text(value):
    return value if isinstance(value, str) else ""


def main():
    raw = sys.stdin.read()
    if "@" not in raw and "%40" not in raw.lower():
        return
    payload = json.loads(raw)
    tool = payload.get("tool_name") or ""
    args = payload.get("tool_input")
    if not isinstance(args, dict):
        return
    emails = addresses()
    reason = None

    if tool == "Bash":
        cmd = text(args.get("command"))
        if hit(cmd, emails) and (NETWORK.search(cmd) or UA_NAME.search(cmd)):
            reason = "this command sends the owner's email address over the network"
    elif tool == "WebFetch":
        if hit(text(args.get("url")), emails):
            reason = "this URL carries the owner's email address"
    elif tool in ("Write", "Edit", "MultiEdit"):
        texts = [text(args.get("content")), text(args.get("new_string"))]
        edits = args.get("edits")
        texts += [text(e.get("new_string")) for e in edits if isinstance(e, dict)] if isinstance(edits, list) else []
        lines = "\n".join(texts).splitlines()
        # Formatters wrap long header strings, so look one line either side.
        for i, line in enumerate(lines):
            if hit(line, emails) and header("\n".join(lines[max(0, i - 1):i + 2])):
                reason = "this writes the owner's email address into a request header"
                break

    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": (
                f"pii-egress-guard: {reason}. Use a project contact address "
                "or omit it unless the owner approves this call."),
        }}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # a broken guard must not break every tool call
        print(f"pii-egress-guard: skipped, {error!r}", file=sys.stderr)
