#!/bin/sh
# shell-env.sh
# SessionStart hook: make the Bash tool's shell behave like the interactive one.
#
# The Bash tool runs zsh from a shell snapshot. Two things differ from the
# terminal and cost calls (2026-10-09 session audit, findings F1 and F2):
#   - NOMATCH and EQUALS are on, so `ls nothere*` and `grep --include=*.py`
#     abort with "no matches found" and `echo === ok ===` fails with
#     "=== not found" (zsh expands a leading `=` as a command path).
#   - About a quarter of snapshots come from a login shell where path_helper
#     puts /usr/bin ahead of Homebrew, so `python3` is 3.9 and `git` is the
#     Xcode shim; the other three quarters lack /usr/sbin and /sbin entirely.
#
# Claude Code sources CLAUDE_ENV_FILE before each Bash command (hooks doc:
# "write export statements to CLAUDE_ENV_FILE"). Only the main session's
# SessionStart has the variable; outside it the hook does nothing.
[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0

{
  echo '[ -n "$ZSH_VERSION" ] && setopt NO_NOMATCH NO_EQUALS'
  echo 'export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/opt/homebrew/sbin:$HOME/.local/bin:$PATH:/usr/sbin:/sbin"'
} >> "$CLAUDE_ENV_FILE"
exit 0
