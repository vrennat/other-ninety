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
$with_codex && echo "Planned: install Codex global instructions, native agents, and o90 skills"
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
  run_installer
  exit 0
fi

$with_pi && (
    cd "$repo/pi"
    bun install --frozen-lockfile
  )
run_installer --apply

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
