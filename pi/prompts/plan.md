---
name: plan
description: Spec -> written implementation plan. Opt-in. Use only when you want to review a plan before executing. Most work skips this and goes straight to /impl.
---

# /plan

User input: $ARGUMENTS

Generate an explicit implementation plan from a spec. Output: `docs/plans/YYYY-MM-DD-<slug>.md`.

Use this when you want a written plan you can review before any code is touched. For most work, `/impl` handles planning inline and saves you a round-trip.

## Procedure

1. Read the input spec or freeform description.
2. Map the file structure: which files are created vs modified, and what each is responsible for.
3. Group the work into logical steps, ordered by dependencies.
4. For each task, write:
   - Paths to create or modify and their responsibilities
   - The intended behavior, key decisions and why, and dependencies
   - Acceptance checks and relevant verification commands
5. Self-review for requirement coverage, scope, dependency order, and unresolved decisions.
6. Write the plan to `docs/plans/YYYY-MM-DD-<slug>.md`.
7. Report the path and unresolved decisions. Do not execute or commit unless requested.

## When NOT to use

- The work is simple-to-medium and clear: just `/impl` directly, no plan needed.
- The user said "just build it": skip the plan.
