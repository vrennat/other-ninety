#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
errors=0

check_length() {
  local file="$1" cap="$2" lines
  lines=$(wc -l < "$file" | tr -d ' ')
  if (( lines > cap )); then
    echo "FAIL: $file is $lines lines (cap: $cap)"
    errors=$((errors + 1))
  fi
}

check_yaml_safety() {
  local file="$1"
  head -1 "$file" | grep -q '^---$' || { echo "FAIL: $file missing YAML frontmatter"; errors=$((errors + 1)); return; }
  if ! python3 - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
try:
    end = lines.index("---", 1)
except ValueError:
    print(f"FAIL: {path} has unclosed YAML frontmatter")
    raise SystemExit(1)
for number, line in enumerate(lines[1:end], 2):
    if not line or line[0].isspace() or line.startswith("-"):
        continue
    _, separator, value = line.partition(": ")
    if not separator:
        print(f"FAIL: {path}:{number} has invalid YAML frontmatter")
        raise SystemExit(1)
    if ": " in value and not value.startswith(('"', "'", "|", ">", "[", "{")):
        print(f"FAIL: {path}:{number} must quote a YAML value containing ': '")
        raise SystemExit(1)
PY
  then
    errors=$((errors + 1))
  fi
}

check_frontmatter() {
  local file="$1"
  check_yaml_safety "$file"
  grep -q '^name: ' "$file" || { echo "FAIL: $file missing name"; errors=$((errors + 1)); }
  grep -q '^description: ' "$file" || { echo "FAIL: $file missing description"; errors=$((errors + 1)); }
}

check_banned() {
  local file="$1" count
  grep -q '```dot' "$file" && { echo "FAIL: $file contains graphviz dot"; errors=$((errors + 1)); }
  count=$(grep -cE 'EXTREMELY (IMPORTANT|CRITICAL)|^\*?\*?MUST |^\*?\*?NEVER ' "$file" 2>/dev/null || true)
  (( count <= 1 )) || { echo "FAIL: $file uses EXTREMELY/MUST/NEVER $count times"; errors=$((errors + 1)); }
}

plugin=claude/plugin
plugin_version=$(python3 -c 'import json; print(json.load(open("claude/plugin/.claude-plugin/plugin.json"))["version"])')
marketplace_version=$(python3 -c 'import json; print(json.load(open(".claude-plugin/marketplace.json"))["plugins"][0]["version"])')
[[ "$plugin_version" == "$marketplace_version" ]] || { echo "FAIL: Claude manifest versions differ"; errors=$((errors + 1)); }

if ! python3 <<'PY'
import json
from pathlib import Path

codex_root = Path("plugins/other-ninety")
manifest = json.loads((codex_root / ".codex-plugin/plugin.json").read_text())
marketplace = json.loads(Path(".agents/plugins/marketplace.json").read_text())
claude_manifest = json.loads(Path("claude/plugin/.claude-plugin/plugin.json").read_text())

expected_manifest = {
    "name": "other-ninety",
    "skills": "./skills/",
    "license": "MIT",
}
for key, expected in expected_manifest.items():
    actual = manifest.get(key)
    if actual != expected:
        raise SystemExit(f"FAIL: Codex manifest {key!r} is {actual!r}, expected {expected!r}")

if manifest.get("version") != claude_manifest.get("version"):
    raise SystemExit("FAIL: Codex and Claude manifest versions differ")

interface = manifest.get("interface", {})
for key in ("displayName", "shortDescription", "longDescription", "developerName", "category"):
    if not interface.get(key):
        raise SystemExit(f"FAIL: Codex manifest interface.{key} is missing")

if marketplace.get("name") != "other-ninety":
    raise SystemExit("FAIL: Codex marketplace name must be 'other-ninety'")
plugins = marketplace.get("plugins", [])
if len(plugins) != 1:
    raise SystemExit("FAIL: Codex marketplace must contain exactly one plugin")
entry = plugins[0]
if entry.get("name") != manifest["name"]:
    raise SystemExit("FAIL: Codex marketplace plugin name differs from the manifest")
if entry.get("source") != {"source": "local", "path": "./plugins/other-ninety"}:
    raise SystemExit("FAIL: Codex marketplace source must point to ./plugins/other-ninety")
if entry.get("policy") != {"installation": "AVAILABLE", "authentication": "ON_INSTALL"}:
    raise SystemExit("FAIL: Codex marketplace policy is invalid")
if entry.get("category") != interface["category"]:
    raise SystemExit("FAIL: Codex marketplace category differs from the manifest")
PY
then
  errors=$((errors + 1))
fi

if [[ ! -L skills || "$(readlink skills)" != "plugins/other-ninety/skills" ]]; then
  echo "FAIL: skills must be a relative symlink to plugins/other-ninety/skills"
  errors=$((errors + 1))
fi

last_tag=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [[ -n "$last_tag" ]] && ! git diff --quiet "$last_tag" -- "$plugin"; then
  [[ "v$plugin_version" != "$last_tag" ]] || { echo "FAIL: shipped content changed without a version bump"; errors=$((errors + 1)); }
fi

for file in "$plugin"/skills/*/SKILL.md; do [[ -f "$file" ]] && { check_length "$file" 80; check_frontmatter "$file"; check_banned "$file"; }; done
for file in "$plugin"/commands/*.md; do [[ -f "$file" ]] && { check_length "$file" 150; check_frontmatter "$file"; check_banned "$file"; }; done
for file in "$plugin"/agents/*.md; do [[ -f "$file" ]] && { check_length "$file" 60; check_frontmatter "$file"; check_banned "$file"; }; done
for file in skills/*/SKILL.md cursor/agents/*.md; do [[ -f "$file" ]] && { check_frontmatter "$file"; check_banned "$file"; }; done
for file in pi/prompts/*.md pi/skills/*/SKILL.md pi/agents/*.md; do [[ -f "$file" ]] && check_yaml_safety "$file"; done

(( errors == 0 )) || { echo "Lint failed with $errors error(s)"; exit 1; }
echo "Plugin lint passed"
