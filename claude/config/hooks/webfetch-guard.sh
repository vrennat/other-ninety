#!/usr/bin/env bash
# webfetch-guard.sh
# PreToolUse hook: blocks WebFetch to hosts Claude Code cannot fetch, with the
# working alternative in the message. Measured 2026-09-02: 27 of 29 reddit
# fetches and 15 web.archive.org fetches failed in one week; each was a wasted
# turn at full context. Exit 2 blocks; anything else allows.
set -uo pipefail
payload=$(cat)
case "$payload" in *WebFetch*) ;; *) exit 0 ;; esac
python3 - "$payload" <<'PY'
import json, sys
from urllib.parse import urlsplit
try:
    data = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)
if data.get("tool_name") != "WebFetch":
    sys.exit(0)
url = (data.get("tool_input") or {}).get("url") or ""
host = (urlsplit(url).hostname or "").lower()
blocked = {
    "reddit.com": "use the reddit MCP (mcp__reddit__reddit_search, reddit_subreddit, reddit_fetch_via_browser)",
    "redd.it": "use the reddit MCP (mcp__reddit__reddit_fetch_via_browser)",
    "web.archive.org": "archive.org is unreachable from Claude Code; fetch the live page or use WebSearch",
    "archive.org": "archive.org is unreachable from Claude Code; fetch the live page or use WebSearch",
}
for domain, fix in blocked.items():
    if host == domain or host.endswith("." + domain):
        print(f"webfetch-guard: BLOCKED — WebFetch cannot reach {host}. Instead: {fix}.", file=sys.stderr)
        sys.exit(2)
sys.exit(0)
PY
