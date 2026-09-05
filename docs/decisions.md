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
