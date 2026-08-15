# Agent Instructions

This file is read by non-Claude agents (Cursor, Codex). Claude Code reads `CLAUDE.md`.

## Issue tracking

This project tracks work in **<TICKET-SYSTEM>** (e.g., Linear workspace `<workspace>`, project `<project>`, prefix `<PREFIX>-`).

**Rules:**

- If your task references a `<PREFIX>-XXXX` ticket, work on that ticket. Do not create a new one.
- If you cannot find the ticket, ask. Do not invent a parallel record in another tracker.
- Comment progress on the ticket itself, not in a side tracker.

## Branch & push policy

You are almost certainly **not** the repo owner. Default behavior:

1. Work on a feature branch — never commit directly to `main`.
2. Branch naming: `<your-handle>/<prefix>-<ticket-number>-<short-slug>`.
3. Open a PR against `main` when work is ready. Reference the ticket in the PR body.
4. Do not push to `main` directly. Do not force-push. Do not use `--no-verify`.

The only exception is the repo owner, who may push straight to `main` per their own workflow rules.

## Before you start

1. Confirm you're in the right repo: `git remote get-url origin`. If unexpected, stop and ask.
2. Run `git config user.email`. If missing or set to `*@*.local`, ask the human to set their git identity before committing.
3. Read `CLAUDE.md` for technical/architecture context. The patterns there apply to all agents.

## What "done" looks like

A task is done when:

1. The change is committed on a feature branch with a conventional-commit message.
2. The project's typecheck and lint commands pass locally.
3. A PR is open against `main` with the ticket referenced.
4. The PR body summarizes **what** changed and **how to test**.

Do not claim a task complete before the PR exists. Do not push the branch and stop.
