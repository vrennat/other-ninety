# Activity map: design

Status: spec, not built. Decisions: D27 (ships inside `other-ninety`, on for every install) and
D28 (core map plus a gate marker), both settled by Tanner on 2026-11-11. Tanner also chose an
o90-native mod over vendoring lot-map that day.

## Premise

Tanner wants it: "the visualization angle is huge", after the lot-map thread
(r/ClaudeAI 1xst2qe, ↑1713, logged in other-ninety-private `magpie/log.md` 2026-11-11). The need
it answers showed up the same day: a reddit-mcp call hung for 90 s, four times, and nothing on
screen told a stuck call apart from a slow one. The context-% warning exists only in the overlay's
terminal statusline, and Tanner works in the desktop Code tab. "I want this" settles the premise.
Whether the map changes how sessions go is untested; the acceptance criteria check that it is
correct, not that it is useful.

## Overview

A mod in the `other-ninety` plugin draws a pane beside the chat: the agent at the centre, stations
around it by kind of work, and a pulse out and back for every model step, tool call and hook.
Under the map is a feed of recent calls. It adds o90's own knowledge, gated actions, as a
distinct mark.

## Goals

1. **Where the work is going:** stations `you`, `model`, `memory`, `files`, `shell`, `network`,
   `browser`, `agents`, `skills`, `hooks`. Each call pulses out on start and back on end; spokes
   thicken with use over the session.
2. **Stuck is visible:** a running call grows a minute hand and a ten-minute hand on its station.
3. **Context fill:** a ring around the centre from `session.measure`'s `context.percent`; amber
   at 70%, red at 90%.
4. **Failures:** errors and hook refusals turn the pulse red and leave a count on the station
   until the next user message.
5. **Gated actions (D28b):** a call that matches the gate list gets a gate mark on its pulse and
   a feed row tagged `gate`, coloured apart from errors. It marks and never blocks: blocking
   belongs to hooks and the push guard (D12: warn, do not block).
6. **Feed:** the last 16 calls, `●` running, `·` done, `✕` failed, `◆` gate. Consecutive
   finished calls at one station fold into one row (`+N`).
7. **Subagents:** each running subagent circles the `agents` station; its own calls start from
   there.

## Non-goals

- Side sessions or other sessions on the map (D28c, rejected for v1: no cross-session event in
  the 2.1.321 mod API).
- Skins, languages, layout options. One look, set by the design-taste manifest.
- Codex and Pi equivalents. This is a Claude-only surface; record it under PARITY "Intentional
  differences".
- Any network request, file read, process, model call, or text added to the conversation or
  system prompt.

## Architecture

Files under `claude/plugin/` (paths to confirm against the plugin layout at build time):

| File | Role |
| --- | --- |
| `hooks/hooks.json` | `{ "modules": ["./map/register.tsx"] }` |
| `hooks/map/register.tsx` | event hooks, state updates, pane open, `/map` command |
| `hooks/map/classify.ts` | pure: a tool call → `{ station, label, gate? }` |
| `hooks/map/gate.ts` | pure: the gate patterns, one exported table |
| `hooks/map/draw.tsx` | pure: board state → `Svg` tree (desktop, vscode, mobile) or a text tree (terminal) |
| `hooks/map/*.test.ts(x)` | `claude plugin test` cases |
| `types/index.d.ts` | the `$.state` contract (`board`) |

**Events:**
- `tool.call`: wrap `next(e)`: record start, await, record end with status.
- `turn.start` / `turn.step` / `turn.complete`: model pulses and the turn's end ring.
- `session.measure`: context ring.
- `agent.spawn`: subagent dots.
- `session.compact`: a model pulse labelled compaction.
- `session.start`: open the pane (`$.ui.open`) and register `/map`.

Exact payload fields come from the build's own types (`claude-code/index.d.ts`), not this spec.

**State:** one `board` atom (entries capped at 80, per-station counts, faults, running agents,
context %), tagged with a `shape` so a reload drops an incompatible earlier value.

**Rendering:** `ui.render` on `{ component: 'Pane', requestId }`. Desktop, VS Code and mobile get
`Svg`; the terminal has no `Svg`, so it gets the current action, context % and the feed as text.
The pane redraws from atom writes. A clock tick, at most 1 Hz and only while a call is running,
advances the clock hands.

**Classification** (`classify.ts`), by tool name first, then the Bash command's first word:
- `Read`/`Write`/`Edit`/`Glob`/`Grep`/`NotebookEdit` → files, or memory when the path is under
  `~/.claude/projects/*/memory/`.
- `Bash` → files for file-only commands (`cat`, `sed`, `mv`, `rm`, `find`, `grep`), network for
  `curl`, `gh`, `ssh`, `rsync`, `git push|fetch|pull|clone`, package installs, `wrangler`, `docker
  pull`; shell otherwise.
- `WebFetch`/`WebSearch`/`mcp__*` → network; browser MCP tools (`Claude_Browser`, `playwright`,
  `claude-in-chrome`) → browser.
- `Agent`/`Workflow` → agents; `Skill`/`ToolSearch` → skills.
- An unknown tool → shell, labelled with its name.

**Gate patterns** (`gate.ts`), derived from `CLAUDE.md`'s gated list, matched on the Bash command:
`git push` (any; `--force`/`-f`/`--force-with-lease` labelled force), `git reset --hard`,
`git branch -D`, `wrangler deploy|publish`, `wrangler d1 execute … --remote`, `wrangler d1
migrations apply … --remote`, `wrangler r2 object put|delete … --remote`, `wrangler secret put`,
`npm i -g`/`bun add -g`/`brew install`, `gh pr merge`. MCP tools whose names contain `delete`,
`create`, `apply` or `deploy` on a remote service are marked too. The table is the single source;
each row has a test.

**Labels: names, never content.** File: last two path parts. URL: host only. Bash: the call's
`description`, else the command's first word, never the command line. Subagent: its
`description`. Hook refusal: the tool it stopped, never the reason. Control characters stripped.
A test feeds a command line that contains a fake token and asserts the token reaches no label,
feed row or stored state.

**Fault isolation:** every handler runs inside a catch that swallows its own errors; `tool.call`
always returns `next(e)`'s result unchanged. A map fault never alters a tool call or a turn.

**D15 amendment:** the plugin gains a hooks module. The PARITY line "The plugin ships no
SessionStart hook" becomes "The plugin adds nothing to the conversation or system prompt; its only
hooks module is the activity map." `scripts/test_parity.py` and `scripts/lint-plugin.sh` learn the
new path.

**Early-access API:** the mod API's types say "this surface may change between releases without
notice". Every o90 install now carries a dependency on it, so the release checklist runs
`claude plugin validate` and `claude plugin test` against the Claude Code version current at
release.

## Open questions (resolved with defaults)

- **Pane auto-opens?** Yes on desktop and VS Code at `session.start`. In the terminal, only with
  `/map`, since a pane steals columns there.
- **Look:** follow `design-taste`: write the map's manifest entry first, then judge screenshots
  with its blind critic. Theme follows the surface (dark/light), no user colours.
- **Reference code:** lot-map (MIT) is read for ideas only. No code is copied, so no notice is
  needed; if a block is copied after all, keep its MIT notice next to it.
- **CI:** CI has no `claude` binary, so `claude plugin test` runs locally before release and is
  added to the release checklist. The pure modules (`classify`, `gate`, `draw`) also get Bun
  tests that CI runs.
- **Gate marks on non-Bash tools:** only the MCP name heuristic above; extend on a named miss.

## Acceptance criteria

Requested behaviour:
1. In the desktop Code tab, a fresh session opens the map pane by itself. A Read, a Bash `curl`, a
   WebFetch and an Agent call each pulse their stations (files, network, network, agents), shown
   by a screenshot at each step.
2. A Bash `sleep 75` shows the minute hand past one full lap, then returns as done.
3. A failing Bash command turns its pulse red and leaves a count of 1 on shell, cleared by the next
   user message.
4. The context ring matches `session.measure`'s `context.percent` within 1 point, and is amber at
   ≥70%, red at ≥90% (forced through the test harness).
5. `git push --dry-run` on a scratch branch carries a gate mark and a `◆` feed row; `git status`
   does not. Each `gate.ts` row has a passing match test and a near-miss test.
6. The token-leak test passes: a fake token in a command line appears nowhere in labels, feed or
   `$.state`.
7. In a terminal session, `/map` shows the text version and no `Svg` is rendered.

Preserved behaviour:
8. A handler forced to throw (test harness) leaves the tool call's result identical to a run
   without the plugin.
9. `scripts/verify.sh`, `scripts/test_parity.py` and `scripts/lint-plugin.sh` pass with the PARITY
   amendment; `claude plugin validate claude/plugin` reports no refusals.
10. The plugin's commands, `adversarial-reviewer` agent and skills still load (PARITY "Claude
    plugin" checklist).
11. No network request, file read or process call appears in the module (`claude plugin validate`'s
    report of what the module calls).
