#!/usr/bin/env python3
"""List throwaway helper scripts a session wrote to /tmp or its scratchpad and then reused.

usage: scratch-helpers.py TRANSCRIPT.jsonl [--min-uses N]   (default N=3)

A helper is a .py/.sh/.ts/.js/.mjs file written with the Write tool or a
`cat > FILE <<` heredoc under /tmp, /private/tmp, or a scratchpad directory.
A use is any later Bash command that names its basename. Subagent transcripts
under <session>/subagents/ are included. Prints one line per helper:
  <uses>  <path>  <first comment or usage line>  <cwd at write time>
Each listed helper is a promotion candidate: move it into the repo's scripts/
with a usage line, or leave it.
"""
import glob, json, os, re, sys

EXT = r'\.(?:py|sh|ts|js|mjs)'
SCRATCH = re.compile(r'^(?:/private)?/tmp/|/scratchpad/')
HEREDOC = re.compile(r'cat\s*>\s*["\']?(\S+?' + EXT + r')["\']?\s*<<-?\s*["\']?(\w+)["\']?\n(.*?)\n\2\b', re.S)


def first_line(body):
    for line in body.splitlines()[:15]:
        t = line.strip().lstrip('#/*"\' ').strip()
        if t and not line.startswith('#!') and not t.startswith(('import ', 'from ', 'set -', 'const ', 'use strict')):
            return t[:80]
    return ''


def tool_calls(path):
    with open(path) as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get('type') != 'assistant':
                continue
            for b in (d.get('message') or {}).get('content') or []:
                if isinstance(b, dict) and b.get('type') == 'tool_use':
                    yield d.get('timestamp') or '', d.get('cwd') or '', b.get('name'), b.get('input') or {}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    min_uses = int(sys.argv[sys.argv.index('--min-uses') + 1]) if '--min-uses' in sys.argv else 3
    transcript = args[0]
    files = [transcript] + sorted(glob.glob(os.path.join(transcript[:-len('.jsonl')], 'subagents', '**', '*.jsonl'), recursive=True))
    calls = sorted((c for f in files for c in tool_calls(f)), key=lambda c: c[0])
    helpers = {}  # path -> [ts, cwd, desc, uses]
    for ts, cwd, name, inp in calls:
        if name == 'Write':
            p = inp.get('file_path') or ''
            if SCRATCH.search(p) and re.search(EXT + '$', p) and p not in helpers:
                helpers[p] = [ts, cwd, first_line(inp.get('content') or ''), 0]
            continue
        if name != 'Bash':
            continue
        cmd = inp.get('command') or ''
        written = set()
        for m in HEREDOC.finditer(cmd):
            p = m.group(1)
            if SCRATCH.search(p) or p.startswith('$'):  # $S/x.py: a variable that names the scratchpad
                written.add(os.path.basename(p))
                helpers.setdefault(p, [ts, cwd, first_line(m.group(3)), 0])
        body = HEREDOC.sub('', cmd)
        for p, h in helpers.items():
            base = os.path.basename(p)
            if h[0] <= ts and base not in written and re.search(r'(?<![\w.-])' + re.escape(base) + r'(?![\w.-])', body):
                h[3] += 1
    rows = sorted(((h[3], p, h[2], h[1]) for p, h in helpers.items() if h[3] >= min_uses), reverse=True)
    for uses, p, desc, cwd in rows:
        print(f'{uses:4}  {p}  {desc or "-"}  {cwd or "?"}')
    if not rows:
        print(f'no scratch helper reused {min_uses}+ times ({len(helpers)} written)', file=sys.stderr)


if __name__ == '__main__':
    main()
