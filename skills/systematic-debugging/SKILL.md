---
name: systematic-debugging
description: Use when the agent observes a real error, test failure, or unexpected runtime output. Form hypotheses and run minimal experiments until the root cause is established before fixing it.
---

# Systematic debugging

Use this workflow when execution produces a real failure: a test error, stack
trace, non-zero exit code, or output that contradicts the expected behavior.
Do not trigger merely because a user mentions an unobserved bug.

1. State observed and expected behavior in one sentence each.
2. Form one to three hypotheses, ranked by likelihood.
3. Design the smallest experiment that proves or disproves the top hypothesis.
4. Run it and capture the result.
5. Update the hypotheses from evidence and repeat until the root cause is known.
6. State the root cause and proposed fix, then implement only when authorized.

Do not skip from symptom to fix. A failed hypothesis is useful evidence.
