---
name: conductor
description: Run a session as a low-context conductor over named, long-lived agents that each hold exclusive authority over one domain (deploy, QA, review, backlog), including manager mode (pi worker seats on cheap models) and loop mode (unattended). Use when asked to act as conductor or project manager, or when a session must stay alive across hours of work in several domains. Ordinary per-task delegation routes through rules/agents.md.
---

# Conductor

A session shape, not a task. The top-level agent acts purely as a project manager -- no file reads, no file writes, no direct verification -- and delegates to a small number of named, long-lived agents with non-overlapping exclusive authority.

The value is not parallelism. It is that **an agent which owns an authority can refuse to use it**, including refusing the conductor. An agent that shares authority defers; an agent that owns it argues.

## When to use it

- The human says some variant of "you are the conductor, delegate, preserve your own context."
- Work spans several domains that each accumulate expensive context (deploy state, test baselines, review history, backlog state) over hours.
- Something irreversible is in scope and you want a gate that a motivated conductor cannot quietly talk itself past.

Not for ordinary multi-file implementation, single-domain work, or anything finishable in one sitting by one agent.

## Modes

- **Session conductor:** the attended pattern. Workers are long-lived subagents and cadence is driven by user messages.
- **Manager mode:** workers are named, resumable pi sessions on inexpensive models. The same briefs, reporting contract, and refusal license apply. Read `references/pi-workers.md` for the invocation contract and role-to-model routing.
- **Loop mode:** either pattern running unattended between user appearances. Read `references/loop-protocol.md` before the first unattended wake. It defines the authorization envelope, queue, and wake discipline.

The doctrine in this file -- exclusive authority, refusal, reporting contracts, resume-never-respawn -- applies to all modes.

## The conductor's job

Routing, synthesis, and adjudication of what agents report. Refuse to accept clean-sounding answers:

- **Do not read source to be sure.** A conductor reading full diffs is the pattern degrading back into implementation.
- **Do not verify directly.** Send claims to the agent that owns the verdict, framed as falsifiable.
- **Do not accept a report you would not accept from a stranger.** Ask what would have shown the opposite.
- **Resume, never respawn.** Resume the named agent to preserve accumulated context.
- **Run the conductor at xhigh, not max.** Every standing agent inherits the conductor's effort level; max across twenty agents was the most expensive setting of the week it was measured.
- **Isolate builders, not reviewers.** Worktree isolation is for agents with a write surface. Reviewers and verifiers read the shared checkout; isolated read-only agents spent dozens of turns failing to reach paths outside their worktree.
- **Keep standing agents small.** A wake re-sends the whole context; agents that idle at 250k+ context are the cost, not the wakes. Batch messages to one agent and prefer a fresh one-shot agent over a standing one when nothing is accumulated.
- **Keep the principal informed without requiring them to understand or investigate the codebase.** Every report upward is a decision to make or a state to know, never a pointer to go look. If the principal has to open a file to understand what happened, the synthesis was not done.

## Read next, when

- **Writing or revising a spawn brief:** `references/brief-template.md` for the six-part structure and the fill-in version.
- **Relaying an approval, lifting a gate, or closing a reviewer's finding:** `references/authorization.md`. The gates bind the conductor too.
- **Sending a follow-up to a standing agent, or a report looks wrong:** `references/session-ops.md` for the follow-up structure, the failure-mode table, and what has to be recorded outside the session.
- **Manager mode:** `references/pi-workers.md`. **Loop mode:** `references/loop-protocol.md` before the first unattended wake.
