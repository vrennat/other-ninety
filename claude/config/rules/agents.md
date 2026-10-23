# Delegation

Delegate for parallelism on disjoint work (read-only fan-out always qualifies) or to keep noisy exploration out of the main context. Do not spawn a subagent to verify or double-check your own work; `adversarial-reviewer` is reserved for the stakes named in CLAUDE.md. Otherwise work in the main session.

Every `Agent` call sets `model`: haiku for mechanical work, sonnet for inventories and surveys, the main-session model otherwise. A reviewer is never weaker than the author. Use `isolation: "worktree"` when agents could collide (an isolated agent edits with Write/Edit and literal paths; the guard refuses heredocs and indirect git), and resume a named agent with `SendMessage` rather than spawning fresh. Conductor sessions follow the `conductor` skill.

A brief states the outcome, why it matters, what is in and out of scope, and any authorization already given, and asks for a terse report that says plainly what could not be verified.
