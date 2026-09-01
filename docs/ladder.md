# When to move up a rung

o90 ships one workflow per rung of a ladder. Each rung costs more setup and
more tokens than the one below it, so start low and move up only when the
symptom below appears. Moving back down is fine; most work belongs on the
first two rungs.

| Rung | Use | Outgrown when |
|---|---|---|
| 0 | A plain prompt in the session | You re-explain the same context each request, or the agent changed something you did not ask for. |
| 1 | `/impl` | Two pieces of work in flight touch the same files, or you wait for one to finish before starting the next. |
| 2 | A branch per feature, with `/brainstorm` or `/plan` first | You want two agents running at once. |
| 3 | A worktree per agent | Several domains (deploy, QA, review) each accumulate hours of context. |
| 4 | `conductor` | Only if the symptom in rung 3 persists. Most projects never need this. |

## Rung 0: a plain prompt

Works while the whole change fits in your head. The SessionStart hook already
applies the clarity and stakes rules here, so a small fix gets asked about only
when it is genuinely ambiguous and reviewed independently when it is dangerous.

## Rung 1: `/impl`

Adds three things: the classification is printed before any edit, high-stakes
work gets an `adversarial-reviewer` pass whatever its size, and "done" requires
verification output. Use it for anything you would describe as a feature or a
fix rather than a tweak. `/trim` before merging and the lesson step at the end
of `/impl` keep the codebase from quietly degrading while it still works.

## Rung 2: a branch per feature, planned first

Stop working on `main` once a broken build costs you more than a minute. Use
`/brainstorm` when you cannot state the feature in two sentences; it writes a
spec you can hand to `/impl`. Use `/plan` only when you want to read the plan
before execution. Both are opt-in, not gates.

## Rung 3: a worktree per agent

A worktree is a second checkout of the same repository on its own branch. Give
each agent one, so parallel agents cannot edit the same working copy. Rules
that keep this cheap:

- One agent, one worktree, one branch. Never share.
- Agents edit their worktree copy, not the main checkout.
- Merge back through the project's normal review path. A worktree is not a
  review.
- Run two agents at once only when all three hold: provably disjoint write
  surfaces, no step needs another's output, and each result is verifiable
  alone. Read-only fan-out (search, audit, review) always qualifies.
- The SessionStart hook lists other live sessions in the same repository;
  read it before repo-wide or destructive changes.

## Rung 4: `conductor`

A low-context session that owns routing and decisions while named, long-lived
agents own domains (deploy, QA, review). You make product decisions and read
reports; the conductor never reads diffs. Its cost is measured in orchestrator
context, not files touched, and it only pays off when several domains are
active for hours. Signs you moved up too early: the conductor is reading
source, or only one feature is in flight.

## At every rung

- `/trim` before merging: what can be removed?
- `docs/lessons.md` after `/impl`: one line on what would have saved time if
  known up front, only when the code and history could not have told a future
  agent the same thing.
