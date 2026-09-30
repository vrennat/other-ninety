# Delegation

Delegate for one of three reasons, never for file count:

1. **Parallelism** on provably disjoint write surfaces, where no step needs another's output and each result is verifiable alone. Read-only fan-out (search, audit, review) always qualifies.
2. **Isolation** of noisy exploration or long verification, so the main context stays clean.
3. **Independent review** with fresh eyes: `adversarial-reviewer` on stakes; a separate reviewer for changes spanning multiple systems.

Otherwise do the work in the main session. Verifying a claim routes on how hard it is to falsify, not on size; state it as falsifiable and go looking for the disconfirming result.

Models: agents inherit the main-session model unless the work is mechanical (haiku) or an inventory or survey brief (sonnet, reading frontmatter or headings first and full bodies only for the shortlist). A reviewer is never a weaker model than the author it reviews. Use `isolation: "worktree"` when agents could collide, and resume a named agent with `SendMessage` rather than spawning fresh. Conductor sessions follow the `conductor` skill.

Every brief names the requested outcome, the purpose it serves, acceptance checks, owned paths, explicit exclusions, and authorization already given. Purpose is what lets a worker resolve a case the acceptance checks did not anticipate; without it they guess or stall. Include relevant prior product decisions, especially deliberately removed or rejected behavior. A worker may make necessary supporting changes within its ownership; a wider write surface or product decision comes back to the lead. The lead resolves coordination within the user's scope without asking the user again, and asks only if that scope must materially change. Preserve other agents' edits.

Every brief carries both clauses verbatim:

> Your final message is the return value and the ONLY thing the caller sees. Be terse and dense. Tables where possible. No file contents, no diffs, no narration of what you ran. Lead with anything that blocks. Give the path of every file the caller may need to open.

> "I could not verify this and here is precisely why" is an acceptable and useful report. Do not manufacture a weaker test and present it as the strong one.
