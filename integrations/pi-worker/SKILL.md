---
name: o90-pi-worker
description: Delegate one bounded task to the optional o90 Pi leaf-worker bridge. Use only when Pi was selected during o90 installation and the user requests Pi delegation or a focused leaf task is separable.
---

# o90 Pi leaf worker

This is an optional cross-runtime enhancement. The host agent remains useful
without it and remains responsible for scope, review, and final verification.

1. State a single bounded task with a concrete return value.
2. Default to read-only: `o90-pi -- "task"`.
3. Use `o90-pi --write -- "task"` only when edits are authorized.
4. Never invoke the bridge from inside a Pi worker.
5. Review the report. In write mode, inspect the diff and verify the change
   yourself. A worker error or empty report is not success.

The bridge disables sessions, context files, extension discovery, skills,
prompt templates, themes, approvals, shell access, and nested delegation. It
loads only the delegated-worker model policy. Direct Pi use remains unrestricted.
