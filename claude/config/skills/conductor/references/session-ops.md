# Session operations

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
An in-session review leaves no durable trace. If agent review is the review process, post the review, verdicts, gate lifts, and other future-useful decisions to the project's durable record. Choices with more than one defensible answer go in `docs/decisions.md`: numbered when raised, lettered options, an explicit recommendation, resolution recorded in place.
