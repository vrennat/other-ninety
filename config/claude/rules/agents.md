# Agent Orchestration

## Complexity Routing

Routes ordinary per-task work. Conductor sessions (below) are exempt.

| Complexity  | Criteria                        | Workflow                                                 |
| ----------- | ------------------------------- | -------------------------------------------------------- |
| Simple      | 1 file, <50 LOC                 | Direct implementation (no agents)                        |
| Medium      | 2-3 files, clear scope          | 1-2 parallel `other-ninety:fast-impl` -> validator |
| Complex     | 4-5 files, unclear scope        | 2-3 parallel `other-ninety:fast-impl` -> validator |
| Significant | Architectural, >5 coupled files | Multi-agent coordination (below)                         |

Skip agents for questions, trivial fixes, and pure research. Prefer direct implementation for small changes (<30 LOC each) even across multiple files.

**Carve-out: "verify a claim" does not route by file count.** Route it on how hard the claim is to falsify — a single line of source can take an afternoon, a 40-file sweep can be a five-minute grep. Give it a dedicated agent with the claim stated as falsifiable; `verification.md` defines what counts as verified.

Read agent descriptions from the Agent tool list at spawn time — no duplicate inventory here. Use `isolation: "worktree"` when agents might conflict with each other or main work.

## Model Strategy

| Tier          | Model  | Use for                                           |
| ------------- | ------ | ------------------------------------------------- |
| Workers       | haiku  | Mechanical implementation, validation (subagents) |
| Specialists   | sonnet | Review, debugging, deep exploration (subagents)   |
| Lead          | opus   | Main session default                              |
| Hardest tasks | fable  | Main session only, for genuinely hard work        |

Fable is the most capable tier (Mythos-class, above Opus) but is main-session-only — never spawn it as a subagent. Default delegated work to haiku/sonnet, and spawn opus agents whenever a sub-task genuinely needs that depth.

## Standard clauses for every agent brief

Boilerplate, not per-brief invention. Include both in any verification-oriented brief — and in `fast-impl` / `validator` style workers, whose whole value depends on their reports being true.

**Reporting contract.** Without it the conductor drowns in transcripts; with it a 30-minute investigation compresses to a screenful:

> Your final message is the return value and the ONLY thing the conductor sees. Be terse and dense. Tables where possible. No file contents, no diffs, no narration of what you ran. Lead with anything that blocks.

**Permission to fail.** Agents default to producing *a* result, so an inconclusive test gets rounded up to a pass unless this is explicit:

> "I could not verify this and here is precisely why" is an acceptable and useful report. Do not manufacture a weaker test and present it as the strong one.

## Multi-Agent Coordination (Significant tasks only)

For work spanning 5+ tightly coupled files or needing mid-execution communication: `TaskCreate` per unit of work (file paths + acceptance criteria); spawn named agents that follow the teammate protocol in `~/.claude/agents/teammate.md` (paste it inline for reliability); resume with `SendMessage(to: <name>)` rather than spawning fresh — accumulated context is the point; validator agent when the work is complete.

## Conductor sessions

When I explicitly ask for a conductor / project-manager-shaped session ("you are the conductor, delegate, preserve your own context"), run the `conductor` skill — it carries the full brief structure, authorization gates, and worked examples (verbatim capture in `project documentation`). The routing table above does not apply there, and cost is measured in orchestrator context, not file count.
