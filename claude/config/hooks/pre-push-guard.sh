#!/usr/bin/env bash
# pre-push-guard.sh
# PreToolUse hook: blocks non-ff pushes to main from Claude Code tool calls.
#
# Rationale: the user runs many parallel Claude sessions in worktrees, merges
# directly to main without PRs. Concurrent sessions can silently clobber each
# other if one pushes before rebasing against another session's commits.
# This guard intercepts `git push` commands targeting main and verifies
# local HEAD is fast-forward-able onto origin/main.
#
# Exit codes:
#   0  — allow the tool call
#   2  — block the tool call (stderr shown to the model)
#   other non-zero — error (also blocks)

set -uo pipefail

payload=$(cat)

# Only act on Bash tool calls
tool_name=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("tool_name") or "")' <<<"$payload")
if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

cmd=$(python3 -c 'import json, sys; data=json.load(sys.stdin).get("tool_input") or {}; print(data.get("command") or "")' <<<"$payload")
if [[ -z "$cmd" ]]; then
  exit 0
fi

# Only act on git push commands
if ! [[ "$cmd" =~ (^|[[:space:]\;\&\|])git[[:space:]]+push([[:space:]]|$) ]]; then
  exit 0
fi

# Resolve the working directory for the tool call
workdir=$(python3 -c 'import json, sys; data=json.load(sys.stdin).get("tool_input") or {}; print(data.get("cwd") or "")' <<<"$payload")
if [[ -z "$workdir" ]]; then
  workdir=$(pwd)
fi

# --- String-based detection first (works even outside a git repo) ---

cmd_targets_main=false
has_force=false
has_force_with_lease=false

# Walk through the command tokens: find "git push" and then look at what follows.
# Flags can appear anywhere, so we can't rely on positional regex.
read -ra tokens <<< "$cmd"
in_push_args=false
for ((i=0; i<${#tokens[@]}; i++)); do
  tok="${tokens[i]}"

  # Detect the start of a git push invocation
  if [[ "$in_push_args" != "true" && "$tok" == "git" && "${tokens[i+1]:-}" == "push" ]]; then
    in_push_args=true
    ((i++))  # skip the "push" token on next iteration
    continue
  fi

  if [[ "$in_push_args" != "true" ]]; then
    continue
  fi

  # Terminator: pipe, semicolon, && etc. end the push invocation
  case "$tok" in
    \;|\&\&|\|\||\||\>) in_push_args=false; continue ;;
  esac

  # Force flags
  if [[ "$tok" == "--force-with-lease" ]] || [[ "$tok" == --force-with-lease=* ]]; then
    has_force_with_lease=true
    continue
  fi
  if [[ "$tok" == "--force" ]] || [[ "$tok" == "-f" ]]; then
    has_force=true
    continue
  fi

  # Refspec detection: "main", "HEAD:main", "<anything>:main", "main:main"
  case "$tok" in
    main|main:main|HEAD:main|+main|+HEAD:main|+main:main)
      cmd_targets_main=true ;;
    *:main)
      cmd_targets_main=true ;;
  esac
done

# Hard block: explicit force push to main (detectable from command string alone)
if [[ "$cmd_targets_main" == "true" && "$has_force" == "true" && "$has_force_with_lease" != "true" ]]; then
  echo "pre-push-guard: BLOCKED — force push to main is not allowed from Claude Code." >&2
  echo "If you truly need this, run it yourself outside Claude." >&2
  exit 2
fi

# Now we need a git repo for the ancestry check
if ! git -C "$workdir" rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

current_branch=$(git -C "$workdir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Determine whether this push targets main (combining string and branch state)
pushes_main=false
if [[ "$cmd_targets_main" == "true" ]]; then
  pushes_main=true
fi
if [[ "$current_branch" == "main" ]]; then
  pushes_main=true
fi

if [[ "$pushes_main" != "true" ]]; then
  exit 0
fi

# Hard block: force push to main (catches implicit case where HEAD is main and cmd just says "push -f")
if [[ "$has_force" == "true" && "$has_force_with_lease" != "true" ]]; then
  echo "pre-push-guard: BLOCKED — force push to main is not allowed from Claude Code." >&2
  echo "If you truly need this, run it yourself outside Claude." >&2
  exit 2
fi

# --force-with-lease: allow but warn (user opted in explicitly)
if [[ "$has_force_with_lease" == "true" ]]; then
  echo "pre-push-guard: WARN — --force-with-lease to main. Proceeding." >&2
  exit 0
fi

# Fetch latest origin/main so our ancestry check is accurate
if ! git -C "$workdir" fetch origin main > /dev/null 2>&1; then
  echo "pre-push-guard: WARN — could not fetch origin/main (offline or no remote). Allowing push." >&2
  exit 0
fi

# Fast-forward check: origin/main must be an ancestor of HEAD
if git -C "$workdir" merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
  exit 0
fi

# Not fast-forward — another session has probably pushed. Block.
behind=$(git -C "$workdir" rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
ahead=$(git -C "$workdir" rev-list --count origin/main..HEAD 2>/dev/null || echo "?")

echo "pre-push-guard: BLOCKED — non-ff push to main from $workdir" >&2
echo "  local is $ahead ahead, $behind behind origin/main" >&2
echo "  another Claude session (or you) may have pushed while this one was working" >&2
echo "" >&2
echo "  to continue safely:" >&2
echo "    git -C '$workdir' fetch origin main" >&2
echo "    git -C '$workdir' rebase origin/main" >&2
echo "    # resolve conflicts if any, then retry the push" >&2
echo "" >&2
echo "  if you really want to override, run the push yourself in a terminal" >&2
exit 2
