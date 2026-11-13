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

**Gate patterns** (`gate.ts`), derived from `CLAUDE.md`'s gated list, matched on the Bash command.
A tag means the call matched one of these known patterns, nothing more: **no tag does not mean
not gated.** An alias, a script, a Makefile target under another name or a tool these rows do not
name all pass untagged, and the map is display only, never a check that a step was allowed.

- `git push` (any; `--force`, `--force-with-lease`, a short-flag cluster holding `f` such as
  `-uf`, or a `+refspec` labelled force), with git's global options (`-C dir`, `-c k=v`,
  `--no-pager`, ...) allowed before the subcommand, as for every git row.
- `git reset --hard`, `git branch -D`, and the discard family: `git checkout -- <paths>` or
  `git checkout .`, `git clean -f…`, `git restore` of the worktree (not `--staged` alone),
  `git stash drop|clear`.
- Deploys: `wrangler deploy|publish|pages deploy|versions deploy`, `bun|npm|pnpm|yarn [run]
  deploy…`, `make … deploy`.
- Remote data: `wrangler d1 execute … --remote`, `wrangler d1 migrations apply … --remote`,
  `wrangler r2 object put|delete … --remote`, `wrangler d1|r2|kv … create|delete`,
  `wrangler secret put|delete|bulk`.
- GitHub: `gh pr merge`, `gh repo delete`, `gh api -X DELETE` (or `--method DELETE`).
- Global installs: `npm|pnpm i|install|add -g`, `bun add -g`, `yarn global add`, `brew install`,
  `uv tool install`, `pipx install`, `cargo install`.

A command whose payload is a string handed to another shell (`bash -c`, `sh -c`, `eval`,
`ssh host <command>`, a script piped into `sh`) gets a distinct grey, dashed `not read` tag
(`wrapped, not read` in the feed, `◇`) instead of nothing, since the map blanks quoted text and
cannot see what it runs. A known gate on the same line outranks it.

MCP tools whose names contain `delete`, `create`, `apply` or `deploy` are tagged `remote …`. It
is a name heuristic with known limits: it cannot tell a remote service from a local one, so it
skips `create` on memory-style tools (names holding `memory`, `knowledge`, `entities`,
`relations`, `observations`), still tags their `delete`, and misses a remote change named any
other way (`update_…`, `put_…`, `send_…`). The table is the single source; each row has a test.

Classification is linear and bounded, since every tool call waits on it: the map reads at most
the first 16 KB of a command, blanks quoted text and heredoc bodies in one left-to-right pass,
and tries each gate pattern once at the start of each simple command (after assignments and
prefix words such as `sudo`, `env`, `xargs`), never at every word. A gated step past 16 KB goes
unmarked, and so does a gated program named as an argument (`echo git push`).

**Labels: names, never content.** File: last two path parts. URL: host only. Bash: the call's
`description`, else the command's first word, never the command line. Subagent: its
`description`. Hook refusal: the tool it stopped, never the reason. Control characters stripped.
A test feeds a command line that contains a fake token and asserts the token reaches no label,
feed row or stored state.

The label rule matters beyond the screen: the board lives in `$.state`, and the mod API lets any
plugin read any plugin's state ("Any plugin reads any value; its owner alone writes it"), so
whatever the map stores, every other installed plugin can read. Line continuations are joined
before a command is split, and a word that looks like a credential (a known token prefix such
as `ghp_` or `sk-`, a value holding `=`, or a long run mixing upper case, lower case and digits)
is never a label or a program name; the call falls back to the tool's name.

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

## Revisions after first live use (2026-11-12)

Tanner used the dev copy in the desktop Code tab and steered these changes. Decisions are his
unless marked as an agent proposal.

- **Look: Clay, blended into Claude Code (Tanner).** Chosen from three directions (Blueprint,
  Clay, Scope) an Opus subagent rendered and put past a blind critic; Tanner preferred Clay and
  asked that it "blends into claude code". Transparent background, the app's greys and system
  sans, line-glyph stations, clay only for running work.
- **Legibility over minimalism (Tanner).** After "it's not really clear what's happening": every
  colour is named in an in-map legend; the gate mark is a violet tag naming the action; the
  dashed route line and Memory's purple were dropped as unexplained. Tanner kept the in-map
  legend and the yellow (context 70%) and violet (gated) colours over the critic's suggestion
  to fold them into clay, which would have given clay two meanings.
- **Calm over hover (Tanner).** The map is drawn as a plain image, not an interactive frame:
  the frame reloaded on every redraw and flickered. Hover detail was dropped with it.
- **Redraws debounced (Tanner asked; 750 ms is the agent's number).** The pane draws from a
  snapshot published at most every 750 ms, because one tool call wrote the board two or three
  times.
- **Opening it (Tanner).** No slash command needed: the pane opens when the desktop app
  attaches, and while it is closed a "Show map" button sits beside Claude Code's spinner. The
  mod API has no sidebar or toolbar entry. `/map` remains for idle sessions.
- **Feed (Tanner).** Model steps are off the feed (they still pulse); station chips filter it;
  shell rows name their real programs, skipping `cd` and shell keywords.
- **Out of the docs survey (agent proposal, not yet confirmed):** permission-wait marking via
  `tool.check`, station marks on transcript tool rows, a station suffix on the spinner word,
  remembering a closed pane in `$.store`, and jumping to a subagent with `$.ui.view`.
