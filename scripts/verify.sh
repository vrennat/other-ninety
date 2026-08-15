#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

python3 -m py_compile scripts/*.py
python3 -m unittest discover -s scripts -p 'test_*.py'

for script in install.sh check-drift.sh check-leaks.sh scripts/*.sh config/claude/hooks/*.sh templates/hooks/*.sh .githooks/*; do
  [[ -f "$script" ]] && bash -n "$script"
done

node --check hooks/session-start.js
test -x scripts/lint-plugin.sh
test -x check-leaks.sh
git check-ignore -q .pi/private-session.json
python3 - <<'PY'
import json
from pathlib import Path
for path in Path('.').rglob('*.json'):
    if '.git' in path.parts or 'node_modules' in path.parts:
        continue
    json.loads(path.read_text())
print('JSON parse passed')
PY

scripts/lint-plugin.sh
(
  cd adapters/pi
  bun install --frozen-lockfile
  bun run verify
)
./check-leaks.sh

echo "Verification passed"
