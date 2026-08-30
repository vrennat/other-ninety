---
name: surface
description: "Check that this branch's changes stay inside a declared write surface. Reads .o90/surface or the globs given. Read-only; the exit code is the verdict."
argument-hint: "[glob ...]"
---

# /surface

A prose rule about who may write where is a suggestion; checked, it is a control. This runs the check for the current worktree.

## Procedure

1. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/surface_check.py" <globs>`. With no globs, the script reads `.o90/surface` (one glob per line, `#` comments, `!` excludes, later lines win). Pass `--base <branch>` when the base is not the origin default branch.
2. Print the script's `OUTSIDE` lines and closing count verbatim.
3. Exit code 0 means every changed file (committed on this branch, staged, unstaged, or untracked) is inside the surface. 1 means at least one is outside. 2 means no surface or a git error; say which.

## Rules

- Never edit, move, revert, or delete a file to make the check pass, and never widen the globs. An OUTSIDE file is a coordination need for whoever owns that path; report it.
- The surface file itself is never judged by the surface.
