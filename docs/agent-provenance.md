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

## Review: what identity is actually worth on one account

Provenance is a record. Review is the one place where identity does work, and
it is worth separating the two.

Mixed-up attribution in a comment thread is confusing. A **self-review that
reads as an independent one is a broken quality gate** — it produces confidence
that nothing earned. That is the failure worth designing against, and it is
already visible in the wild: agents write "External review (not self-review)"
into their own review bodies. The instinct is right. The execution is a claim
the agent makes about itself, which is exactly the kind of claim a reader
cannot check.

**Make independence a property of how the reviewer was started, not a sentence
it writes about itself.** Two rules, both free:

- **The reviewer gets the change, not the author's reasoning.** A reviewer
  handed the author's context inherits its blind spots and, more often, its
  conclusions — it reads a rationale it is supposed to be testing and grades
  the rationale instead of the code.
- **Where stakes justify it, the reviewer runs a different model than the
  author.** Same-model review is not worthless, but it is correlated. Spend the
  decorrelation where a miss costs something: auth, money, data integrity,
  privacy, anything hard to undo.

Neither rule needs an account, a bot, or a seat. Both are decisions made at
spawn time.

### Recording it

Nothing new to learn. The review carries the same one-line record, with
`review` or `adversarial` as the role:

```
Agent: claude/review · opus-5
```

An author line and a reviewer line on the same change *are* the decorrelation
record — two models named, or the same model named twice, which tells you what
the review was worth.

One seam worth stating plainly: commits are the substrate for work, and **a
review that approves without changing anything produces no commit.** Then the
line goes wherever the review itself landed — the PR review body, the issue
comment. Same format, different home. Reviews that do change something ride the
fix commit like any other work.

### The honest limit

A fresh context of the same model is not an independent mind. It shares the
training, the priors, and therefore the blind spots. What identity buys on one
account is **decorrelation you can record, not independence you can assume.**

Treat a same-model review as a second look, not a second opinion. Both are
useful. Only one of them is evidence.

### Proving the ritual can fail

A review lane is an instrument, and an instrument that can only report "looks
good" is indistinguishable from one that is not looking.

Before trusting a lane, plant a defect of the class you care about on a scratch
branch, run the ritual against it, and confirm the reviewer catches it. Re-run
that check when you change the reviewer's model or its brief — those are the
edits that quietly turn a reviewer into a rubber stamp. This is the same
positive-control discipline any other check here gets; a review lane does not
earn an exemption for being made of prose.

If no review has ever come back with anything, that is a prompt to run the
planted-defect check. It is not a metric to drive: an agent told that
disagreement is the health signal will produce disagreement.

## Deliberately not built

No hook, no CI check, no registry, no directory service. The record is one
trailer line on work that already produces a commit. If entries start going
missing often enough to matter, that is the moment to add enforcement — not
before.

The review rules above are the same kind of thing: a practice, not a gate.
Nothing blocks a merge, no check fails. An unreviewed change is a change
nobody reviewed, which the log will show as plainly as it shows anything else.
