#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")" && pwd)
apply=false
installer_args=()
while (( $# )); do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --overlay|--claude-dir|--pi-dir|--pi-root|--state-dir)
      (( $# >= 2 )) || { echo "Missing value for $1" >&2; exit 2; }
      installer_args+=("$1" "$2")
      shift 2
      ;;
    --overlay=*|--claude-dir=*|--pi-dir=*|--pi-root=*|--state-dir=*)
      installer_args+=("$1")
      shift
      ;;
    *)
      echo "Unsupported bootstrap option: $1" >&2
      exit 2
      ;;
  esac
done

for command in git python3 bun claude pi; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
if ! python3 -c 'import sys; raise SystemExit(sys.version_info < (3, 9))'; then
  echo "Python 3.9 or newer is required." >&2
  exit 1
fi

installer_display=""
if (( ${#installer_args[@]} )); then installer_display=" ${installer_args[*]}"; fi

echo "o90 bootstrap"
echo "Repo: $repo"
if $apply; then echo "Mode: apply"; else echo "Mode: dry-run (no writes)"; fi
echo "Planned: bun install --frozen-lockfile (in pi/)"
if $apply; then
  echo "Planned: install.sh --apply$installer_display"
else
  echo "Planned: install.sh$installer_display (dry-run)"
fi
echo "Planned: install pinned Pi packages from pi/settings.json"
echo "Planned: add/update Claude marketplace vrennat/other-ninety"
echo "Planned: install/update other-ninety@other-ninety at user scope"
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

(
  cd "$repo/pi"
  bun install --frozen-lockfile
)
run_installer --apply

while IFS= read -r package; do
  (cd "$repo/pi" && pi install "$package")
done < <(python3 - "$repo/pi/settings.json" <<'PY'
import json, sys
for package in json.load(open(sys.argv[1]))["packages"]:
    print(package)
PY
)

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

echo "Next: restart Claude/Pi, authenticate providers (Linear OAuth is interactive), then run /mode and /pi for smoke checks."
