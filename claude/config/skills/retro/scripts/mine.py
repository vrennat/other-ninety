#!/usr/bin/env python3
"""Mine Claude Code session transcripts into flat records for a cross-session audit.

Reads ~/.claude/projects/**/*.jsonl (main sessions and subagent transcripts) and writes:
  data/calls.jsonl     one record per tool call (input/result heads, error flag, signature)
  data/users.jsonl     human-typed user messages (not tool results or harness injections)
  data/sessions.jsonl  per-transcript stats
"""
import glob, json, os, re, shlex, sys
from multiprocessing import Pool

ROOT = os.path.expanduser('~/.claude/projects')
HOME = os.path.expanduser('~')
DEV = os.path.join(HOME, 'Developer')
DEV_DASHED = DEV.replace('/', '-')
OUT = os.environ.get('AUDIT_DATA') or os.path.expanduser('~/.local/state/session-audit/data')  # never inside the repo: transcripts hold secrets

MULTI = {'git', 'gh', 'bun', 'bunx', 'npx', 'npm', 'pnpm', 'wrangler', 'xcodebuild', 'xcrun', 'docker',
         'cargo', 'swift', 'uv', 'pip', 'pip3', 'brew', 'launchctl', 'systemctl', 'kubectl', 'bd', 'claude',
         'simctl', 'pi', 'make', 'just', 'vercel', 'fly', 'tailscale', 'defaults', 'security', 'op'}


def repo_of(path):
    if not path:
        return '?'
    p = path
    m = re.match(r'/(?:private/)?tmp/claude-\d+/' + re.escape(DEV_DASHED) + r'-([^/]+?)(?:-[0-9a-f]{8}-|/)', p)
    if m:
        return m.group(1)
    m = re.match(re.escape(DEV) + r'/([^/]+)', p)
    if m:
        r = m.group(1)
        r = re.sub(r'-worktrees$', '', r)
        return r
    if p.startswith(os.path.join(HOME, 'Library/Application Support/Claude')):
        return '(desktop-scratch)'
    if p.rstrip('/') == DEV:
        return '(Developer-root)'
    if p.rstrip('/') == HOME:
        return '(home)'
    return '(other)'


def relpath(path):
    """Strip repo root and worktree prefixes so the same file in different worktrees collapses."""
    if not isinstance(path, str):
        return ''
    p = path
    p = re.sub('^' + re.escape(DEV) + r'/[^/]+?(-worktrees/[^/]+)?/', '', p)
    p = re.sub(r'^\.claude/worktrees/[^/]+/', '', p)
    return p


def strip_cd(cmd):
    c = cmd.strip()
    for _ in range(4):
        m = re.match(r'^(cd\s+\S+|export\s+\S+|source\s+\S+|set\s+-\S+)\s*(&&|;)\s*', c)
        if not m:
            break
        c = c[m.end():]
    return c


def signature(cmd):
    c = strip_cd(cmd)
    c = re.split(r'\s*(?:&&|\|\||;|\|)\s*', c, maxsplit=1)[0]
    try:
        toks = shlex.split(c, posix=True)
    except ValueError:
        toks = c.split()
    while toks and re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', toks[0]):
        toks = toks[1:]
    while toks and toks[0] in ('sudo', 'time', 'timeout', 'nohup', 'env', 'command', 'exec', 'caffeinate'):
        toks = toks[1:]
        if toks and re.match(r'^-|^\d+[smh]?$', toks[0]):
            toks = toks[1:]
    if not toks:
        return '(empty)'
    prog = os.path.basename(toks[0])
    prog = re.sub(r'@.*$', '', prog)
    rest = [t for t in toks[1:] if not t.startswith('-')]
    if prog in ('bunx', 'npx') and rest:
        sub = re.sub(r'@.*$', '', rest[0])
        rest2 = rest[1:]
        return f'{prog} {sub}' + (f' {rest2[0]}' if rest2 and sub in MULTI | {'wrangler', 'playwright', 'svelte-kit', 'vitest', 'prisma', 'drizzle-kit'} else '')
    if prog in ('python', 'python3', 'node', 'bun') and ('-c' in toks or '-e' in toks or '-' in toks[1:2]):
        return f'{prog} (inline)'
    if prog in ('ssh',) and rest:
        return f'ssh {rest[0]}'
    if prog in MULTI and rest:
        sub = rest[0]
        if prog == 'git' and sub == '-C' and len(rest) > 2:
            sub = rest[2]
        if prog in ('bun', 'npm', 'pnpm') and sub == 'run' and len(rest) > 1:
            sub = 'run ' + rest[1]
        if prog in ('xcrun',) and len(rest) > 1:
            sub = rest[0] + ' ' + rest[1]
        return f'{prog} {sub}'
    return prog


ONEOFF = re.compile(r"(python3?\s+-c\b|python3?\s+-\s*<<|python3?\s+<<|node\s+-e\b|node\s+-\s*<<|bun\s+-e\b|bun\s+-\s*<<|"
                    r"cat\s*>\s*\S+\.(py|ts|js|mjs|sh|swift)\s*<<|osascript\s+-e|ruby\s+-e|perl\s+-[pi]?e)")
SECRET = re.compile(r'(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{8,}|'
                    r'sk-or-v1-[a-f0-9]{40,}|sk-[A-Za-z0-9]{40,}|AKIA[0-9A-Z]{16}|xox[bpa]-[A-Za-z0-9-]{20,}|lin_api_[A-Za-z0-9]{30,})')


def redact(line):
    return SECRET.sub(lambda m: '[REDACTED:' + m.group(1)[:7] + ']', line)


CORRECTION = re.compile(r"(^|\b)(no[,.!]|nope|stop\b|don'?t\b|do not\b|didn'?t\b|wrong|why did you|why are you|"
                        r"i said|i told you|not what i|that'?s not|instead\b|again\b|actually\b|undo|revert|"
                        r"you (forgot|missed|broke|keep|still)|still (broken|not|failing|wrong))", re.I)


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for b in content:
            if isinstance(b, dict):
                if b.get('type') == 'text':
                    out.append(b.get('text', ''))
                elif b.get('type') == 'image':
                    out.append('[image]')
            elif isinstance(b, str):
                out.append(b)
        return '\n'.join(out)
    return ''


def human_text(t):
    t = re.sub(r'<system-reminder>.*?</system-reminder>', '', t, flags=re.S)
    t = re.sub(r'<(local-command-stdout|local-command-stderr|command-message|command-args)>.*?</\1>', '', t, flags=re.S)
    return t.strip()


def input_head(name, inp):
    if not isinstance(inp, dict):
        return str(inp)[:400]
    if name == 'Bash':
        return inp.get('command', '')[:1500]
    if name in ('Read', 'Write', 'Edit', 'NotebookEdit'):
        s = inp.get('file_path', '')
        if name == 'Edit':
            s += ' ::old:: ' + (inp.get('old_string') or '')[:200]
        if name == 'Write':
            s += ' ::content:: ' + (inp.get('content') or '')[:300]
        return s
    if name == 'Grep':
        return f"pattern={inp.get('pattern')} path={inp.get('path')} glob={inp.get('glob')}"
    if name == 'Glob':
        return f"pattern={inp.get('pattern')} path={inp.get('path')}"
    if name in ('Agent', 'Task'):
        return f"[{inp.get('subagent_type')}|{inp.get('model')}] {inp.get('description')} :: {(inp.get('prompt') or '')[:300]}"
    return json.dumps(inp)[:500]


def process(path):
    is_sub = '/subagents/' in path
    meta = {}
    if is_sub:
        mp = path[:-6] + '.meta.json'
        try:
            meta = json.load(open(mp))
        except Exception:
            pass
    sid = os.path.basename(path)[:-6]
    parent = path.split('/subagents/')[0].split('/')[-1] if is_sub else None
    calls, users = [], []
    pending = {}
    s = {'file': path, 'session': sid, 'parent_session': parent, 'subagent': is_sub,
         'agent_type': meta.get('agentType'), 'agent_model': meta.get('model'), 'title': None, 'cwd': None,
         'start': None, 'end': None, 'n_calls': 0, 'n_err': 0, 'compactions': 0, 'models': {}, 'n_user': 0,
         'n_interrupt': 0, 'entrypoint': None, 'pr': None}
    last_assistant_text = ''
    call_idx = 0
    seen, seen_tool_ids = set(), set()
    try:
        fh = open(path, errors='replace')
    except Exception:
        return [], [], None
    for line in fh:
        try:
            d = json.loads(line)
        except Exception:
            continue
        u = d.get('uuid')
        if u:
            # bridge/remote transcripts re-append the same message (same uuid) 2-3x
            if u in seen:
                continue
            seen.add(u)
        t = d.get('type')
        ts = d.get('timestamp')
        if ts:
            s['start'] = s['start'] or ts
            s['end'] = ts
        if d.get('cwd') and not s['cwd']:
            s['cwd'] = d['cwd']
        if d.get('entrypoint') and not s['entrypoint']:
            s['entrypoint'] = d['entrypoint']
        if t == 'custom-title':
            s['title'] = d.get('customTitle')
        elif t == 'pr-link':
            s['pr'] = d.get('prUrl')
        elif t == 'system' and d.get('subtype') == 'compact_boundary':
            s['compactions'] += 1
        elif t == 'assistant':
            m = d.get('message') or {}
            mod = m.get('model')
            if mod:
                s['models'][mod] = s['models'].get(mod, 0) + 1
            for b in m.get('content') or []:
                if not isinstance(b, dict):
                    continue
                if b.get('type') == 'text':
                    last_assistant_text = b.get('text', '')
                elif b.get('type') == 'tool_use':
                    if b.get('id') in seen_tool_ids:
                        continue
                    seen_tool_ids.add(b.get('id'))
                    name = b.get('name')
                    inp = b.get('input') or {}
                    rec = {'session': sid, 'sub': is_sub, 'side': bool(d.get('isSidechain')), 'i': call_idx,
                           'ts': ts, 'cwd': d.get('cwd'), 'tool': name, 'in': input_head(name, inp),
                           'err': False, 'res': '', 'perm': None}
                    if name == 'Bash':
                        rec['sig'] = signature(inp.get('command', ''))
                        rec['bg'] = bool(inp.get('run_in_background'))
                        rec['oneoff'] = bool(ONEOFF.search(inp.get('command', '')))
                    elif name in ('Read', 'Write', 'Edit'):
                        rec['sig'] = f"{name} {relpath(inp.get('file_path'))}"
                        rec['path'] = inp.get('file_path')
                    else:
                        rec['sig'] = name
                    call_idx += 1
                    pending[b.get('id')] = rec
                    calls.append(rec)
        elif t == 'user':
            m = d.get('message') or {}
            c = m.get('content')
            has_result = False
            if isinstance(c, list):
                for b in c:
                    if isinstance(b, dict) and b.get('type') == 'tool_result':
                        has_result = True
                        rec = pending.pop(b.get('tool_use_id'), None)
                        if rec is None:
                            continue
                        rt = b.get('content')
                        rt = text_of(rt) if not isinstance(rt, str) else rt
                        rec['err'] = bool(b.get('is_error'))
                        rec['res'] = (rt or '')[:700] if rec['err'] else (rt or '')[:200]
                        tur = d.get('toolUseResult')
                        if isinstance(tur, dict):
                            if tur.get('interrupted'):
                                rec['interrupted'] = True
                            if tur.get('returnCodeInterpretation'):
                                rec['rci'] = tur['returnCodeInterpretation']
                        pd = d.get('permissionDecision')
                        if isinstance(pd, dict):
                            rec['perm'] = f"{pd.get('decision')}/{pd.get('source')}/{pd.get('reasonType')}"
            if not has_result and not d.get('isMeta') and not is_sub:
                raw = text_of(c)
                ht = human_text(raw)
                if ht and not ht.startswith('Caveat:'):
                    intr = '[Request interrupted by user' in ht
                    s['n_user'] += 1
                    s['n_interrupt'] += int(intr)
                    users.append({'session': sid, 'ts': ts, 'cwd': d.get('cwd'), 'n': s['n_user'], 'text': ht[:2500],
                                  'interrupt': intr, 'correction': bool(CORRECTION.search(ht[:600])),
                                  'prev_assistant': last_assistant_text[-500:], 'calls_before': call_idx})
    s['n_calls'] = len(calls)
    s['n_err'] = sum(1 for r in calls if r['err'])
    s['repo'] = repo_of(s['cwd'] or '')
    for r in calls:
        r['repo'] = s['repo']
    for u in users:
        u['repo'] = s['repo']
    return calls, users, s


def main():
    files = glob.glob(f'{ROOT}/*/*.jsonl') + glob.glob(f'{ROOT}/*/*/subagents/**/agent-*.jsonl', recursive=True)
    # AUDIT_EXCLUDE: comma-separated session ids (e.g. the auditing session itself) to leave out with their subagents
    # a resumed session can be copied into a second project dir; keep the largest copy per session id
    best = {}
    for f in files:
        k = os.path.basename(f) if '/subagents/' not in f else f
        if k not in best or os.path.getsize(f) > os.path.getsize(best[k]):
            best[k] = f
    files = list(best.values())
    excl = [x for x in os.environ.get('AUDIT_EXCLUDE', '').split(',') if x]
    files = [f for f in files if not any(x in f for x in excl)]
    os.makedirs(OUT, exist_ok=True)
    fc = open(f'{OUT}/calls.jsonl', 'w')
    fu = open(f'{OUT}/users.jsonl', 'w')
    fs = open(f'{OUT}/sessions.jsonl', 'w')
    n = 0
    with Pool(8) as p:
        for calls, users, s in p.imap_unordered(process, files, chunksize=4):
            if s is None:
                continue
            for r in calls:
                fc.write(redact(json.dumps(r)) + '\n')
            for u in users:
                fu.write(redact(json.dumps(u)) + '\n')
            fs.write(json.dumps(s) + '\n')
            n += 1
    print(f'{n} transcripts mined from {len(files)} files', file=sys.stderr)


if __name__ == '__main__':
    main()
