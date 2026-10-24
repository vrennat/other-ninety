# Decision log

One heading per decision, numbered in the order the question was raised. A number is an address:
it is assigned when the question is asked, not when it is answered, and is never reused or
renumbered. Every entry carries lettered options and an explicit recommendation. Answer by number
and letter (`D4b`). Resolved decisions stay here with the resolution recorded in place.

Only choices with more than one defensible answer belong here. Anything the code, tests, or git
history can explain does not.

| # | Decision | Status |
|---|---|---|
| D1 | Where `/impl` records lessons, and how much | Resolved |
| D2 | `/status` as a prompt or a script | Resolved |
| D3 | Scope of the write-surface guard | Resolved |
| D4 | CI without a committed Pi lockfile | Resolved |
| D5 | Fable-era always-loaded layer: how far to strip | Resolved |
| D6 | Plugin command, agent, and skill surface | Resolved |
| D7 | Codex and Cursor adapters | Resolved |
| D8 | User-level skills and their drift | Resolved |
| D9 | What Pi loads as CLAUDE.md | Resolved |
| D10 | Pi default: stock or the o90 text | Resolved |
| D11 | Autonomy follows requested scope and existing authorization | Resolved |
| D12 | Structural breaks and notifications: warn, do not block | Resolved |
| D13 | Matt Pocock's skills: borrow the mechanics, adopt none of the catalogue | Resolved |
| D14 | Conversation residue in commits: a rule line, not a blocking hook | Resolved |
| D15 | Opus 5.5 default: plugin SessionStart injection and model pins | Resolved |
| D16 | Cut workflow layers and share configuration ownership | Resolved |
| D17 | Unattended merges require behavior-aware classification | Resolved |
| D18 | Capture portable private Codex configuration with native profiles | Resolved |
| D19 | Claude 5-era always-loaded text: second strip | Resolved |
| D20 | Session audit 2026-10-09: start directory, permissions, push guard, model routing, settings | Resolved |
| D21 | Second session audit 2026-10-09: text-only push guard, authorization scope, shell environment, repeatable audit | Resolved |
| D22 | Trim always-loaded guidance for the Claude 5 family | Resolved |

---

## D1. Where `/impl` records lessons, and how much — Resolved

The next agent should not rediscover what this one learned, but a lessons file rots into a second
instruction set nobody prunes.

- **(a) One dated line per `/impl` run in `docs/lessons.md`, only when the code, tests, history,
  and repo instructions could not have told the next agent the same thing; `/trim docs/lessons.md`
  prunes.** ← chosen
- (b) Free-form notes in `.claude/notes/`.
- (c) No file; rely on commit messages.

**Resolution (2026-08-28):** (a). "None" is the expected common answer; the bound is the feature.

## D2. `/status` as a prompt or a script — Resolved

- **(a) Prompt-only command: three git reads and one `gh pr list` call, one table.** ← chosen
- (b) A Python script in the plugin, testable and deterministic.

**Resolution (2026-08-28):** (a), matching `/debt`. Every column comes from a command that ran and
unfillable columns show `?`. Revisit if the table proves unreliable in practice.

## D3. Scope of the write-surface guard — Resolved

headcount's `agent-guard` enforces a repo-wide roster and surface map (every tracked path has
exactly one owner) plus a per-diff check.

- (a) Port both halves: roster, map file, CI ownership sweep, and diff check.
- **(b) Diff half only: a worktree branch's changes must stay inside the globs its agent was
  given. No roster, no ownership sweep.** ← chosen
- (c) Prose only, as the conductor skill already said.

**Resolution (2026-08-29):** (b). o90 routes per task, not per repo; a worktree is already the
attribution a roster exists to reconstruct. Escalate to (a) if a repo runs standing agents for
weeks and ownership questions outlive any one branch.

## D4. CI without a committed Pi lockfile — Resolved

`pi/bun.lock` is gitignored and `@earendil-works/pi-coding-agent` is pinned to `latest`, so
`bun install --frozen-lockfile` in CI installs without freezing anything (verified: bun exits 0
with no lockfile present).

- (a) Run CI as-is; accept that the Pi typecheck and tests float with upstream.
- **(b) Commit `pi/bun.lock`, remove the ignore, and pin `pi-coding-agent` to a version.**
  ← recommended
- (c) Skip the Pi step in CI and run it locally only.

**Recommendation:** (b). A floating devDependency means a CI failure may be upstream's change, not
ours, and nobody can tell which from the log. (a) is the interim state until this is answered.

**Resolution (2026-08-29):** (b). `pi-coding-agent` pinned to `0.84.2`. Applying it showed the premise
was half wrong: `pi/bun.lock` was already tracked, so the `.gitignore` line was inert (git keeps
tracking an ignored file); the line is removed so the file cannot silently drop out later. The
`latest` pin was the real problem. Verified: `bun install --frozen-lockfile` passes on the committed pair and
fails when `package.json` drifts from the lock. `bun run update:pi` remains the deliberate upgrade path.

## D5. Fable-era always-loaded layer: how far to strip — Resolved

Every Claude session loads about 4,200 tokens of o90 text before the first prompt: `CLAUDE.md` 920, `rules/` 1,670, the SessionStart injection 480, and until 2026-09-01 the same injection a second time from the plugin's previous-name twin, still enabled alongside it plus a 31-line list of mostly dead sessions. The Fable 5.1 system prompt now states autonomy, scope discipline, verification honesty, and a writing style of its own, so three o90 blocks restate it (`CLAUDE.md` "Style" and "Output style", the hook's output-style block) and one contradicted it (post-compact "absolute paths", removed). The complexity table in `rules/agents.md` routes by file count; across 119 transcripts in 30 days `validator` ran 0 times and `fast-impl` 4, against `general-purpose` 205.

- **(a) Strip to what the system prompt cannot know: stack, the five working rules, the stop-before list, git and deploy gates, code conventions, and one Workflow paragraph naming the surviving commands. `rules/verification.md` stays. `rules/agents.md` becomes delegation-by-reason (parallelism, isolation, independent review) plus the two standard brief clauses. The hook injection shrinks to the stakes rule and the command list. Both output-style blocks go. About 1,600 tokens.** ← recommended
- (b) Keep the layer; remove only the duplicated output-style block.
- (c) Strip further: fold `verification.md` into four lines of `CLAUDE.md` and delete `rules/`.

**Recommendation:** (a). (c) saves about 400 more tokens but loses the worked reasoning behind each verification rule, which is what changes behavior on the day it matters.

**Resolution (2026-09-01):** (a). `CLAUDE.md` is 35 lines (about 670 tokens), `rules/agents.md` is delegation-by-reason (about 340), `rules/verification.md` is unchanged (about 690), and the hook injects about 140. Both output-style blocks are gone from Claude; `shared/output-style.md` remains Pi's canonical policy.

## D6. Plugin command, agent, and skill surface — Resolved

Thirty-day invocation counts from 119 transcripts: `adversarial-reviewer` 27, `brainstorm` 9, `plan` 9, `impl` 8, `brutal-code-reviewer` 4, `fast-impl` 4, `debug-genius` 1, `validator` 0; `/trim`, `/debt`, `/mode`, `/tdd`, `/research`, `/status`, `/surface`, `/pi`, `/bootstrap` 0; skills `clean-writing`, `onboarding`, `plan-hunter`, `systematic-debugging`, `verification-before-completion` 0. No project has `.o90/mode`, `.o90/surface`, or `docs/lessons.md`; three `o90:` markers exist across every repo. Anthropic now ships `plan-hunter`, `/code-review` with `ultra`, `/simplify`, `/security-review`, and plan mode, which overlap five of ours.

- **(a) Keep `/brainstorm`, `/impl`, `/plan`, `/trim`, `adversarial-reviewer`, `clean-writing`. Cut `/mode` and its plumbing, `/debt` and the marker convention, `/surface`, `/status`, `/pi`, `/research`, `/tdd`, `/bootstrap`, `fast-impl`, `validator`, `debug-genius`, `brutal-code-reviewer`, `plan-hunter`, `onboarding`, `systematic-debugging`, `verification-before-completion`. `/impl` loses its file-count tiers: work happens in the main session, delegation follows `rules/agents.md`, more than five files goes to `/code-review`, and TDD becomes a one-line opt-in inside `/impl`.** ← recommended
- (b) As (a) but keep `brutal-code-reviewer` for architectural review of shared infrastructure.
- (c) Keep everything; fix only the hook and the dead command references.

**Recommendation:** (a). `/trim` survives on its contract (deletion only, net-lines total), not its count. `brutal-code-reviewer` is the closest call; `/code-review high` on a fresh subagent covers it.

**Resolution (2026-09-01):** (a). Plugin 0.4.0 ships `/brainstorm`, `/impl`, `/plan`, `/trim`, `adversarial-reviewer`, and `clean-writing`. `/impl` prints clarity and stakes only, works in the main session, sends more than five files to `/code-review`, and takes `--tdd` as a flag. The `o90:` marker convention is retired; the three existing markers are ordinary comments now.

## D7. Codex and Cursor adapters — Resolved

`codex/`, `cursor/`, `plugins/other-ninety/` (the Codex skill package), the `skills` symlink, `docs/catalog-parity.md`, and the parity tests exist so the seven-skill catalog ships to four runtimes. On taiga no project has `.cursor/rules/o90.mdc`, `~/.codex/AGENTS.md` is the personal June file with no o90 agents, and the codex binary does not launch. Pi is fully linked and used daily.

- **(a) Archive Codex and Cursor: delete their directories, the Codex plugin package, the `skills` symlink, and their tests. The Claude plugin becomes the one copy of each skill and Pi links to it.** ← recommended
- (b) Keep all four runtimes and the byte-for-byte mirror.
- (c) Keep Codex, drop Cursor.

**Recommendation:** (a). Reversible from history if either runtime returns. Four-runtime parity is the largest single source of duplicated prose in the repo.

**Resolution (2026-09-01):** (a). `codex/`, `cursor/`, `plugins/`, `integrations/`, `bin/`, `.agents/`, the `skills` symlink, `docs/catalog-parity.md`, and their tests are deleted; `docs/agent-federation.md` moved to `docs/archive/`. The installer, drift checker, bootstrap, lint, and verify scripts know only `pi` and `claude`.

## D8. User-level skills and their drift — Resolved

`~/.claude/skills/` holds twelve real directories, copied by the installer rather than linked. Five differ from the repo (conductor by 304 lines, the others by 5 to 14 lines), with the repo side newer in every case, except that the live conductor carries a private `references/example-briefs.md` that the public SKILL.md still cites. Thirty-day use: `i-have-adhd` 3, `conductor` 4, `summarize` 4, `pr` 1; `typecheck`, `ticket`, `quick-review`, `design-ctx`, `skill-creator` (Anthropic ships one), `researcher` (30 KB, duplicates `/research`), and `svelte5-best-practices` 0.

- **(a) Cut `typecheck`, `ticket`, `quick-review`, `pr`, `design-ctx`, `skill-creator`, `researcher`. Keep `conductor`, `i-have-adhd`, `summarize`, `svelte5-best-practices`. Link the survivors from `~/.claude/skills/` into the repo the way `CLAUDE.md`, `rules`, and `hooks` already are, so drift cannot recur; the private example briefs move to the overlay.** ← recommended
- (b) Keep all twelve; only link them.

**Recommendation:** (a). `svelte5-best-practices` stays on content, not count: stack knowledge the model cannot infer, at the cost of one description line.

**Resolution (2026-09-01):** (a), with one refinement found while applying it: the live `conductor` copy is the richer private version (model routing, shakedown results, worked briefs), so it is now owned by the private overlay (`other-ninety-private/claude/skills/conductor`) rather than linked to the public repo. The installer links skills with a new `link-if-missing` action that never replaces a real directory, so a private copy survives a re-run without `--overlay`.

## D9. What Pi loads as CLAUDE.md — Resolved

`~/.pi/agent/CLAUDE.md` is a July symlink into the retired `claude-setup` repo, so Pi reads the pre-o90 persona and rules alongside o90's `AGENTS.md`.

- **(a) Repoint it at `claude/config/CLAUDE.md` and let the installer manage it.** ← recommended
- (b) Remove the link; Pi keeps only `AGENTS.md` and `APPEND_SYSTEM.md`.
- (c) Leave it.

**Recommendation:** (a), unless the persona paragraph is wanted in Pi, in which case it belongs in the private overlay.


**Resolution (2026-09-01):** (b), not (a). The Pi eval run the same day (stock 8/8 at 167k tokens; public 8/8 at 267k; private behavior overlay 8/8 at 423k, 2.53x tokens, no task wins) showed the persona-and-workflow overlay costs without helping, and the retired link was exactly that overlay. Removed. Making the public Pi `AGENTS.md` and `APPEND_SYSTEM.md` opt-in is a Pi-side change left to the eval work.

## D10. Pi default: stock or the o90 text — Resolved

Three paired screens in o90-evals on 2026-09-01 and 02 (Pi 0.84.2, openai-codex/gpt-5.6-sol, one repeat, saturated suites): the stripped public layer used 1.53x stock's total tokens on the 8-fixture mechanism probe and 1.62x on the 12 regression sentinels with 20/20 completion on both arms; a two-rule candidate (clarity and stakes rules only) used 1.89x. The o90 text was higher on 26 of 28 pairs and loaded no skills, so the always-loaded text itself carries the overhead.

- **(a) Stock Pi by default; `AGENTS.md` and `APPEND_SYSTEM.md` link only with `--with pi-text`; the drift check flags a leftover link.** ← chosen
- (b) Keep the text linked by default and trim it further.
- (c) Delete the Pi text from the repository.

**Resolution (2026-09-02):** (a). (b) already failed in its minimal form. (c) throws away the opt-in for a machine where someone wants the rules in Pi. The real-task ledger is the only lane that could still show a quality effect; until it does, Pi runs stock.



## D11. Autonomy follows requested scope and existing authorization — Resolved

The stop-before list required another confirmation for actions already requested,
while its reversibility rule allowed unrelated local changes. `/impl` also treated
technical diagnosis as a reason to ask the user, and Pi's autonomous mode could
skip decisions that actually belonged to the user.

- **(a) Complete the requested outcome and necessary supporting work; preserve
  existing authorization across turns and delegates; ask for missing product
  decisions, materially broader scope, or external actions not yet authorized.** ← chosen
- (b) Keep reversibility and a confirmation-mode switch as the primary boundary.
- (c) Require a reviewed implementation plan before every change.

**Resolution (2026-09-05):** (a). Explicit proposal-only and other user stop points
remain binding. Technical uncertainty prompts investigation. Reversible edits
must still serve the requested outcome. Examples in `docs/autonomy-scenarios.md`
cover both needless pauses and unsolicited expansion; they are review scenarios,
not a claim that model behavior has been measured.

## D12. Structural breaks and notifications: warn, do not block — Superseded

Measured 2026-09-07 over 14 days of transcripts on taiga and tundra: the median
gap between Claude's reply and the next prompt was 2.8 and 2.4 minutes, with 44%
and 31% of gaps under 2 minutes; the most expensive session on either host (83
prompts, 5,456 calls, 868M input tokens) ran from 2 to 4 am; model-initiated
PushNotification calls happened twice. Claude Code has no built-in quiet-hours or
break setting, and Notification hooks cannot block, so any structure has to be a
hook.

- **(a) One warn-only hook (`focus.py`) on UserPromptSubmit and Notification: a
  per-host streak that resets after a 10-minute gap, a `systemMessage` plus desktop
  notification at 50 minutes and every 25 after, a quiet-hours line 23:00–06:00,
  the streak in the statusline, and a deterministic away-notification when a
  session goes idle 10 or more minutes after the last prompt.** ← chosen
- (b) The same with a hard block at 90 minutes and hard quiet hours, overridable
  with a `go:` prefix.
- (c) Nothing in the harness; rely on the desktop app's own push notifications.

**Resolution (2026-09-07):** (a). Tanner's call: start warn-only; if a block ever
locks him out he would rip the whole thing out, so the hard block is not worth
its first false positive. (c) fails on evidence: the app pushes exist and the
measured pattern happened anyway. Automation is exempt by `O90_FOCUS=off`, an
Agent SDK entrypoint, or `claude -p` without `--sdk-url`. The hook logs every
nudge and notification to `~/.local/state/other-ninety/focus.log`, which is the
positive control for "it fired". Re-measure with the session-audit probes before
claiming the median gap moved.

Amended the same evening after the first `/retro`: in a 50-minute session the
streak reset three times because idle was measured from the last prompt, so a
long agent turn counted as the user stepping away (prompt gaps 13, 15.5, and
11.4 minutes against true idle of 7.7, 2.5, and 4.8). A Stop hook now records
the last reply and idle is the gap since the later of prompt and reply.

**Superseded (2026-10-05):** removed entirely — the hook, its settings
registration, the statusline segment, and the `/retro` evidence line. In use the
nudges and the injected context added noise to every long session (Claude
relayed them as break advice mid-task) rather than changing behavior. The
warn-only design anticipated this exit: if it stopped earning its place, rip it
out rather than escalate to blocking.

## D13. Matt Pocock's skills: borrow the mechanics, adopt none of the catalogue — Resolved

Compared all 37 skills in `mattpocock/skills` at `3cca18b` (2026-09-07) against
the plugin, the four live user-level skills, and the rules. Fourteen duplicate
`/brainstorm`, `/impl`, `/code-review` plus `adversarial-reviewer`, `clean-writing`,
or `conductor`; six of those also depend on his setup skill writing an issue
tracker and label vocabulary into the repo. Six name real gaps. Seventeen are
specific to his courses and layout. The mechanism that matters: 22 of his skills
carry `disable-model-invocation: true`, so their descriptions never load; all
four o90 skills paid a description line every turn (about 1,000 tokens), and two
had zero uses in 30 days at D8.

- **(a) Adopt no skill as-is. Mark `summarize` and `svelte5-best-practices`
  user-invoked. Fold the gaps into existing commands: spec-fidelity review and a
  red-repro gate with tagged debug output in `/impl`; frontier rounds, fact
  dispatch, and an empty-frontier completion criterion in `/brainstorm`. Add two
  user-invoked skills, `retro` (the agent's environment, not the code; what D5 to
  D11 did by hand) and `wizard` (bash walkthrough for human-only steps). Reshape
  `conductor` into a router with the brief structure, authorization gates, and
  session operations behind stated conditions. One pass restating
  prohibition-shaped lines as the positive default where the default was
  unspecified.** ← chosen
- (b) Install the six additive skills as they are.
- (c) Take only the `disable-model-invocation` flag.

**Resolution (2026-09-07):** (a). A user-invoked skill costs nothing unused, so
it never needs to clear D6's measured-use bar; the bar still applies to anything
model-invoked. `summarize` now needs `/summarize` rather than "catch me up"; if
that turns out to matter, drop the flag on that one skill. The private overlay's
`researcher` and `skill-creator` directories, cut in D8 but never deleted, are
gone. Lines kept as prohibitions on purpose: amend-never, secrets-never, the
conductor's three "do not" bullets (each carries its reason), and the vendored
`i-have-adhd` forbidden-phrase lists.

## D14. Conversation residue in commits: a rule line, not a blocking hook — Resolved

Prompted by `ChufanS008/ship-the-result` (r/ClaudeAI, 2026-09-14): a skill
stating that commit text, comments, and names are written for the reader of the
artifact rather than the person in the chat, a six-family regex scanner, and a
PreToolUse hook that blocks `git commit` and `gh pr create` on a hit, passing the
identical command on its second run. Measured 2026-09-14 against local history
before deciding:

| Corpus | Size | Scanner hits | Real residue on inspection |
|---|---|---|---|
| Commit subjects, all local repos, 90 days | 3,541 | 20 | 5 ("address review feedback") |
| o90 commit bodies, 90 days | 555 lines | 8 | 0 |
| Code comments, mulligan-labs | 26,539 | 375 | sample all decision phrasing |
| Code comments, o90 | 156 | 3 | 0 |

The residue the post describes ("as requested", "sorry", "fixed version",
`_no_ketchup` filenames) does not occur in the subjects at all. The remaining
hits are decision phrasing ("instead of a sprite sheet", "rather than a guess",
"(non-secret)") that the "preserve reasoning" rule asks for. Scanner defects:
conventional-commit scopes beginning with "no" or "sans" match the negated-draft
family (`fix(normalize):`, `feat(notes):`, `fix(nonce):`), and test names
containing new, old, final, real, or working are flagged as identifiers. The hook
runs Python on every Bash call with no prefilter: median 92 ms against 25 ms for
`pre-push-guard.sh` (n=20 each).

- **(a) One sentence under "Git and deployment" in `CLAUDE.md`: outward-facing
  text describes the artifact for a reader who never saw the chat, and a phrase
  that only makes sense against a rejected draft or a correction is rewritten
  from the final state. About 60 tokens, always loaded, blocks nothing.** ← chosen
- (b) Install the skill and hook as published.
- (c) Vendor the scanner with the scope bug fixed and run it warn-only from the
  pre-push guard.

**Resolution (2026-09-14):** (a). (b) fails D12 (a block with the false-positive
rate above would be ripped out on its first hit), D13 (a model-invoked skill with
a 120-word description loaded every turn has no measured use to justify it), and
the "preserve reasoning" rule it would police. (c) adds a moving part for five
occurrences in ninety days. The audience principle is the useful part and fits
in one line; revisit if `/retro` finds residue reaching history after the rule.

## D15. Opus 5.5 default: plugin SessionStart injection and model pins — Resolved

With Opus 5.5 as the default main model (effort `high`, no advisor), the 2026-09-23 setup
audit found the plugin's SessionStart hook injecting a block that repeats the global
`CLAUDE.md` (scope, stakes review, `/brainstorm` `/impl` `/plan` `/trim`) on every start,
resume, clear, and compact, and found `adversarial-reviewer` and `teammate` pinned to
Sonnet, below the model whose work they review.

- **(a) Delete the plugin SessionStart hook; `CLAUDE.md` is the one copy. Agents inherit the
  main model; routing names only the mechanical (haiku) and survey (sonnet) exceptions.** ← chosen
- (b) Keep the hook and trim `CLAUDE.md` instead. The hook only reaches sessions with the plugin
  enabled, and `CLAUDE.md` reaches every session.
- (c) Keep both copies.

**Resolution (2026-09-24):** (a). The injection is pure duplication, and a reviewer weaker than
the author defeats the point of independent review on stakes. The routing line written for a
Fable-priced main session ("Fable stays in the main session") no longer describes the setup.

## D16. Cut workflow layers and share configuration ownership — Resolved

The public/private audit found workflow rules duplicated across commands,
obsolete Pi mode and marker prompts, installer and drift catalogs maintained
separately, and personal fallback routes compiled into a public extension.

- **(a) Cut the duplicate workflow layers. Keep Pi implementation in the main
  session by default, retain stakes review, and delegate for a concrete reason.
  Reuse the installer's target plan for drift and package selection; put personal
  routing in the private overlay.** ← chosen
- (b) Keep the layers and add synchronization rules and configuration receipts.

**Resolution (2026-09-30):** (a), with a preference for cuts across both repos.
One target plan removes ownership disagreement without another state file.
Overlay settings replace; existing public settings remain preserved. Real
Claude skill directories stay unmanaged unless an overlay owns them. Pi text
requires explicit opt-in, and missing fallback configuration disables automatic
substitution. The eight Pi agents remain until usage evidence supports a cut.

## D17. Unattended merges require behavior-aware classification — Resolved

The old gates treated any Markdown path as documentation and a patch/minor
dependency bump with green CI as safe. Instructions change agent behavior, and
dependency behavior is not established by a version label or existing tests.

- **(a) Allow reviewed human-facing documentation on a recorded allowlist;
  require authorization for the specific dependency bump plus independent
  behavior review and relevant checks. Keep deployment and high-stakes gates.** ← chosen
- (b) Keep the extension and semver shortcuts.

**Resolution (2026-09-30):** (a), in both public and private conductor policies.
Existing user authorization carries forward; missing authority or review parks
the merge while authorized preparation continues.

## D18. Capture portable private Codex configuration with native profiles — Resolved

Codex is now used daily, but its live home mixes portable preferences with
machine trust, credentials, plugins, hooks, and application state. The personal
instructions also retained unavailable tools and missing companion paths.

- **(a) Keep trimmed personal instructions and a native named preference
  profile in the private overlay. Link only those two files through an explicit
  component using the existing install, drift, and rollback plan.** ← chosen
- (b) Copy the complete Codex home or rebuild the retired public workflow adapter.

**Resolution (2026-09-30):** (a). Native profile layering preserves host settings
without a TOML merge engine or another mirrored command catalog. The bundled
CLI loads the profile and validates its settings locally; selection is explicit.
The base configuration and desktop model selection remain local. This extends
personal configuration ownership without reversing D7's public adapter cut.

## D19. Claude 5-era always-loaded text: second strip — Resolved

Anthropic's Claude 5 guidance (claude.dev "new rules of context engineering", 2026-07-24;
the Opus 5, Opus 5.5, and Sonnet 5 prompting pages) says the models now verify, finish, and
report progress without being told, that such instructions cause over-verification and
over-triggering, and that CLAUDE.md should spend its tokens on gotchas. Claude Code 2.1.285
(2026-09-29) gives background Bash its own time limits and stop notifications. Measured on
2026-10-01 over 1,164 transcripts in 30 days: `adversarial-reviewer` 179 spawns, `conductor`
11, `/impl` 6, figma plugin skills 1. In this session the SessionStart hook listed eleven
"live" sessions because `~/Developer` is not a repository and every session started there
matched on its plain path.

- **(a) Cut what the harness or model now does by default: "finish the requested outcome",
  "investigate technical uncertainty", the Bash-timeout and wait-for-background lines,
  "compact early" (the model cannot run `/compact`), the command and skill list (the harness
  already lists skills with their descriptions), and the live-sessions line (the hook covers it).
  Keep the scope boundary, the authorization list, stack, working rules, git and code
  conventions, the stakes rule, and compact instructions. Drop the deploy and falsifiability
  sections from `rules/verification.md`, which repeat `CLAUDE.md` and `rules/agents.md`.
  The SessionStart hook prints nothing outside a git repository.** ← chosen
- (b) Delete `rules/verification.md` outright as self-verification scaffolding.
- (c) Leave the text; rely on `/doctor prompt-audit`.

**Resolution (2026-10-01):** (a). `CLAUDE.md` goes from 6,133 to 3,458 bytes and
`rules/verification.md` from 2,761 to 2,069. (b) is rejected because the positive-control and
baseline rules are about external instruments, not the model checking its own work; the
guidance targets the second kind. Not measured: no paired eval was run, so "no loss" rests on
Anthropic's internal result, not ours. Left for Tanner, outside this repository: `~/AGENTS.md`
(the pre-D18 Codex file, 9,594 bytes) loads into every Claude session whose working
directory is under `~`, and the figma plugin's 14 skill descriptions load globally for one
use in 30 days.

Amended the same day: `/impl` drops the debugging method folded in at D13 (symptom
reproduction first, a stated hypothesis and minimal experiment per fix) and the "second look"
step, which repeats the challenge-first and simpler-first working rules. The three-cycle stop
and debug-output cleanup stay. Prompted by r/claudeskills `1wv6eoq` (2026-10-01): Pocock's
diagnosing-bugs and Superpowers' systematic-debugging against plain Claude Code on 15 real
bugs from one repository, three runs each, solved 9/15 in every arm and cost about three
minutes more per bug. One repository, n=3 per cell, and the author flags variance, so this is
consistent with the Anthropic guidance rather than independent proof. Pi's `prompts/impl.md`
received the same cut afterward so the two `/impl` procedures stay in step.

Follow-up 2026-10-02, both items above resolved: `~/AGENTS.md` moved out of `~` once the
overlay's `codex/AGENTS.md` took over as the Codex global file, and the user-scope plugin set
was cut to `other-ninety` alone. A `/doctor prompt-audit` run found the removed plugins
carrying the prompt text this decision strips from our own files (`YOU DO NOT HAVE A CHOICE`
blocks, reviews delegated to weaker models, a branch-deleting command with no confirmation),
and every one except the two LSP plugins and `security-guidance` was already disabled. Those
three were dropped as well to shrink the setup; their usage was not measured, and any one
is a single `claude plugin install` away.

## D20. Session audit 2026-10-09: start directory, permissions, push guard, model routing, settings — Resolved

A 14-day audit of every transcript under `~/.claude/projects` (sessions active 2026-09-25 to
2026-10-09: 341 transcripts, 154 with a human turn, 187 subagent transcripts, about $3.7k notional
at Opus 5.5 prices fitted from the cost records) found seven things worth changing. Each is here
because more than one fix was defensible.

1. **Sessions started outside a repository.** 78 of 341 sessions began in `~/Developer`, 55 of
   them desktop Code-tab or voice sessions. They loaded no project CLAUDE.md, memory, or skills,
   worktree isolation failed five times, and the SessionStart hook stayed silent by design (D19).
   - (a) A `~/Developer/CLAUDE.md` telling Claude to move into the target repository. Rejected:
     Claude Code reads CLAUDE.md from every parent directory, so it would load into every session
     under `~/Developer`, which is the always-loaded growth D5 and D19 cut.
   - **(b) The SessionStart hook prints one warning line outside a git repository, naming what is
     missing and how to reach the target repository's CLAUDE.md and memory index.** ← chosen. It
     costs context only in the sessions that have the problem. D19's silence was about false
     "live session" matches on a plain folder; the hook still lists nothing there.
2. **Permission mode.** Settings default to `bypassPermissions`, but the desktop app remembers the
   mode selector per folder and that choice overrides `defaultMode` (permission-modes doc, read
   2026-10-09). The transcripts show auto mode, which drops broad allow rules such as `Bash(*)` and
   `Agent(*)` on entry and re-reads chat approvals from the transcript, so they vanish at
   compaction (one session compacted 38 times). 25 classifier blocks, several on deploys and
   merges the user had just approved in chat.
   - (a) Turn on bypass in the desktop app per folder. Left to Tanner; it is a GUI toggle.
   - **(b) Narrow allow rules in the overlay for the recurring blocked operations: `git push`
     (plain and `git -C`), `bunx wrangler deploy`, `gh pr merge`, and `ssh` to badlands.** ← chosen.
     Narrow rules survive auto mode and resolve before the classifier; the push guard still runs
     first, and a hook block beats an allow rule. Compatible with (a).
     (Revised by D21: an adversarial review found the push, deploy, merge, and ssh rules unsafe
     as global rules; they were never written, and D21 replaces them.)
3. **Push guard false positives.** (Superseded by D21: the guard no longer reads a branch at all.) 26% of Bash calls start with `cd`, and the guard resolved the
   branch from the tool cwd, so five legitimate force-with-lease pushes to `claude/*` branches from
   worktrees were blocked in three sessions. Fixed in place: a leading `cd DIR` segment names the
   repo, an unresolvable `cd` falls back to the tool cwd, and the block message names the `git -C`
   form. No alternative was considered; the hook's own comment already described `git -C` as the
   intended escape and nothing told the model so.
4. **Agent model routing.** 166 of 202 `Agent` calls inherited Opus, including mechanical photo and
   sound labeling batches, and one conductor kept 12 standing Opus teammates for about $542.
   `rules/agents.md` now requires an explicit `model` on every call; the conductor skill caps
   standing agents at truly parallel write surfaces, stops idle ones, and reports a blocked item
   once. The alternative, a hook that rejects an `Agent` call without `model`, was not taken:
   D12 settled that structural breaks warn rather than block.
5. **Settings that did not do what they looked like.** The overlay settings still registered the
   focus hook removed under D12 on three events; converged with the live file. (This item first
   also claimed `autoCompactWindow: 250000` and `subagentPromptCacheTtl: "1h"` were invalid. The
   settings reference says otherwise: the top-level key takes a token count from 100000 to 1000000
   or a percentage string, and the TTL takes `"5m"` or `"1h"`. Both stay as they are; see D21.) Only $4 of recorded usage ran on the `[1m]`
   model against $742 on plain Opus 5.5, so the `model` setting is not reaching desktop sessions;
   the desktop dropdown is the fix and is Tanner's.
6. **Approval friction.** 94 of 480 human turns were a bare approval, and one conductor repeated
   the same waiting-on-approval line seven times in seven minutes. The scope rule gains one clause:
   an authorization given for a named action and target holds for the rest of the session. The
   compact instructions now keep authorizations across compaction.
7. **Sleep polling.** D19 cut the wait-for-background line as something the harness now handles.
   The audit counted 454 Bash calls with a blocked foreground `sleep` in 14 days, 365 of them after
   the D19 strip, so the harness block alone does not stop the attempts. One Gotchas line returns,
   narrowed to the blocked form and its two replacements.

**Resolution (2026-10-09):** chosen as above. Items 1, 3, 6, 7, and the `rules/agents.md` half of
4 were applied from the audit session. The auto-mode classifier refused the rest as
self-modification when the session tried to write them: the overlay `claude/settings.json`
(items 2 and 5: allow rules and the stale focus hooks)
and the conductor skill text in both repositories (item 4). Those land by hand or from a bypass
session; the entry above is the intended diff. Not measured: no paired evaluation. The next audit
should re-count classifier blocks, push-guard blocks, `sleep` attempts, bare-approval turns, and
sessions started outside a repository against these baselines.

## D21. Second session audit 2026-10-09: text-only push guard, authorization scope, shell environment, repeatable audit — Resolved

A second, concurrent audit (`~/Developer/session-audit/REPORT.md`: 1,246 transcripts from 2026-07
to 2026-10-09, six themed read-only reviewers, load-bearing claims re-checked against raw
transcripts) was merged with D20 on 2026-10-10. Two sessions split the work: the other one took
the Playwright MCP registration and a benchmark's resume notes. This entry records what
changed in this repository and the options not taken.

1. **Push guard reads text only.** Supersedes D20 item 3. All 16 of the old guard's blocks came
   from its non-fast-forward check: 10 on pushes to other branches, 3 on pushes git would have
   rejected anyway, and the model twice routed around a block with `gh api -X DELETE`.
   - (a) Keep resolving the branch, but better. Rejected: branch resolution from the tool cwd,
     `cd`, and `git -C` was the source of every false positive, and git already refuses a
     non-fast-forward push that is not forced.
   - **(b) Block only what git does not: a forced or deleting push aimed at main or master,
     decided from the command text with no git call.** ← chosen. A forced push whose destination
     is not written (no refspec, `HEAD`, `@`, a variable, `--mirror`) is blocked with a message
     that names the fix, since the hook cannot tell the branch. An adversarial review found
     the first text-only draft open to a forced push to main on a second line, after `2>&1`,
     inside `( )` or `bash -c`, behind `git -c`, as `-uf`, to master, or over ssh; all are fixed and
     tested (18 hook tests). The ssh exemption is gone: an ssh'd push reaches the same remote.
     Known false positive: those words inside a quoted string, such as a commit message. Known
     gap: a destination computed by `$(…)` at run time, and `gh api` ref writes, which no
     push hook sees.
2. **Authorization scope (CLAUDE.md Scope, third bullet).** The audit found agents stopping before
   routine actions and Tanner retyping grants after compaction (C1, C2), and agents handing Tanner
   work they could do (C3). The first draft let a repository's `## Authority` section grant
   commits, pushes, merges, and deploys, told agents to "ask once per repo and session", and said
   "a grant stands until revoked". The review found that an agent could write itself an Authority
   section, that a cloned repository could carry one, that the unscoped grant leaked across
   repositories, and that listing destructive Git dropped discarding uncommitted work. Chosen text:
   destructive Git is spelled out (including `reset --hard`, `clean`, `stash drop`); remote data
   writes and metered spend are gated; a grant names its action and target and survives
   compaction; only an Authority section in a repository Tanner maintains carries a grant into
   later sessions, and only Tanner writes one; session instructions override it; the agent offers
   to do gated work itself; `--admin`, `--no-verify`, and `gh api` reroutes count as bypasses.
   "Ask once per repo and session" was dropped: without an Authority section, behavior stays as it
   was. Which repositories get an Authority section is Tanner's call.
3. **Allow rules, revising D20 item 2(b).** The review showed each global rule removing the only
   check on a dangerous shape: `bunx wrangler* deploy` skips mulligan-labs' deploy guard and
   remote migrations, `gh pr merge *` merges in any repository including with `--admin`,
   `ssh * badlands *` matches any host, and `git push *` would have left only the hook. None was
   written (the classifier also refuses Claude writing allow rules into the overlay). The
   replacement, for Tanner to apply by hand: merge and exact deploy rules in the committed
   `.claude/settings.json` of solo repositories only; `ssh badlands *` only if Badlands is declared
   fully trusted; push rules only now that the hook holds; `autoMode` prose that names the real
   `lane/*` and `integration/*` branches and excludes integration branches in shared repositories,
   which a second person reviews. Drafts are in `~/Developer/session-audit/HANDOFF.md`.
4. **D20 item 5 correction.** `autoCompactWindow` and `subagentPromptCacheTtl` are valid as set
   (settings reference, read 2026-10-10); D20 now says so.
5. **Shell environment hook.** Bash runs in zsh, where `NOMATCH` and `EQUALS` broke 1,684 and 220
   commands (an unmatched glob, and a word starting with `=`). PATH also differed by shell
   snapshot: one lacked `/usr/sbin` (lsof, sysctl), the other put `/usr/bin` first, giving Python
   3.9 and the Xcode git shim behind the 2026-09-27 license outage. A SessionStart hook (`hooks/shell-env.sh`) appends `setopt NO_NOMATCH
   NO_EQUALS` and a PATH line to `CLAUDE_ENV_FILE`. Positive control: a headless session failed
   `echo ===` without the hook and passed with it, resolving python3 and git from Homebrew and
   lsof from `/usr/sbin`. The alternative, a CLAUDE.md line telling the model to quote, was
   rejected: it is always-loaded text for a problem a hook removes, and `~/.zprofile` was not
   used because it would change Tanner's interactive shells too.
6. **The audit is repeatable.** The miner, analyzer, and context printer moved into
   `skills/retro/scripts/` with a cross-session mode in the retro skill, rather than a top-level
   `scripts/session-audit/`, because skills are what `~/.claude` links live. Their data goes to
   `~/.local/state/session-audit/data`, never a repository, since transcripts hold pasted secrets
   and the miner's redaction is pattern-based. `scratch-helpers.py` finds scratch scripts a
   session reused, for the retro skill's new candidate category. No monthly launchd job: the
   useful part of the audit is model judgment over the extracts, and the weekly cost job in
   manabase already covers spend.
7. **Screenshots.** The `shots` skill sweeps viewports with a project's own Playwright, falling back
   to a pinned `bunx playwright`. It does not use npx by default: npm's cache on this Mac points at
   an unmounted volume, and npx downloads hang there.

**Resolution (2026-10-10):** items 1, 2, 4, 5, 6, and 7 applied in this repository; item 3 and the
conductor-skill bullets from D20 item 4 are drafted for Tanner, because the classifier refuses
Claude writing them. Not measured: the next audit should re-count push-guard blocks (baseline 16,
all false or redundant), NOMATCH and EQUALS errors (1,684 and 220), and bare-approval turns.

## D22. Trim always-loaded guidance for the Claude 5 family — Resolved

Anthropic's Opus 5 prompting guide (read 2026-10-23; the Opus 5.5 guide says Opus 5 prompts carry
over) says to remove explicit verification instructions such as "use a subagent to verify",
because they cause over-verification "with no loss in quality" when removed, and notes Opus 5
already delegates to subagents more readily and widens scope on its own. The Fable 5 guide says
most behavior can be steered "with a brief instruction rather than enumerating each behavior". An
inventory measured o90's always-loaded text at about 2,350 tokens with almost no emphatic
wording, so the problem was direction, not volume.

1. **`rules/verification.md` cut from 2.1 KB to 0.6 KB.** Kept the positive-control and baseline
   checks, which name specific failures the model does not avoid by default (the guide says Opus
   5.5 responds to named failure modes). Dropped the general framing and the "source review is not
   behavioral verification" section.
2. **Review narrowed.** The adversarial-reviewer pass now covers auth, money, data integrity,
   security, and hard-to-undo deploys or migrations. "Privacy" and "even when the diff is one
   line" as blanket triggers are gone; `agents.md` now says not to spawn a subagent to check one's
   own work.
3. **`rules/agents.md` cut from 2.6 KB to 1.0 KB.** Kept explicit `model` on every `Agent` call:
   the guide's "delegates more readily" makes routing more relevant, and D20 item 4 measured the
   cost of inheriting Opus. Replaced the brief checklist and the two verbatim reporting clauses
   with one sentence. The clauses stay in the conductor brief template, which loads on demand.
4. **Authorization block kept, reworded.** Both guides warn about unrequested actions and scope
   growth, so its meaning is unchanged; it lost little length.
5. **Duplicates removed** with items 2 and 3: the guide on memory notes that conflicting copies
   make Claude pick one arbitrarily.
6. **Conductor skill: no change.** Only the overlay copy is installed, so the public copy costs no
   context; deleting it would remove the skill from the public repository.

Outside this repository on the same day: the `~/Developer` memory index was pruned, and unused
claude.ai connectors were listed for Tanner to disconnect (a GUI setting).

Not measured: whether the trimmed rules change behavior. A later session audit should compare
reviewer-subagent spawns and verification-only tool calls against the 2026-10-09 audits.

## D23: Per-model effort, Haiku routing, and the last Opus-5 mitigations (2026-10-24)

A 2026-10-23 audit (`~/Developer/session-audit/REPORT-2026-10-23-claude-5.5.md`) compared the live
config and the sessions since 2026-10-09 against the Claude Code settings reference and the
Claude 5.5 / Fable 5.1 migration guides.

1. **`effortLevel: "high"` was inert.** The settings reference says the top-level key in the user
   file is ignored by Opus 5.5 and later, which start at `medium` until a level is saved under
   `modelSettings`. Every session since the move to Opus 5.5 ran at medium. The overlay now sets
   `modelSettings` per model: Opus 5.5 `high`, Sonnet 5.5 and Haiku 5.5 `medium`, each with
   `autoCompactWindow: "auto"` in place of the global 250k window (538 compactions in 400 sessions
   on models with a native 1M window). `[1m]` dropped from the model string; it is a no-op on
   Opus 4.7 and later.
2. **Routing names Haiku's work.** 0 of 241 subagents since 10-09 ran on haiku and 211 on opus.
   `rules/agents.md` now gives examples per tier instead of "mechanical work".
3. **Fresh-context verification allowed.** D22's "do not spawn a subagent to verify your own work"
   contradicted the Fable guide (fresh-context verifiers beat self-critique). Replaced with a
   permission scoped to long builds no test covers.
4. **Duplicates of Claude Code's own system prompt removed.** The sleep gotcha (36 blocks since
   10-09, down from 365) and most of the task-boundary recap are now in the harness prompt. The
   gotcha slot went to browser routing: 185 Claude Browser MCP errors, mostly a hidden pane, were
   the largest error class; Playwright MCP, muted, is the default.
5. **"Challenge first" scoped to design discussions**, with an explicit "do not list alternatives
   you are not recommending": the 5.x guides name alternatives-not-chosen as the elaboration
   higher effort produces.
6. **Auto-mode allow entries.** The merge entry was reworded to the imperative shape of the
   `$defaults` entries (13 Merge Without Review blocks despite it). A new entry permits edits to
   the two o90 repositories when asked (6 Self-Modification blocks); `bootstrap.sh --apply` still
   needs the user's instruction.
7. **Verification anecdote cut** to the rule.

Not changed: conductor public copy (D22 item 6 stands), teammate agent, pi routing (a Haiku/Sonnet
pilot for scout and impl tiers is proposed, not run), command scaffolds in `/plan` and
`/brainstorm` (to A/B on Fable).

Acceptance, over the 14 days to 2026-11-07, via the retro pipeline: subagent share on haiku or
sonnet above 25%; compactions per session below the 1.35 of this window; correction rate not above
19%; browser MCP errors per session halved; Merge Without Review and Self-Modification blocks near
zero. `/effort status` in a desktop session confirms the saved level.
