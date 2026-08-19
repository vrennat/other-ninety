---
name: onboarding
description: Use for o90 installation, project onboarding, or migration from obra/superpowers. Safely bootstrap workflow directories for the active runtime.
---

# o90 onboarding

Use this workflow for either machine installation or project onboarding. It is
native to the active runtime and does not require Pi.

## Machine setup

1. Ask which exact runtimes they want: Pi, Claude, Codex, and/or Cursor.
2. Point them to `docs/install-matrix.md` in the o90 checkout.
3. Have them run `./bootstrap.sh` with the matching `--with` flags first. It is
   a dry run. Add `--apply` only after they review the plan.
4. For Cursor, require one or more explicit `--cursor-project` paths.
5. Do not request Pi or Bun when the selected set does not include Pi.

## Project setup

1. Verify the current directory is a Git repository with
   `git rev-parse --git-dir`. Stop and suggest `git init` if it is not.
2. Inspect `docs/specs/`, `docs/plans/`, legacy
   `docs/superpowers/{specs,plans}/`, and the active runtime's project guidance.
3. Create only missing `docs/specs/` and `docs/plans/` directories. This is the
   sole automatic mutation in this workflow.
4. Report what existed and what was created.
5. If legacy paths exist, print reviewed `git mv` commands; do not run them.
6. Suggest project guidance appropriate to the active runtime (`CLAUDE.md`,
   `AGENTS.md`, or `.cursor/rules`) but never overwrite it automatically.

The workflow is idempotent. Preserve user-owned settings, hooks, credentials,
and project instructions.
