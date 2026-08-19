#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

python3 -m py_compile scripts/*.py
python3 -m unittest discover -s scripts -p 'test_*.py'

for script in install.sh bootstrap.sh check-drift.sh check-leaks.sh scripts/*.sh claude/config/hooks/*.sh claude/plugin/templates/hooks/*.sh .githooks/*; do
  [[ -f "$script" ]] && bash -n "$script"
done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
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

bun - <<'TS'
import { readdirSync, readFileSync } from "node:fs";
for (const file of readdirSync("codex/agents")) {
  if (!file.endsWith(".toml")) continue;
  const parsed = Bun.TOML.parse(readFileSync(`codex/agents/${file}`, "utf8"));
  for (const field of ["name", "description", "developer_instructions"]) {
    if (typeof parsed[field] !== "string" || parsed[field].length === 0) {
      throw new Error(`${file}: missing ${field}`);
    }
  }
  if ("model" in parsed || "model_reasoning_effort" in parsed) {
    throw new Error(`${file}: public role must inherit model policy`);
  }
}
console.log("Codex agent TOML parse passed");
TS

scripts/lint-plugin.sh
(
  cd pi
  bun install --frozen-lockfile
  bun run verify
)
./check-leaks.sh

echo "Verification passed"
