#!/usr/bin/env python3
"""Aggregate mined records into audit signals. Writes data/*.jsonl extracts and prints a summary."""
import collections, json, os, re, sys

D = os.environ.get('AUDIT_DATA') or os.path.expanduser('~/.local/state/session-audit/data')  # never inside the repo: transcripts hold secrets
since = sys.argv[1] if len(sys.argv) > 1 else ''

calls = [json.loads(l) for l in open(f'{D}/calls.jsonl')]
users = [json.loads(l) for l in open(f'{D}/users.jsonl')]
sessions = {s['session']: s for s in map(json.loads, open(f'{D}/sessions.jsonl'))}
if since:
    calls = [c for c in calls if (c.get('ts') or '') >= since]
    users = [u for u in users if (u.get('ts') or '') >= since]

BENIGN_RC = re.compile(r'^Exit code 1\s*$', re.M)


def benign(c):
    """grep/rg/diff/test returning 1 is an answer, not a failure."""
    if c['tool'] != 'Bash' or not c['err']:
        return False
    if c.get('rci'):
        return True
    return c.get('sig', '').split(' ')[0] in ('grep', 'rg', 'diff', 'test', '[', 'cmp', 'pgrep') and c['res'].startswith('Exit code 1')


def err_class(c):
    r = c['res']
    if 'auto mode classifier' in r:
        m = re.search(r'Reason: \[([^\]]+)\]', r)
        return 'classifier:' + (m.group(1) if m else 'unexplained')
    if 'hook' in (c.get('perm') or '') or 'PreToolUse' in r or 'hook error' in r.lower():
        return 'hook-block'
    m = re.search(r'<tool_use_error>(.{0,60})', r)
    if m:
        t = m.group(1)
        for k, v in [('String to replace not found', 'edit:not-found'), ('matches of the string', 'edit:multi-match'),
                     ('File has not been read', 'edit:not-read'), ('modified since read', 'edit:stale'),
                     ('Blocked: sleep', 'bash:sleep-blocked'), ('is not running', 'task:not-running'),
                     ('File does not exist', 'read:missing'), ('InputValidationError', 'input-validation')]:
            if k in r[:300]:
                return v
        return 'tool_use_error:' + re.sub(r'[0-9a-f]{6,}|\d+', '#', t)[:40]
    if c['tool'] == 'Bash':
        m = re.match(r'Exit code (\d+)', r)
        if 'command not found' in r or 'No such file or directory' in r[:400] and 'failed to run command' in r:
            return 'bash:command-not-found'
        if m:
            return f'bash:exit'
        if c.get('interrupted'):
            return 'bash:interrupted'
        return 'bash:other'
    if c['tool'].startswith('mcp__'):
        return 'mcp:' + c['tool'].split('__')[1]
    if 'rejected' in r.lower() or "doesn't want to proceed" in r:
        return 'user-rejected'
    return c['tool'] + ':other'


by_file = collections.defaultdict(list)
for c in calls:
    by_file[(c['session'], c['sub'])].append(c)
for v in by_file.values():
    v.sort(key=lambda c: c['i'])

out = {}
# 1. error taxonomy
errs = [c for c in calls if c['err'] and not benign(c)]
for c in errs:
    c['ec'] = err_class(c)
out['n_calls'] = len(calls)
out['n_err'] = len(errs)
out['n_benign'] = sum(1 for c in calls if benign(c))
out['err_class'] = collections.Counter(c['ec'] for c in errs).most_common(60)
out['err_by_tool'] = collections.Counter(c['tool'] for c in errs).most_common(25)
out['bash_fail_sig'] = collections.Counter(c['sig'] for c in errs if c['tool'] == 'Bash').most_common(60)
out['bash_fail_sig_sessions'] = {k: len({c['session'] for c in errs if c.get('sig') == k}) for k, _ in out['bash_fail_sig']}

# 2. retry chains: consecutive failures on one signature within a transcript
chains = []
for key, seq in by_file.items():
    i = 0
    while i < len(seq):
        c = seq[i]
        if c['err'] and not benign(c):
            sig = c['sig']
            fails = [c]
            j = i + 1
            look = 0
            succeeded = None
            while j < len(seq) and look < 6:
                n = seq[j]
                if n['sig'] == sig:
                    if n['err'] and not benign(n):
                        fails.append(n); look = 0
                    else:
                        succeeded = n; break
                else:
                    look += 1
                j += 1
            if len(fails) >= 2:
                chains.append({'session': c['session'], 'sub': c['sub'], 'repo': c['repo'], 'sig': sig, 'n_fail': len(fails),
                               'ok': bool(succeeded), 'ts': c['ts'], 'first_in': c['in'][:400], 'first_err': c['res'][:300],
                               'last_in': fails[-1]['in'][:400], 'fix_in': succeeded['in'][:400] if succeeded else None,
                               'i': c['i']})
                i = j
                continue
        i += 1
out['n_chains'] = len(chains)
out['chain_sig'] = collections.Counter(ch['sig'] for ch in chains).most_common(40)
out['chain_long'] = sorted(chains, key=lambda x: -x['n_fail'])[:5]

# 3. repeated identical calls within a transcript
repeats = []
for key, seq in by_file.items():
    cnt = collections.Counter((c['tool'], c['in']) for c in seq if c['tool'] not in ('TodoWrite', 'TaskUpdate', 'TaskCreate'))
    for (tool, inp), n in cnt.items():
        if n >= 3:
            repeats.append({'session': key[0], 'sub': key[1], 'repo': seq[0]['repo'], 'tool': tool, 'in': inp[:400], 'n': n})
out['n_repeats'] = len(repeats)
out['repeat_tools'] = collections.Counter(r['tool'] for r in repeats).most_common(20)

# 4. one-off scripts
oneoffs = [c for c in calls if c.get('oneoff')]
out['n_oneoff'] = len(oneoffs)
out['oneoff_by_repo'] = collections.Counter(c['repo'] for c in oneoffs).most_common(25)
scratch_writes = [c for c in calls if c['tool'] == 'Write' and re.search(r'(/tmp/|scratchpad|/private/var/)', c.get('path') or '')
                  and re.search(r'\.(py|ts|js|mjs|sh|swift|sql)$', c.get('path') or '')]
out['n_scratch_script_writes'] = len(scratch_writes)

# 5. navigation: files read in many distinct sessions
reads = collections.defaultdict(set)
for c in calls:
    if c['tool'] == 'Read' and c.get('sig'):
        reads[(c['repo'], c['sig'][5:])].add(c['session'])
    elif c['tool'] == 'Bash' and c.get('sig', '').split(' ')[0] in ('cat', 'sed', 'head', 'tail', 'less'):
        m = re.search(r'(?:cat|sed -n \S+|head(?: -n? ?\d+)?|tail(?: -n? ?\d+)?)\s+(\S+\.(?:md|ts|js|json|toml|yaml|yml|svelte|py|sh|swift))', c['in'])
        if m:
            p = re.sub('^' + re.escape(os.path.expanduser('~/Developer')) + r'/[^/]+?(-worktrees/[^/]+)?/', '', m.group(1))
            p = re.sub(r'^\.claude/worktrees/[^/]+/', '', p)
            reads[(c['repo'], p)].add(c['session'])
top_reads = sorted(((k, len(v)) for k, v in reads.items()), key=lambda x: -x[1])[:80]
out['top_reads'] = [f'{n:4d}  {r}:{p}' for (r, p), n in top_reads]

# 6. user signals
out['n_user'] = len(users)
out['n_interrupt'] = sum(u['interrupt'] for u in users)
out['n_correction_flag'] = sum(u['correction'] for u in users)
out['user_by_repo'] = collections.Counter(u['repo'] for u in users).most_common(20)

# 7. sessions
ss = [s for s in sessions.values() if not since or (s.get('end') or '') >= since]
out['n_sessions_main'] = sum(1 for s in ss if not s['subagent'])
out['n_sessions_sub'] = sum(1 for s in ss if s['subagent'])
out['compactions'] = sum(s['compactions'] for s in ss)
out['agent_types'] = collections.Counter(s['agent_type'] for s in ss if s['subagent']).most_common(15)
out['tools'] = collections.Counter(c['tool'] for c in calls).most_common(40)

suffix = f'_{since[:10]}' if since else ''
with open(f'{D}/errors{suffix}.jsonl', 'w') as f:
    for c in errs:
        f.write(json.dumps(c) + '\n')
with open(f'{D}/retries{suffix}.jsonl', 'w') as f:
    for ch in chains:
        f.write(json.dumps(ch) + '\n')
with open(f'{D}/repeats{suffix}.jsonl', 'w') as f:
    for r in sorted(repeats, key=lambda r: -r['n']):
        f.write(json.dumps(r) + '\n')
with open(f'{D}/oneoffs{suffix}.jsonl', 'w') as f:
    for c in oneoffs + scratch_writes:
        f.write(json.dumps(c) + '\n')
with open(f'{D}/user_flagged{suffix}.jsonl', 'w') as f:
    for u in users:
        if u['interrupt'] or u['correction'] or u['n'] > 1:
            f.write(json.dumps(u) + '\n')
with open(f'{D}/summary{suffix}.json', 'w') as f:
    json.dump(out, f, indent=1, default=str)

for k, v in out.items():
    if isinstance(v, list):
        print(f'\n## {k}')
        for x in v[:60]:
            print('  ', x if not isinstance(x, dict) else json.dumps(x)[:400])
    elif isinstance(v, dict):
        print(f'\n## {k}: {json.dumps(v)[:1500]}')
    else:
        print(f'{k}: {v}')
