#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")" && pwd)
apply=false
with_pi=false
with_claude=false
with_codex=false
with_pi_text=false
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
        pi-text) with_pi_text=true ;;
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
        pi-text) with_pi_text=true ;;
        *) echo "Unknown optional component: $component" >&2; exit 2 ;;
      esac
      installer_args+=("$1")
      shift
      ;;
    --overlay|--claude-dir|--codex-dir|--pi-dir|--pi-root|--state-dir)
      (( $# >= 2 )) || { echo "Missing value for $1" >&2; exit 2; }
      installer_args+=("$1" "$2")
      shift 2
      ;;
    --overlay=*|--claude-dir=*|--codex-dir=*|--pi-dir=*|--pi-root=*|--state-dir=*)
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
if $with_pi_text && ! $with_pi; then
  echo "--with pi-text requires --with pi" >&2
  exit 2
fi

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
$with_pi_text && components="$components (+ o90 Pi text)"
echo "Components: $components"
$with_pi && echo "Planned: bun install --frozen-lockfile (in pi/)"
if $apply; then
  echo "Planned: install.sh --apply$installer_display"
else
  echo "Planned: install.sh$installer_display (dry-run)"
fi
$with_pi && echo "Planned: install Pi packages from effective settings (overlay or preserved live settings)"
$with_claude && echo "Planned: add/update Claude marketplace vrennat/other-ninety"
$with_claude && echo "Planned: install/update other-ninety@other-ninety at user scope"
echo "Package/plugin writes are not covered by the config rollback manifest."
run_installer() {
  if (( ${#installer_args[@]} )); then
    "$repo/install.sh" "$@" "${installer_args[@]}"
  else
    "$repo/install.sh" "$@"
  fi
}
if $with_pi; then
  # Command substitution propagates validation failure; process substitution does not.
  pi_plan=$(run_installer --print-pi-packages)
  pi_dir=${pi_plan%%$'\n'*}
fi
if ! $apply; then
  run_installer
  exit 0
fi

$with_pi && (
    cd "$repo/pi"
    bun install --frozen-lockfile
  )

run_installer --apply

if $with_pi; then
  while IFS= read -r package; do
    [ -n "$package" ] || continue
    (cd "$pi_dir" && PI_CODING_AGENT_DIR="$pi_dir" pi install "$package")
  done <<<"${pi_plan#"$pi_dir"}"
fi

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
