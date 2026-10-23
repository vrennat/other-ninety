#!/usr/bin/env bash
# pre-push-guard.sh
# PreToolUse hook: blocks a forced or deleting push aimed at main or master
# from Claude Code tool calls. It reads the command text only: no git, no
# working directory, no fetch.
#
# Rationale: many parallel Claude sessions push to the same repositories. A
# non-fast-forward push needs no guard, because git rejects it on its own
# unless the push is forced ("fetch first" / "non-fast-forward"). What git does
# not stop is a forced push, or a branch deletion, aimed at main.
#
# Until 2026-10-10 the hook also fetched origin/main and blocked non-ff pushes.
# All 16 of its blocks came from that path, 10 on pushes to other branches, 3
# on pushes git would have rejected anyway, and the model twice routed around
# a block with `gh api -X DELETE` (session audit; docs/decisions.md D21).
#
# Because the hook never asks git which branch is checked out, a forced push
# whose destination is not written out (no refspec, HEAD, @, or a $variable)
# is blocked too; writing the branch name is the fix.
#
# Blocked, for main and master alike:
#   git push --force|-f|-uf|--force-with-lease[=…] … main   also HEAD:main, refs/heads/main
#   git push … +<refspec naming main>
#   git push --force …                       with no refspec, or with HEAD, @ or a $variable
#   git push … --delete|-d main      and the empty-source form  git push origin :main
#   git push --mirror …              force-updates and deletes every remote ref
# Allowed: everything else, including non-fast-forward pushes and forced pushes
# whose refspec names another branch, from any directory (`cd`, `git -C`) or
# host (ssh pushes go to the same remote, so they are checked the same way).
#
# Parsing: backslash-newline continuations are joined, newlines and `; & | ( )`
# and backticks end a command, `N>&M` and `> file` redirections are dropped,
# and git is recognized by basename after its global options (-C, -c, …).
# Known false positive: the words "git push --force … main" inside a quoted
# string (a commit message) block; reword the string.
# Known gap: a destination produced by $(…) at run time.
#
# Exit codes:
#   0  — allow the tool call
#   2  — block the tool call (stderr shown to the model)

set -uo pipefail

payload=$(cat)

# Cheap prefilter: nearly every Bash call is not a push. Skip the python
# parsing below (~50 ms per call) unless the raw payload even contains "push".
case "$payload" in *push*) ;; *) exit 0 ;; esac

# Only act on Bash tool calls
tool_name=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("tool_name") or "")' <<<"$payload")
if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

cmd=$(python3 -c 'import json, sys; data=json.load(sys.stdin).get("tool_input") or {}; print(data.get("command") or "")' <<<"$payload")
if [[ -z "$cmd" ]]; then
  exit 0
fi

block() {
  echo "pre-push-guard: BLOCKED — $1" >&2
  echo "  command: $cmd" >&2
  echo "  $2" >&2
  echo "If main itself must change this way, run the command yourself outside Claude." >&2
  exit 2
}

# Flatten to one line of tokens with shell operators standing alone.
flat=${cmd//$'\\\n'/ }
flat=${flat//$'\n'/ ; }
flat=$(sed -E 's/[0-9]*>&[0-9]+//g; s/([;&|()`])/ \1 /g' <<<"$flat")
read -ra tokens <<< "$flat"

# Walk the tokens. Each `git push` invocation ends at a shell separator; flags
# can appear anywhere, so positions are not trusted. The first bare token after
# `push` is the remote, every later bare token a refspec.
in_push=false
has_force=false
has_delete=false
names_main=false
ambiguous=false
refspecs=0
remote_seen=false
skip_next=false

finish_push() {
  if [[ "$in_push" == "true" ]]; then
    if [[ "$has_force" == "true" && "$names_main" == "true" ]]; then
      block "forced push to main is not allowed from Claude Code." \
        "a forced push to another branch is fine when the refspec names it: git push --force-with-lease origin <branch>"
    fi
    if [[ "$has_force" == "true" && "$refspecs" -eq 0 ]]; then
      block "forced push without a refspec could land on main." \
        "name the branch: git push --force-with-lease origin <branch>"
    fi
    if [[ "$has_force" == "true" && "$ambiguous" == "true" ]]; then
      block "forced push to HEAD, @ or a variable: this hook cannot tell which branch that is." \
        "write the branch name: git push --force-with-lease origin <branch>  (or HEAD:refs/heads/<branch>)"
    fi
    if [[ "$has_delete" == "true" && "$names_main" == "true" ]]; then
      block "deleting main on the remote is not allowed from Claude Code." \
        "other branches can be deleted: git push origin --delete <branch>"
    fi
  fi
  in_push=false; has_force=false; has_delete=false; names_main=false
  ambiguous=false; refspecs=0; remote_seen=false; skip_next=false
}

for ((i=0; i<${#tokens[@]}; i++)); do
  tok="${tokens[i]//[\"\']/}"

  if [[ "$in_push" != "true" ]]; then
    t="${tok#\\}"
    if [[ "${t##*/}" == "git" ]]; then
      # Step over git's global options to the subcommand.
      j=$((i+1))
      while :; do
        n="${tokens[j]:-}"; n="${n//[\"\']/}"
        case "$n" in
          -C|-c|--git-dir|--work-tree|--namespace) ((j+=2)) ;;
          -*) ((j++)) ;;
          *) break ;;
        esac
      done
      if [[ "$n" == "push" ]]; then
        in_push=true; i=$j
      fi
    fi
    continue
  fi

  case "$tok" in
    \;|\&|\||\(|\)|\`) finish_push; continue ;;
  esac
  if [[ "$skip_next" == "true" ]]; then skip_next=false; continue; fi
  case "$tok" in
    \>|\>\>|[0-9]\>|[0-9]\>\>|\<) skip_next=true; continue ;;   # redirection target follows
    *\>*|*\<*) continue ;;                                        # redirection with its target
  esac

  case "$tok" in
    --mirror) has_force=true; names_main=true; continue ;;
    --force|--force-with-lease|--force-with-lease=*) has_force=true; continue ;;
    --delete) has_delete=true; continue ;;
    -o|--push-option|--repo|--receive-pack|--exec) skip_next=true; continue ;;  # option value follows
    --*) continue ;;
    -*)                                                          # short flags, possibly clustered (-uf)
      [[ "$tok" == *f* ]] && has_force=true
      [[ "$tok" == *d* ]] && has_delete=true
      continue ;;
  esac

  if [[ "$remote_seen" != "true" ]]; then
    remote_seen=true                                  # first bare token names the remote
    continue
  fi

  ((refspecs++))
  [[ "$tok" == +* ]] && has_force=true                # a leading + forces that refspec
  case "${tok#+}" in
    :main|:master|:refs/heads/main|:refs/heads/master) has_delete=true; names_main=true ;;
    main|master|refs/heads/main|refs/heads/master|*:main|*:master|*:refs/heads/main|*:refs/heads/master) names_main=true ;;
    HEAD|@|*\$*) ambiguous=true ;;
  esac
done
finish_push
exit 0
