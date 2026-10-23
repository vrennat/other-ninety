#!/usr/bin/env bash
# shots.sh: screenshot URLs at several viewport sizes in one call. See SKILL.md.
set -euo pipefail
# Prefer the current repo's own Playwright CLI (no download, matches its browsers),
# then $SHOTS_PLAYWRIGHT, then a pinned bunx copy.
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [ -n "${SHOTS_PLAYWRIGHT:-}" ]; then pw=("$SHOTS_PLAYWRIGHT")
elif [ -x "$root/node_modules/.bin/playwright" ]; then pw=("$root/node_modules/.bin/playwright")
else pw=(bunx playwright@1.61.1); fi
out=shots; sizes=390x844,768x1024,1440x900; extra=()
urls=()
while [ $# -gt 0 ]; do
  case "$1" in
    --out) out=$2; shift 2 ;;
    --sizes) sizes=$2; shift 2 ;;
    --full) extra+=(--full-page); shift ;;
    --wait) extra+=(--wait-for-selector "$2"); shift 2 ;;
    --dark) extra+=(--color-scheme dark); shift ;;
    --storage) extra+=(--load-storage "$2"); shift 2 ;;
    -h|--help) sed -n '2p' "$0"; exit 0 ;;
    -*) echo "shots: unknown option $1" >&2; exit 2 ;;
    *) urls+=("$1"); shift ;;
  esac
done
[ ${#urls[@]} -gt 0 ] || { echo "usage: shots.sh [--out DIR] [--sizes WxH,...] [--full] [--wait SEL] [--dark] [--storage FILE] URL..." >&2; exit 2; }
mkdir -p "$out"
fail=0
for url in "${urls[@]}"; do
  slug=$(printf '%s' "$url" | sed -E 's#^[a-z]+://##; s#[^A-Za-z0-9]+#-#g; s#^-+##; s#-+$##' | rev | cut -c1-60 | rev | sed -E 's#^-+##')   # keep the end: the path tail tells pages apart
  [ -n "$slug" ] || slug=page
  IFS=, read -ra list <<< "$sizes"
  for s in "${list[@]}"; do
    w=${s%x*}; h=${s#*x}
    file="$out/$slug-${w}x${h}.png"
    if "${pw[@]}" screenshot --viewport-size "$w, $h" ${extra[@]+"${extra[@]}"} "$url" "$file" >/dev/null 2>"$file.err"; then
      rm -f "$file.err"; echo "$file"
    else
      echo "FAILED $url at ${w}x${h}: $(tail -n 3 "$file.err" | tr '\n' ' ')" >&2; fail=1
    fi
  done
done
exit $fail
