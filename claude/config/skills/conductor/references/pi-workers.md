# Pi worker plane -- invocation contract

Manager-mode workers are pi sessions on inexpensive models. Workers are named, long-lived, resumed rather than respawned, and briefed with a reporting contract and permission to fail.

## Invocation

```sh
cd <worktree> && OTHER_NINETY_PI_LEAF=1 pi -p --mode json \
  --session-id <repository>-<role> \
  --provider <provider> --model <model> --thinking <level> \
  --append-system-prompt <role-brief-file> \
  "<task message>"
```

- Run through the shell; long tasks may run in the background.
- The worker marker activates o90's cheap-model policy. Never set it for a
  direct interactive Pi session.
- Resuming uses the same `--session-id`.
- Read-only roles can exclude edit and write tools.
- The worker's final message is its return value.

## Routing

Choose models by task and risk. Use a different model for review than authorship. Verification and high-stakes work should use the strongest available tier, not the cheapest one.

| Role | Purpose |
|---|---|
| scout | Reconnaissance |
| fast-impl | Bounded implementation |
| validator | Mechanical validation |
| planner | Strong reasoning |
| reviewer | Independent review |
| adversarial | Auth, money, data integrity, security, privacy, or irreversible work |

## What stays with the conductor

Intake and classification, ambiguity resolution, architecture, adjudication of verdicts, and high-stakes review. A worker whose task needs judgment reports and stops; re-route it.

## Roster and health

Do not add named roles without a measured bottleneck. Track defects caught in awaiting-review items. If defects rise, improve worker quality or the review gate; do not ask the principal to review harder.
