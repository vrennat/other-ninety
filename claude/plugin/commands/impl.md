---
name: impl
description: Workhorse command. Spec file, ticket ID, or freeform description -> classified, routed, executed work. Confirms only when ambiguous. Auto-detects Linear MCP for ticket flows.
---

# /impl

Execute work. Input is one of:

- Path to spec file: `/impl docs/specs/foo.md`
- Ticket ID: `/impl ABC-1234` (uses Linear MCP if available)
- Freeform: `/impl "make banner sticky on mobile"`
- `--dry-run` flag: print the assessment and stop

## Procedure

1. **Parse input.** If it matches `[A-Z]+-\d+` and Linear MCP tools (`mcp__plugin_linear_linear__*` or `mcp__claude_ai_Linear__*`) are available, fetch the ticket. If it's a path, read the spec. Otherwise treat as freeform.

2. **Read mode, then classify clarity, complexity, AND stakes.**
   - Mode: read `.claude/other-ninety-mode` (treat absent as `default`). It is `cautious`, `default`, or `autonomous` — set via `/mode`.
   - Clarity: clear (one obvious approach) or ambiguous (2+ approaches with real tradeoffs, OR missing requirement, OR multi-cause bug).
   - Complexity: simple (1 file, <50 LOC), medium (2-3 files), complex (>3 files).
   - Stakes: high if it touches auth, money, data integrity, security, or privacy, or is hard to undo; otherwise normal.
   - Print the mode first, then the classification, as the top two lines of output:
     `Mode: <mode>`
     `Clarity: clear/ambiguous | Complexity: simple/medium/complex | Stakes: normal/high`

3. **Branch on clarity, modulated by mode.**
   - `default`: ambiguous → ask all open questions in ONE batched numbered list, wait, then proceed. Clear → proceed silently.
   - `cautious`: same as default, plus — before executing a medium or complex task even when clarity is clear, print the planned routing and wait for a go-ahead.
   - `autonomous`: never block on clarity. Ambiguous → pick the most sensible default, state the assumption in one line, and proceed. (Destructive/irreversible ops and stakes-gated review are unaffected by mode — see Rules.)

4. **If `--dry-run`:** print the planned routing and stop.

5. **If Linear ticket:** update status to "In Progress" via Linear MCP.

6. **Second look (medium/complex only — skip for simple).** Before writing any code, interrogate the direction you just picked, in one deliberate pass. The first approach that looks right is usually the statistically-likely default, not the considered one. Ask: what here is the generic pattern reached for by reflex? What would give this a point of view instead of "looks fine"? What can be cut or tightened? Is there a simpler path dismissed too quickly? One pass, then commit to a direction — a sharpening step, not a stalling loop.

7. **Branch on complexity.**
   - Simple: implement directly in main session.
   - Medium: spawn 1-2 `fast-impl` agents in parallel via the Agent tool. Then dispatch `validator`.
   - Complex: `TeamCreate` with name like `impl-<slug>`. Decompose into atomic tasks via `TaskCreate` (one per file, with paths and acceptance criteria, plus `blockedBy` dependencies). Spawn `fast-impl` teammates. Monitor via `SendMessage`. On completion: `TeamDelete`, then dispatch `validator`. If change touches >5 files OR shared infrastructure: also dispatch `brutal-code-reviewer` for an architectural pass.

8. **If `Stakes: high`:** regardless of complexity tier, dispatch `adversarial-reviewer` after implementation — an independent break-it pass that reads the source fresh, distinct from the routine `brutal-code-reviewer`. A one-file auth or payment change still gets it; the complexity gate does not apply to stakes. Resolve blocking findings before claiming done.

9. **On `validator` failure:** dispatch `debug-genius` for diagnosis, then `fast-impl` for fix using debug-genius's output. Max 3 retry cycles before surfacing to user.

10. **Before claiming done:** run the project's verification command (typecheck, test, build) and paste its output verbatim. Do not claim done if it fails.

11. **If Linear ticket:** update status to "In Review".

12. **Report:**
```
Files modified: <list>
Verdict: <validator output>
Next: test locally; commit when ready.
```

## Rules

- "Ambiguous" is strict: 2+ real-tradeoff approaches, missing requirement, or multi-cause bug. NOT "I'd like to confirm this." NOT "this is non-trivial." NOT "this touches many files" (that's complexity).
- Stakes is orthogonal to clarity and complexity: a clear, simple change can still be high-stakes. When unsure whether something is high-stakes, treat it as high-stakes — an extra review pass costs minutes; skipping it on auth or money is the failure this routing exists to prevent. Stakes-gated review fires in every mode, including `autonomous`.
- **Mark borderline routing in-code.** When a classification call is a genuine judgment — routing simple where medium was plausible, treating stakes as normal where high was arguable, skipping a review pass on a borderline change — leave a `// o90:` comment at the relevant line (`# o90:` for Python/shell) that names the upgrade trigger: `// o90: routed simple, escalate if sorting logic grows beyond this file`. Only for real borderline calls, not every edit. `/debt` audits them later.
- Do NOT auto-commit work. Do NOT auto-create PRs. The user decides.
- The escape hatch from `~/.claude/CLAUDE.md` (destructive git, network side effects, money) always confirms regardless of clarity or mode.

## Examples

Clear + simple: `/impl "card backs render larger than fronts"` -> classify -> direct fix to one CSS rule -> validator -> done.

Ambiguous + medium: `/impl "add card sorting to hand"` -> ONE batched question (sort by? UI?) -> on answer, spawn 1-2 fast-impl, validator, done.

Clear + complex: `/impl ABC-1234` (refactor rules engine for layered effects, ticket has design) -> TeamCreate, decompose, fast-impl teammates, validator, brutal-code-reviewer (touches >5 files), done.

Clear + simple + high-stakes: `/impl "fix the JWT expiry check"` -> classify (Stakes: high) -> direct fix -> validator -> adversarial-reviewer (independent break-it pass) -> resolve findings -> done.
