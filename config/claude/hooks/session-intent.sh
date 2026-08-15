#!/usr/bin/env bash
# Maintains ~/.claude/sessions-active.md so parallel sessions can see each
# other before starting repo-wide work. Wire to SessionStart (startup|resume)
# and SessionEnd. On SessionStart, stdout is injected into the new session's
# context, so other active sessions surface automatically.
# Last-writer-wins on a simultaneous start; a lost line costs one missed
# heads-up, not correctness.
set -euo pipefail

file="$HOME/.claude/sessions-active.md"
input=$(cat)
event=$(jq -r '.hook_event_name // empty' <<<"$input")
sid=$(jq -r '.session_id // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
[[ -n "$sid" ]] || exit 0

touch "$file"
cutoff=$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)
tmp=$(mktemp)
# keep other sessions' lines newer than 24h; drop this session's old line
awk -v sid="$sid" -v cutoff="$cutoff" -F ' \\| ' \
  'NF == 3 && $2 != sid && $1 >= cutoff' "$file" > "$tmp" || true

if [[ "$event" == "SessionStart" ]]; then
  printf '%s | %s | %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$sid" "$cwd" >> "$tmp"
  others=$(awk -v sid="$sid" -F ' \\| ' '$2 != sid' "$tmp")
  if [[ -n "$others" ]]; then
    echo "Other active Claude sessions (started | session | cwd) -- before repo-wide sweeps or destructive git, check you are not duplicating or clobbering their work:"
    echo "$others"
  fi
fi

mv "$tmp" "$file"
exit 0
