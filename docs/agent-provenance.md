# Agent provenance

A one-line convention for recording which harness and model produced a piece of
work, when every agent runs under the same human's credentials.

## The problem it solves

Agents commit as you, open pull requests as you, and comment as you. Once the
session ends, nothing distinguishes work produced by a cheap local worker from
work produced by a frontier model — the git history, the PR list, and the issue
tracker all show one name.

That is tolerable until you start changing things. Swap a harness, move a role
to a different model, try a new routing table, and the question "did that
actually help?" has no data behind it. The work is all there; the attribution
is not.

This is a **record, not a gate**. Nothing blocks on it, no check enforces it,
and a missing entry is a gap rather than a failure.

## The trailer

Add one trailer to commits an agent produces, alongside `Co-Authored-By`:

```
Agent: <engine>/<role> · <model>
```

Examples:

```
Agent: claude/impl · opus-5
Agent: pi/fast-impl · laguna-s-2.1
Agent: codex/review · gpt-5.6
```

- `engine` — the harness that ran. `claude`, `pi`, `codex`, or whatever you add.
- `role` — what the agent was doing: `impl`, `review`, `scout`, `planner`,
  `validator`, `adversarial`, `debug`. Required where a worker is spawned
  per-role and therefore pinned to one; optional where a single long-lived
  session shifts between roles as the conversation moves, because a
  self-reported role drifts and a drifting field is worse than an absent one.
- `model` — the model that generated the content.

Commits are the substrate on purpose. Every harness already produces them, they
need no issue tracker or forge API, and `git log` outlives whatever tool you are
evaluating this month.

## Record the producer, not the process that committed

This is the only part worth being strict about.

When one agent relays another's work — an orchestrator committing on behalf of a
worker it spawned — the trailer names the **worker**, then appends the relay:

```
Agent: pi/fast-impl · laguna-s-2.1 · via claude/opus-5
```

Get this backwards and cheap-tier output is recorded as frontier-model output.
Every comparison you later draw from the log is then inverted, and it is
inverted in the flattering direction: the tier you were testing looks exactly as
good as the tier that merely relayed it. A log that is silently wrong is worse
than no log, because you will act on it.

## Reading it back

Tally what each engine and model actually produced:

```sh
git log --format='%(trailers:key=Agent,valueonly)' | sort | uniq -c | sort -rn
```

Scope it to one experiment with `--since` / `--until`, or to one area with
`-- <path>`:

```sh
git log --since=2026-08-01 --format='%(trailers:key=Agent,valueonly)' \
  | sort | uniq -c | sort -rn
```

Verified on git 2.54.0. `%(trailers:...)` needs a reasonably current git; on
older versions, `git log --format=%B | grep '^Agent: '` gets the same data.

## Addressing: a separate problem the trailer does not fix

Provenance says who *wrote* something. It says nothing about who a message is
*for*, and that is its own failure — one seen in practice, where an agent
thanked the human account for work a different agent had done, because the
human's handle was the only handle available to address.

Two rules:

- **Your own handle means you, the human.** Never use it to address an agent.
- **Address durable agent identities directly** — a bot account or app user that
  persists. Refer to session-scoped agents positionally instead ("the reviewing
  agent above", "the agent that filed this"); never at-mention one, since it
  stops existing when its session ends and the reference dangles.

## Agent-to-agent notes go somewhere no agent auto-loads

If one agent leaves a note for another, put it in a path nothing reads as
instructions — `.claude/notes/<date>-<engine>.md` or similar. Never in
`CLAUDE.md`, `AGENTS.md`, or any file a harness loads as standing context.

The failure is quiet and specific: a note written into a shared instruction file
is not read by the next agent as "a peer said this." It is read as "the user
requires this." Watch for repos where `AGENTS.md` is a symlink to `CLAUDE.md` —
two engines then share one instruction channel.

## Deliberately not built

No hook, no CI check, no registry, no directory service. The record is one
trailer line on work that already produces a commit. If entries start going
missing often enough to matter, that is the moment to add enforcement — not
before.
