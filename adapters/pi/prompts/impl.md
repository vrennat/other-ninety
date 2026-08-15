---
description: Workhorse implementation workflow with classification, routing, subagent delegation, and verification
argument-hint: "<spec, ticket ID, task description, or --dry-run>"
---

Execute this work end-to-end: $ARGUMENTS

## Procedure

1. **Parse Input**
   - If input matches `[A-Z]+-\d+` (e.g. Linear ticket): check for Linear MCP tools (`linear_*` or `mcpScript`). If available, fetch the ticket details and update status to "In Progress".
   - If input is a file path: read the spec file completely.
   - Otherwise treat as a task description.
   - If `--dry-run` is present: print the classification and planned routing, then stop.

2. **Read Mode & Classify**
   - Check `.claude/other-ninety-mode` in the repo or working directory (treat absent as `default`). Modes: `default`, `cautious`, or `autonomous`.
   - Classify independently across three orthogonal axes:
     - **Clarity**: `clear` (one obvious approach) or `ambiguous` (2+ approaches with real tradeoffs, missing requirement, or multi-cause bug).
     - **Complexity**: `simple` (1 file, <50 LOC), `medium` (2-3 files, clear scope), or `complex` (>3 files or shared infrastructure).
     - **Stakes**: `normal` or `high` (touches auth, payments/money, data integrity, security, privacy, remote persistence, or is hard to undo).
   - Print the mode and classification as the top two lines:
     `Mode: <mode>`
     `Clarity: clear/ambiguous | Complexity: simple/medium/complex | Stakes: normal/high`

3. **Branch on Clarity & Mode**
   - `default`: If ambiguous, ask all open questions in ONE batched questionnaire using `ask_user_question` (or a batched numbered list) and wait for user response before proceeding. If clear, proceed silently.
   - `cautious`: Same as default, plus: before executing medium or complex tasks even when clear, print the planned routing and wait for user confirmation.
   - `autonomous`: Never block on clarity. Pick the most sensible default, state the assumption in one line, and proceed. (Stakes-gated reviews and destructive operations still apply).

4. **Second Look (Medium / Complex only)**
   - Before writing code, interrogate the chosen direction in one deliberate pass:
     - What is the generic pattern reached for by reflex?
     - What can be cut, simplified, or tightened?
     - Is there a simpler path dismissed too quickly?
   - Commit to the sharpened direction.

5. **Execute by Complexity**
   - **Simple**: Implement directly in the main session, or delegate a bounded edit to `fast-impl` via `subagent` if it preserves frontier context. Then run verification or dispatch `validator`.
   - **Medium**: Dispatch 1-2 `fast-impl` subagents in parallel using `subagent` (`tasks` array with non-overlapping file ownership). Then dispatch `validator`.
   - **Complex**: Decompose into atomic sub-tasks with file paths and acceptance criteria. Dispatch `fast-impl` subagents sequentially or in non-overlapping parallel batches. Then dispatch `validator`. If the change touches >5 files or shared infrastructure, also dispatch `brutal-code-reviewer`.

6. **High Stakes Verification**
   - If `Stakes: high`: Regardless of complexity tier, dispatch `adversarial-reviewer` via `subagent` after implementation for an independent break-it pass reading source fresh. Resolve all blocking findings before claiming done.

7. **Validator Failure Retry Loop**
   - If `validator` reports failures or unmet requirements:
     1. Dispatch `debug-genius` via `subagent` to diagnose root cause from evidence without editing.
     2. Dispatch `fast-impl` with `debug-genius`'s diagnostic findings to apply the fix.
     3. Re-run `validator`.
     4. Repeat up to 3 cycles maximum before escalating to the user.

8. **Verification Gate**
   - Run the project's verification command (typecheck, test, lint, build) directly or via `validator` and paste the verbatim output.
   - Do not claim completion if verification fails or was skipped without explanation.

9. **Linear Status Update**
   - If a Linear ticket was processed, update ticket status to "In Review" via Linear MCP.

10. **Report**
```
Files modified: <list of absolute paths>
Verdict: <validator / test output>
Next: test locally; commit when ready.
```

## Rules
- Ambiguity is strict: 2+ real-tradeoff approaches, missing requirement, or multi-cause bug. Many files represent complexity, not ambiguity.
- Stakes is orthogonal to complexity: a 1-line auth or payment change is high-stakes and always gets `adversarial-reviewer`.
- Never let parallel subagents edit the same file concurrently.
- Do NOT auto-commit, push, or create pull requests unprompted.
