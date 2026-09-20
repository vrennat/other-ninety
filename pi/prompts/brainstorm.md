---
name: brainstorm
description: "Idea -> spec doc. Lean: clarifying questions only when ambiguous, default to recommendation, no per-section approval gates. Output to docs/specs/."
---

# /brainstorm

User input: $ARGUMENTS

Turn an idea into a written spec. Investigate technical questions yourself and recommend the simplest approach. Ask only for product or scope decisions that would materially change the spec; do not pause for "approve this section?" gates.

## Procedure

1. Read the user's idea. Skim project context (recent commits, existing docs in `docs/specs/` and `docs/plans/`, top-level CLAUDE.md).
2. **Check the premise.** Before specifying a solution, establish the problem is real: what evidence says it exists, and what would you expect to see if it did not? Go looking for that disconfirming case in the repo, the data, or existing usage. "I want this" and "already decided" are complete answers; a problem assumed but never confirmed becomes an open question for step 4. Record the answer either way.
3. Check existing decisions and the user's requested scope before raising questions. Resolve technical choices from project evidence. Identify only missing product requirements or scope decisions that need the user's judgment. If none remain, skip to step 5.
4. For each genuinely-ambiguous point, add an entry to `docs/decisions.md` first (create the file from the convention at the top of the o90 `docs/decisions.md` if absent): the next number, lettered options, and your recommendation marked. Then ask all points in ONE batched message by number. Wait for response. Record each answer in place; never renumber or reuse a number.
5. Draft the spec internally:
   - Premise: the step 2 evidence, in a line or two
   - Overview, goals, non-goals
   - Architecture / approach (your recommended path; mention alternatives only if you genuinely think the user might want one)
   - Open questions for implementation (resolved with defaults, not TBDs)
   - Acceptance criteria
6. Write the spec to `docs/specs/YYYY-MM-DD-<slug>-design.md`. Today's date, lowercase-dashed slug.
7. Commit the spec only when the user or the project workflow already authorizes it: `docs: initial design spec for <slug>`.
8. Report the spec path. A brainstorm request alone ends with the spec. If implementation was also explicitly requested, continue within that scope; an explicit proposal-only or plan-before-code request remains a stop point until approved.

## Rules

- "Approve this section?" gates are forbidden. The whole spec is one artifact for review at the end, not five.
- Recommend, don't ask "what do you think?" — make the call, justify it in one sentence.
- "Open questions" must have a default decision next to them, not "TBD".
- A number in `docs/decisions.md` is assigned when the question is raised, not when it is answered. Only choices with more than one defensible answer go there.
- If the spec covers >1 independent subsystem, decompose. Each subsystem gets its own spec.

## Anti-patterns

- Asking the user to pick between two equivalent options. If equivalent, pick one.
- Writing a 500-line spec for a 50-line feature.
- Asking permission to start writing.
- Speccing a fix for a problem nobody has confirmed is happening.
