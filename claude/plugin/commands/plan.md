---
name: plan
description: Spec -> written implementation plan. Opt-in. Use only when you want to review a plan before executing. Most work skips this and goes straight to /impl.
---

# /plan

Generate an explicit implementation plan from a spec. Output: `docs/plans/YYYY-MM-DD-<slug>.md`.

Use this when you want a written plan you can review before any code is touched. For most work, `/impl` handles planning inline and saves you a round-trip.

## Procedure

1. Read the input spec or freeform description.
2. Map the file structure: which files are created vs modified, and what each is responsible for.
3. Decompose into atomic tasks. Each task = one file or one logical unit (2-5 minutes of work). Each task ends with a commit.
4. For each task, write:
   - Files (create / modify with line ranges)
   - Steps as a checkbox list (`- [ ]`)
   - Complete code blocks for any code change (no placeholders, no "implement similar to task N")
   - The exact commands to run with expected output
5. Self-review: spec coverage (every requirement has a task), placeholder scan, type/name consistency across tasks.
6. Write the plan to `docs/plans/YYYY-MM-DD-<slug>.md`.
7. Commit: `docs: implementation plan for <slug>`.
8. Report path. Do NOT auto-execute.

## Rules

- Every code block is complete as written: real code where a placeholder, "TBD", or "add appropriate error handling" would go.
- Each task carries its own code; repeat it rather than point at another task.
- Each task is self-contained and committable independently.

## When NOT to use

- The work is simple-to-medium and clear: just `/impl` directly, no plan needed.
- The user said "just build it": skip the plan.
