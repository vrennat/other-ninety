---
name: conductor
description: Run a session as a low-context conductor over named, long-lived agents that each hold exclusive authority over one domain (deploy, QA, review, backlog). Use when asked to act as conductor or project manager and delegate rather than implement, when a session must stay alive across many hours of work in several domains, or when work needs an authority structure where an agent can refuse the conductor. Also covers manager mode (fan implementation out to named pi worker sessions on cheap models -- references/pi-workers.md) and loop mode (unattended operation under references/loop-protocol.md). Not for ordinary per-task delegation -- use the repository's normal agent-routing rules.
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

## Spawn brief structure

Six parts, in this order. Use `references/brief-template.md` for the fill-in version.

1. **Exclusive authority, stated as exclusivity.**
2. **An explicit instruction to refuse.**
3. **The authorization channel, named.**
4. **Hard gates, numbered, with the reasoning attached.**
5. **Pre-loaded operating knowledge.**
6. **A reporting contract, plus permission to fail.**

Give each agent a **first task that is recon only, changing nothing**. It builds context and surfaces what is already broken before new work can be blamed for it.

## Authorization gates

**Name the channel before the first irreversible action.** A relayed approval is a claim the agent may not be able to check. Unnamed, it rides alongside verified technical claims and collects their credibility.

**Write the gate so it binds the conductor.** The conductor's authority does not substitute for the principal's word. State this in the brief and escalate rather than override an authorization refusal.

## Follow-up messages

Via the session's agent-message mechanism. The structure that works:

1. Specific praise for the reasoning, not the outcome.
2. Standing decisions restated.
3. The new task, with falsifiable framing explicit.
4. Limits, with reasoning.
5. Explicit permission to fail.

## Failure modes

| Symptom | What went wrong |
|---|---|
| Conductor is reading diffs and running greps | Lost the pattern; it is now an implementer with extra latency |
| Agent defers to the conductor on its own domain | Authority was granted but not stated as exclusive |
| Reports arrive as transcripts | No reporting contract in the brief |
| An inconclusive result was reported as a pass | No permission to fail in the brief |
| Conductor authorized something on its own read | Gate was written to bind agents but not its author |
| Fresh agent spawned for follow-up | Accumulated context was discarded |

## Record what happened outside the session

An in-session review leaves no durable trace. If agent review is the review process, post the review, verdicts, gate lifts, and other future-useful decisions to the project's durable record.
