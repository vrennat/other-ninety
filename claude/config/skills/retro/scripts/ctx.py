#!/usr/bin/env python3
"""Print the context around a tool call or user message in a mined session.

usage: ctx.py SESSION [I] [--before N] [--after M] [--full]
  SESSION  session id or subagent id (agent-...); prefix match is fine
  I        call index (the `i` field in calls.jsonl); omit to list the whole session compactly
  --full   print untruncated inputs/results from calls.jsonl (still capped by the miner)
Also prints the session title, repo, transcript path, and user messages that fall in the window.
"""
import json, os, sys

D = os.environ.get('AUDIT_DATA') or os.path.expanduser('~/.local/state/session-audit/data')  # never inside the repo: transcripts hold secrets
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[k]: sys.argv[k + 1] for k in range(1, len(sys.argv) - 1) if sys.argv[k] in ('--before', '--after')}
full = '--full' in sys.argv
sid = args[0]
idx = int(args[1]) if len(args) > 1 else None
before = int(opt.get('--before', 8))
after = int(opt.get('--after', 8))

sess = [s for s in map(json.loads, open(f'{D}/sessions.jsonl')) if s['session'].startswith(sid)]
if not sess:
    sys.exit(f'no session matching {sid}')
s = sess[0]
print(f"# {s['session']} | {s['repo']} | {s.get('title')} | sub={s['subagent']} {s.get('agent_type') or ''}")
print(f"# file: {s['file']}\n# {s['start']} -> {s['end']} | calls={s['n_calls']} err={s['n_err']} compactions={s['compactions']}")
calls = [c for c in map(json.loads, open(f'{D}/calls.jsonl')) if c['session'] == s['session']]
calls.sort(key=lambda c: c['i'])
users = [u for u in map(json.loads, open(f'{D}/users.jsonl')) if u['session'] == s['session']]
lo, hi = (0, len(calls)) if idx is None else (max(0, idx - before), idx + after + 1)
window = calls[lo:hi]
cap = 4000 if full else (220 if idx is None else 600)
ui = 0
for c in window:
    while ui < len(users) and users[ui]['calls_before'] <= c['i']:
        u = users[ui]
        if idx is None or users[ui]['calls_before'] >= lo:
            print(f"\n>>> USER #{u['n']} {u['ts']}: {u['text'][:cap * 2]}")
        ui += 1
    mark = '**' if c['i'] == idx else '  '
    flag = 'ERR' if c['err'] else 'ok '
    print(f"{mark}[{c['i']}] {c['ts'][11:19] if c['ts'] else ''} {flag} {c['tool']}: {c['in'][:cap]}")
    if c['err'] or idx is not None:
        print(f"      -> {c['res'][:cap]}")
