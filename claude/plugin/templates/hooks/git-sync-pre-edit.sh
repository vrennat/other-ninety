#!/usr/bin/env bash
# PreToolUse hook: block edits if local main is behind origin/main.
# Install: PreToolUse hook with matcher (tool == "Edit" || tool == "Write")
set -euo pipefail

current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
  exit 0
fi

git fetch origin "$current_branch" --quiet 2>/dev/null || exit 0
behind=$(git rev-list --count "HEAD..origin/$current_branch" 2>/dev/null || echo "0")

if (( behind > 0 )); then
  echo "[Hook] BLOCKED: local $current_branch is $behind commit(s) behind origin/$current_branch" >&2
  echo "[Hook] Run: git pull --rebase origin $current_branch" >&2
  exit 1
fi
