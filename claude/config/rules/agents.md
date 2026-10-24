# Delegation

Delegate for parallelism on disjoint work (read-only fan-out always qualifies), to keep noisy exploration out of the main context, or to verify a long build against its spec from a fresh context when no test covers it. `adversarial-reviewer` is reserved for the stakes named in CLAUDE.md. Otherwise work in the main session.

Every `Agent` call sets `model`: `haiku` for inventories, grep sweeps, log triage, format conversion, and other work with a checkable answer; `sonnet` for surveys, summaries, and first-pass implementation in a well-specified area; `opus` or inherit for anything a reviewer would have to re-derive. A reviewer is never weaker than the author. Use `isolation: "worktree"` when agents could collide (an isolated agent edits with Write/Edit and literal paths; the guard refuses heredocs and indirect git), and resume a named agent with `SendMessage` rather than spawning fresh. Conductor sessions follow the `conductor` skill.

A brief states the outcome, why it matters, what is in and out of scope, and any authorization already given, and asks for a terse report that says plainly what could not be verified.
