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
