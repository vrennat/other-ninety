---
name: systematic-debugging
description: Use when Claude observes a real error, test failure, or unexpected runtime output during execution. Forms hypothesis, runs minimal experiment, iterates to root cause before any fix.
---

# Systematic Debugging

Fires when execution produces a real failure: a test error, a stack trace, a non-zero exit code, or output that contradicts the expected behavior. Does NOT fire when the user mentions a bug abstractly without evidence on screen.

## Procedure

1. State observed vs expected in one sentence each.
2. Form 1-3 hypotheses ranked by likelihood.
3. Design the smallest experiment that proves or disproves the top hypothesis (a print, a one-line edit, a focused test).
4. Run the experiment. Capture the output.
5. Update or replace hypotheses based on the result. Repeat from step 3 until root cause is identified.
6. State the root cause and the proposed fix. Hand off to `/impl` or direct implementation.

## Example

```
Observed: `bun run check` reports `TS2339: Property 'roomId' does not exist on type 'GameState'.`
Expected: typecheck passes after the new prop was added.

Hypothesis 1 (likely): roomId was added to ServerState but not propagated to GameState.
Experiment: grep for `interface GameState` to see the actual definition.

Result: GameState extends ClientState, not ServerState. roomId lives on ServerState.

Root cause: prop placement on the wrong type in the layered state hierarchy.
Fix: move roomId to a shared base interface.
```
