# Handoff: activity map status list (2026-11-13)

Branch `feat/map-status-list`, pull request 22. Nothing is half-done: the plugin tests pass at
head. Updated after the second review (section "Re-review at 10cf2dc").

## Next action

A fresh adversarial reviewer re-reviews pull request 22 before merge. Then Tanner looks at the
real pane in the desktop app (list below). Merge, a plugin release and a version bump each need
his words.

## What the pane is now

Direction B, chosen by Tanner on 2026-11-13 ("activity map b"); see D37 in `docs/decisions.md`
and the "Revision: status list" section of `docs/specs/2026-11-11-activity-map-design.md`.

Top to bottom: the running call with its time and context fill; "Failed since your last
message"; "Seen using the internet" (what the map recognised as reaching out, not a complete
list); "Recent". No diagram, legend or counts. Code: `claude/plugin/hooks/map/` (`classify.ts`,
`gate.ts`, `rows.ts`, `register.tsx`), tests in `map.test.tsx`, recorded fixture in
`fixtures/conductor-2026-11-13.ts`.

## Adversarial review at f681cfa: five findings

`d7a0a74` addressed all five. The re-review at `10cf2dc` closed 1 to 3, found 4 only partly
closed, and found two new defects in the fix for 5 (see below).

1. Network commands missed behind prefixes and separators (`env`, `sudo -u`, `timeout`, `nohup`,
   `xargs`, `&`, backticks, subshells, `bunx`/`npx`, many programs). Fixed: `reachesOut` uses the
   gate's `commandsOf`, more programs and subcommands, loopback-only calls stay local. A test row
   per case.
2. Failed calls, browser tools and wrapped commands missing from the internet section; localhost
   counted as internet. Fixed: failed and wrapped rows name their program (`curl · exit 22`,
   `ssh · not read`); browser page loads count and end in their host; loopback WebFetch and the
   preview tools stay local; the section is renamed "Seen using the internet". Also fixed on the
   way: opening a browser tab was tagged "remote create".
3. Typed-by-you origin set. Fixed: `composer`, `bridge`, `person` (the engine's own test in the
   2.1.323 binary); `sdk` and `slack-ping` dropped. The binary maps a stored origin `human` (how
   the desktop app stores a typed prompt) to `composer`; the fixture now records that and covers
   30 prompts, with task notices and other sessions' messages.
4. A model-written description could show a secret. Fixed: a description with a
   credential-shaped word falls back to the program or type name.
5. Orphaned subagent calls ran forever; the tick ran during app-tool waits. Fixed: each tick asks
   `$.agent.list()` and closes calls of subagents no longer alive as "stopped"; app calls do not
   keep the tick going.

Earlier, two Codex findings were fixed in `f681cfa` (failures judged by when they ended; a gated
call never folds under an ungated one).

Checks at d7a0a74: `claude plugin test claude/plugin` exit 0, 34 pass; `claude plugin validate
claude/plugin` exit 0; `scripts/verify.sh` exit 0. Baseline: the 0.6.0 code replaying the same
fixture shows You 36 and Network 63; the new code sees 19 calls reaching out and 12 of 30 prompts
typed.

## Re-review at 10cf2dc: A to E

- **A.** A live subagent could be closed as stopped when missing from `$.agent.list()` (the list
  leaves out workflow agents and lists a teammate under another id), and its later real result
  was lost. Fixed: a call is closed only when its subagent is listed as completed, failed or
  killed, or has been missing for 10 minutes; a later finish writes its real result over the stop.
- **B.** An `agent.list` that threw or hung stopped the clock. Fixed: the check runs last in the
  tick, in its own catch, with a 2 s timeout and one listing at a time.
- **C.** Any loopback-looking word made a remote call local (a proxy on localhost, an output file
  named localhost). Fixed: only hosts count; option values and paths are not hosts; a call is
  local only when every host it names is loopback.
- **D.** Finding 4 partly open (`token:sk-…`, an email address, `password hunter2`). Fixed: words
  are also split on `:` and `=`, email addresses count as secret, and so does the word after
  password, passwd, token, secret, apikey or bearer.
- **E.** This file said all five were fixed. Corrected here.
- Also: a heredoc fed to a shell (`sh <<EOF`) is now tagged "not read".

Accepted by the reviewer as known limits, given the heading "Seen using the internet":
`find -exec curl`, `watch curl`, `parallel curl`, `python3 -m pip install`, a quoted `"curl"`,
`$CURL`.

## Owed before merge

- One more check of the A to E fixes by the same reviewer. They have not been reviewed.

## Only Tanner can confirm, by looking at the real pane

Nobody has seen this pane in the desktop app. Rendering was checked by running the pane's render
hook in the test harness and converting its element tree to HTML with estimated spacing.

- A message he types shows as a You row and clears the Failed list (the `composer` mapping is read
  from the binary, not seen live).
- Spacing, text sizes and wrapping of long labels and file names.
- The running time and clock move during a long call.
- A killed subagent's row turns "stopped" (`$.agent.list()` statuses not seen live).
- The "Show map" button and auto-open still work (unchanged).

## Gated

Merge to `main`, a plugin release, a version bump, and `bootstrap --apply` need Tanner's words.

## Related

- Browser rule (pull request 21, D36): merged and live. `~/.claude/CLAUDE.md` links into the main
  checkout, which is at the merge commit.

## Open follow-ups

- A setting to stop the pane opening by itself: not built; decide after Tanner has used the new
  pane.
- A prompt queued with no stored origin arrives `unclassified` and is not counted as typed;
  untested, since the recorded session had none.
