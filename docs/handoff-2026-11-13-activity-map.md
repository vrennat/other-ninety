# Handoff: activity map status list (2026-11-13)

Branch `feat/map-status-list`, pull request 22. Head at handoff: the commit that adds this file,
on top of `d7a0a74`. Nothing is half-done: the plugin tests pass at head.

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

## Adversarial review at f681cfa: five findings, all fixed in d7a0a74

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

## Owed before merge

- A re-review of d7a0a74 by a fresh adversarial reviewer. The fixes have not been reviewed.

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
