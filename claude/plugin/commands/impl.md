---
name: impl
description: Workhorse command. Spec file, ticket ID, or freeform description -> classified, executed, verified work. Asks only for missing product decisions or broader scope. Auto-detects Linear MCP for ticket flows.
---

# /impl

Execute work. Input is one of:

- Path to a spec file: `/impl docs/specs/foo.md`
- Ticket ID: `/impl ABC-1234` (uses Linear MCP when available)
- Freeform: `/impl "make banner sticky on mobile"`
- `--dry-run`: print the classification and the plan, then stop
- `--tdd`: write the failing test first and show it fail before implementing

## Procedure

1. **Parse input.** A `[A-Z]+-\d+` token with Linear MCP tools available (`mcp__plugin_linear_linear__*` or `mcp__claude_ai_Linear__*`) is a ticket: fetch it. A path is a spec: read it. Anything else is freeform.

2. **Classify clarity and stakes, and print them first.**
   `Clarity: clear/ambiguous | Stakes: normal/high`
   - Clarity: ambiguous means an unresolved product requirement or a scope decision that would materially change the result. Investigate unknown APIs, competing technical approaches, and multi-cause bugs yourself; those are not reasons to ask the user.
   - Stakes: high if the change touches auth, money, data integrity, security, privacy, or remote persistence, or is hard to undo. When unsure, round up.

3. **`--dry-run`:** print the planned approach and stop before edits or ticket updates.

4. **Set scope.** Identify the requested outcome, existing authorization, and explicit exclusions from the conversation and project decisions. State the intended change briefly and proceed. Include supporting changes needed to deliver and verify it; leave unrelated cleanup and redesign out. If a product decision or materially broader change is required, explain the decision and ask once; continue work that does not depend on the answer.

5. **Ticket:** move it to "In Progress".

6. **Second look.** Before writing code, challenge the first approach once: what is the reflex pattern here, what can be cut, is there a simpler path dismissed too quickly? One pass, then commit to a direction.

7. **Implement in this session.** Delegate only for the reasons in `rules/agents.md`: parallel work on disjoint write surfaces, isolating noisy exploration, or independent review. Size alone is not a reason. With `--tdd`, write the test, run it, show the failure, then implement.

8. **Review by stakes and size.** High stakes: dispatch `adversarial-reviewer` after implementation, whatever the diff size, and resolve blocking findings before claiming done. More than five files or shared infrastructure: run `/code-review` as well.

9. **Verify.** Run the repository's typecheck, tests, lint, and build, and paste the output verbatim. Exercise the changed behavior, not only the commands. If verification fails, diagnose with a stated hypothesis and a minimal experiment before the next fix; stop after three failed repair cycles and report the evidence.

10. **Ticket:** move it to "In Review".

11. **Capture one lesson, or none.** Append at most one line to `docs/lessons.md` (create it if absent) as `- YYYY-MM-DD <area>: <what would have saved time if known up front>`, only if a future agent could not derive it from the code, tests, git history, or repo instructions. Otherwise report `Lesson: none`. `/trim docs/lessons.md` prunes the file.

12. **Report:**

```
Files modified: <list>
Verification: <commands and results>
Lesson: <line | none>
Next: <remaining blocker or decision | none>
```

## Rules

- Stakes-gated review always runs; task size and requests for speed do not remove it.
- Complete already-authorized commits, pushes, PRs, or deployments after the required checks; do not ask again merely because they persist remotely. An implementation request alone does not authorize release, purchase, data deletion, or infrastructure changes.
- Reversibility is not permission to expand scope. Do not add UI elements, restore a rejected design, or refactor adjacent systems unless the requested outcome requires it. Review findings are evidence to assess, not authorization for new work.
- Honor explicit proposal-only and other stop points. Investigate technical uncertainty yourself; ask for judgment only on an unresolved product decision, material scope expansion, or an external action not yet authorized.
- Give subagents the outcome, exclusions, owned paths, existing authorization, and verification criteria. They inherit the same limits and must report a needed scope change rather than silently widening their task.

## Examples

Clear + normal: `/impl "card backs render larger than fronts"` -> classify -> fix the CSS rule -> run the check -> done.

Ambiguous + normal: `/impl "add card sorting to hand"` -> one batched question (sort by? UI?) -> implement -> verify -> done.

Clear + high stakes: `/impl "fix the JWT expiry check"` -> `Stakes: high` -> fix -> verify -> `adversarial-reviewer` -> resolve findings -> done.
