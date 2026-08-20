#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")" && pwd)
apply=false
with_pi=false
with_claude=false
with_codex=false
with_cursor=false
selection_explicit=false
installer_args=()
while (( $# )); do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --with)
      (( $# >= 2 )) || { echo "Missing value for $1" >&2; exit 2; }
      selection_explicit=true
      case "$2" in
        pi) with_pi=true ;;
        claude) with_claude=true ;;
        codex) with_codex=true ;;
        cursor) with_cursor=true ;;
        *) echo "Unknown optional component: $2" >&2; exit 2 ;;
      esac
      installer_args+=("$1" "$2")
      shift 2
      ;;
    --with=*)
      component=${1#--with=}
      selection_explicit=true
      case "$component" in
        pi) with_pi=true ;;
        claude) with_claude=true ;;
        codex) with_codex=true ;;
        cursor) with_cursor=true ;;
        *) echo "Unknown optional component: $component" >&2; exit 2 ;;
      esac
      installer_args+=("$1")
      shift
      ;;
    --overlay|--claude-dir|--codex-dir|--agents-dir|--cursor-project|--pi-dir|--pi-root|--bin-dir|--state-dir)
      (( $# >= 2 )) || { echo "Missing value for $1" >&2; exit 2; }
      installer_args+=("$1" "$2")
      shift 2
      ;;
    --overlay=*|--claude-dir=*|--codex-dir=*|--agents-dir=*|--cursor-project=*|--pi-dir=*|--pi-root=*|--bin-dir=*|--state-dir=*)
      installer_args+=("$1")
      shift
      ;;
    *)
      echo "Unsupported bootstrap option: $1" >&2
      exit 2
      ;;
  esac
done

$selection_explicit || with_pi=true

for command in git python3; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
if $with_pi; then
  for command in bun pi; do
    command -v "$command" >/dev/null || { echo "Missing prerequisite for Pi component: $command" >&2; exit 1; }
  done
fi
if $with_claude && ! command -v claude >/dev/null; then
  echo "Missing prerequisite for Claude component: claude" >&2
  exit 1
fi
if $with_codex && ! command -v codex >/dev/null; then
  echo "Missing prerequisite for Codex component: codex" >&2
  exit 1
fi
if $with_cursor && ! command -v cursor >/dev/null; then
  echo "Missing prerequisite for Cursor component: cursor" >&2
  exit 1
fi
if ! python3 -c 'import sys; raise SystemExit(sys.version_info < (3, 9))'; then
  echo "Python 3.9 or newer is required." >&2
  exit 1
fi

installer_display=""
if (( ${#installer_args[@]} )); then installer_display=" ${installer_args[*]}"; fi

echo "o90 bootstrap"
echo "Repo: $repo"
if $apply; then echo "Mode: apply"; else echo "Mode: dry-run (no writes)"; fi
components=""
$with_pi && components="Pi"
$with_claude && components="${components:+$components + }Claude"
$with_codex && components="${components:+$components + }Codex"
$with_cursor && components="${components:+$components + }Cursor"
echo "Components: $components"
$with_pi && echo "Planned: bun install --frozen-lockfile (in pi/)"
if $apply; then
  echo "Planned: install.sh --apply$installer_display"
else
  echo "Planned: install.sh$installer_display (dry-run)"
fi
$with_pi && echo "Planned: install pinned Pi packages from pi/settings.json"
$with_claude && echo "Planned: add/update Claude marketplace vrennat/other-ninety"
$with_claude && echo "Planned: install/update other-ninety@other-ninety at user scope"
$with_codex && echo "Planned: register/verify Codex repo marketplace other-ninety from $repo/.agents/plugins/marketplace.json"
$with_codex && echo "Planned: install/verify Codex plugin other-ninety@other-ninety"
$with_codex && echo "Planned after plugin verification: install Codex companion config and retire checkout-owned legacy skill links"
$with_cursor && echo "Planned: install native o90 rules, agents, and skills in each selected Cursor project"
$with_pi && { $with_codex || $with_cursor; } && echo "Planned: add the optional o90 Pi-worker skill to selected hosts"
echo "Package/plugin writes are not covered by the config rollback manifest."
run_installer() {
  if (( ${#installer_args[@]} )); then
    "$repo/install.sh" "$@" "${installer_args[@]}"
  else
    "$repo/install.sh" "$@"
  fi
}
if ! $apply; then
  if $with_codex; then
    run_installer --codex-plugin-ready
  else
    run_installer
  fi
  exit 0
fi

$with_pi && (
    cd "$repo/pi"
    bun install --frozen-lockfile
  )

codex_marketplace_status() {
  python3 -c '
import json
import pathlib
import sys

expected = pathlib.Path(sys.argv[1]).expanduser().resolve()
payload = json.load(sys.stdin)
if isinstance(payload, dict):
    entries = payload.get("marketplaces", payload.get("items", []))
elif isinstance(payload, list):
    entries = payload
else:
    raise SystemExit("Unexpected Codex marketplace JSON shape")
if not isinstance(entries, list):
    raise SystemExit("Unexpected Codex marketplace JSON shape")

matches = [item for item in entries if isinstance(item, dict) and item.get("name") == "other-ninety"]
if not matches:
    print("missing")
    raise SystemExit(0)

roots = []
for item in matches:
    root = item.get("root")
    if root is None:
        source = item.get("marketplaceSource") or item.get("source") or {}
        if isinstance(source, dict):
            root = source.get("source") or source.get("path")
    if isinstance(root, str):
        roots.append(pathlib.Path(root).expanduser().resolve())

print("ready" if len(matches) == 1 and roots == [expected] else "collision")
' "$1"
}

codex_plugin_status() {
  python3 -c '
import json
import sys

payload = json.load(sys.stdin)
if isinstance(payload, dict):
    entries = payload.get("installed", [])
elif isinstance(payload, list):
    entries = payload
else:
    raise SystemExit("Unexpected Codex plugin JSON shape")
if not isinstance(entries, list):
    raise SystemExit("Unexpected Codex plugin JSON shape")

def matches(item):
    plugin_id = item.get("pluginId") or item.get("id")
    return plugin_id == "other-ninety@other-ninety" or (
        item.get("name") == "other-ninety" and
        (item.get("marketplaceName") or item.get("marketplace")) == "other-ninety"
    )

expected_version = sys.argv[1]
found = [item for item in entries if isinstance(item, dict) and matches(item)]
if not found:
    print("missing")
elif len(found) != 1 or not found[0].get("installed", True) or not found[0].get("enabled", True):
    print("unusable")
elif found[0].get("version") != expected_version:
    print("stale")
else:
    print("ready")
' "$1"
}

if $with_codex; then
  expected_plugin_version=$(python3 -c '
import json
import sys

payload = json.load(open(sys.argv[1]))
version = payload.get("version") if isinstance(payload, dict) else None
if not isinstance(version, str) or not version:
    raise SystemExit("Codex plugin manifest has no valid version")
print(version)
' "$repo/plugins/other-ninety/.codex-plugin/plugin.json")

  marketplace_json=$(codex plugin marketplace list --json)
  if ! marketplace_status=$(codex_marketplace_status "$repo" <<<"$marketplace_json"); then
    echo "Could not parse Codex marketplace state." >&2
    exit 1
  fi

  case "$marketplace_status" in
    missing)
      codex plugin marketplace add "$repo" --json >/dev/null
      ;;
    ready)
      ;;
    collision)
      echo "Codex marketplace name collision: other-ninety is already registered from a different source." >&2
      exit 1
      ;;
    *)
      echo "Could not verify Codex marketplace other-ninety." >&2
      exit 1
      ;;
  esac

  marketplace_json=$(codex plugin marketplace list --json)
  if ! marketplace_status=$(codex_marketplace_status "$repo" <<<"$marketplace_json") || \
      [[ "$marketplace_status" != ready ]]; then
    echo "Codex marketplace verification failed after registration." >&2
    exit 1
  fi

  plugin_json=$(codex plugin list --json)
  if ! plugin_status=$(codex_plugin_status "$expected_plugin_version" <<<"$plugin_json"); then
    echo "Could not parse Codex plugin state." >&2
    exit 1
  fi

  case "$plugin_status" in
    missing|stale)
      codex plugin add other-ninety@other-ninety --json >/dev/null
      ;;
    ready)
      ;;
    unusable)
      echo "Codex plugin other-ninety@other-ninety is installed but not enabled." >&2
      exit 1
      ;;
    *)
      echo "Could not verify Codex plugin other-ninety@other-ninety." >&2
      exit 1
      ;;
  esac

  plugin_json=$(codex plugin list --json)
  if ! plugin_status=$(codex_plugin_status "$expected_plugin_version" <<<"$plugin_json") || \
      [[ "$plugin_status" != ready ]]; then
    echo "Codex plugin verification failed after installation." >&2
    exit 1
  fi
fi

if $with_codex; then
  run_installer --apply --codex-plugin-ready
else
  run_installer --apply
fi

$with_pi && while IFS= read -r package; do
  (cd "$repo/pi" && pi install "$package")
done < <(python3 - "$repo/pi/settings.json" <<'PY'
import json, sys
for package in json.load(open(sys.argv[1]))["packages"]:
    print(package)
PY
)

if $with_claude; then
  marketplaces=$(claude plugin marketplace list --json)
  if python3 -c 'import json,sys; raise SystemExit(not any(item.get("repo") == "vrennat/other-ninety" for item in json.load(sys.stdin)))' <<<"$marketplaces"; then
    claude plugin marketplace update other-ninety
  else
    claude plugin marketplace add vrennat/other-ninety
  fi
  plugins=$(claude plugin list --json)
  if python3 -c 'import json,sys; raise SystemExit(not any(item.get("id") == "other-ninety@other-ninety" for item in json.load(sys.stdin)))' <<<"$plugins"; then
    claude plugin update other-ninety@other-ninety --scope user
  else
    claude plugin install other-ninety@other-ninety --scope user
  fi
fi

echo "Next: restart selected runtimes and authenticate their providers."
if $with_pi; then
  echo "Optional Pi smoke check: run o90-pi with a small read-only task."
fi
