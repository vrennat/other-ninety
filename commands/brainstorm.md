---
name: brainstorm
description: Idea -> spec doc. Lean: clarifying questions only when ambiguous, default to recommendation, no per-section approval gates. Output to docs/specs/.
---

# /brainstorm

Turn an idea into a written spec. Lean version: confirm only when there is genuine ambiguity. Default to your strongest recommendation; do not pause for "approve this section?" gates.

## Procedure

1. Read the user's idea. Skim project context (recent commits, existing docs in `docs/specs/` and `docs/plans/`, top-level CLAUDE.md).
2. Identify any **genuinely ambiguous** points: 2+ approaches with real tradeoffs, missing requirements, or scope decisions only the user can make. If none, skip to step 4.
3. Ask all genuinely-ambiguous points in ONE batched message (numbered list). Wait for response. Do not ask one-at-a-time unless the next question depends on the prior answer.
4. Draft the spec internally:
   - Overview, goals, non-goals
   - Architecture / approach (your recommended path; mention alternatives only if you genuinely think the user might want one)
   - Open questions for implementation (resolved with defaults, not TBDs)
   - Acceptance criteria
5. Write the spec to `docs/specs/YYYY-MM-DD-<slug>-design.md`. Today's date, lowercase-dashed slug.
6. Commit it: `docs: initial design spec for <slug>`.
7. Tell the user where it is. Do NOT auto-trigger `/impl` or `/plan`.

## Rules

- "Approve this section?" gates are forbidden. The whole spec is one artifact for review at the end, not five.
- Recommend, don't ask "what do you think?" — make the call, justify it in one sentence.
- "Open questions" must have a default decision next to them, not "TBD".
- If the spec covers >1 independent subsystem, decompose. Each subsystem gets its own spec.

## Anti-patterns

- Asking the user to pick between two equivalent options. If equivalent, pick one.
- Writing a 500-line spec for a 50-line feature.
- Asking permission to start writing.
