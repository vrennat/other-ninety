#!/usr/bin/env python3
"""SessionStart hook (startup|resume): list other live Claude Code sessions in
the same repository, so a new session checks before repo-wide sweeps or
destructive git.

Reads Claude Code's own per-process registry (<config>/sessions/<pid>.json:
pid, sessionId, cwd), so there is no registry of our own to maintain and no
SessionEnd hook; a dead pid is skipped. Worktrees of one repository match each
other (git-common-dir). Fails soft: any error prints nothing and exits 0.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def repo_key(cwd: str) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"],
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    return os.path.abspath(cwd)


def alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def main() -> int:
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
    payload = json.load(sys.stdin)
    me = payload.get("session_id") or ""
    cwd = payload.get("cwd") or os.getcwd()
    if not me:
        return 0
    here = repo_key(cwd)
    rows = []
    for entry in sorted((config / "sessions").glob("*.json")):
        try:
            s = json.loads(entry.read_text())
            pid = int(s["pid"])
        except Exception:
            continue
        if s.get("sessionId") == me or not alive(pid):
            continue
        other = s.get("cwd") or ""
        if other and repo_key(other) == here:
            rows.append(f"{s.get('procStart', '?')} | {s.get('name') or '?'} | pid {pid} | {other}")
    if rows:
        print(
            "Other live Claude sessions in this repository (started | name | pid | cwd; "
            "SendMessage reaches a name) -- "
            "before repo-wide sweeps or destructive git, check you are not "
            "duplicating or clobbering their work:"
        )
        print("\n".join(rows))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
