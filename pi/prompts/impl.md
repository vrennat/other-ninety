---
description: Workhorse implementation workflow with classification, routing, subagent delegation, and verification
argument-hint: "<spec, ticket ID, task description, or --dry-run>"
---

Execute this work end-to-end: $ARGUMENTS

## Procedure

1. **Parse Input**
   - If input matches `[A-Z]+-\d+` (e.g. Linear ticket): check for Linear MCP tools (`linear_*` or `mcpScript`). If available, fetch the ticket details. Move it to "In Progress" only after any dry-run or explicit plan-before-code stop point.
   - If input is a file path: read the spec file completely.
   - Otherwise treat as a task description.
   - Note whether `--dry-run` is present; it stops before edits or ticket updates.

2. **Read Mode & Classify**
   - Read `.o90/mode`, falling back to legacy `.claude/other-ninety-mode` when absent. Treat both absent as `default`. Modes: `default`, `cautious`, or `autonomous`.
   - Classify independently across three orthogonal axes:
     - **Clarity**: `clear` (outcome and scope are settled) or `ambiguous` (an unresolved product requirement or materially broader scope needs the user's judgment). Investigate technical choices and multi-cause bugs yourself.
     - **Complexity**: `simple` (1 file, <50 LOC), `medium` (2-3 files, clear scope), or `complex` (>3 files or shared infrastructure).
     - **Stakes**: `normal` or `high` (touches auth, payments/money, data integrity, security, privacy, remote persistence, or is hard to undo).
   - Print the mode and classification as the top two lines:
     `Mode: <mode>`
     `Clarity: clear/ambiguous | Complexity: simple/medium/complex | Stakes: normal/high`

3. **Set Scope & Apply Mode**
   - If `--dry-run` is present: print the planned routing and stop before edits or ticket updates.
   - Name the requested outcome, existing authorization, and explicit exclusions. Include necessary supporting changes and verification; leave unrelated cleanup, UI changes, and refactors out.
   - `default`: Proceed on settled requirements. Ask once for a missing product decision or materially broader scope; continue independent work while waiting.
   - `cautious`: Present the approach before medium or complex work. Honor an explicitly requested plan-before-code checkpoint; existing approval of that work satisfies it without another pause.
   - `autonomous`: Choose routine implementation defaults and proceed. This mode does not authorize new product decisions, materially broader scope, or external actions by itself.
   - Every mode honors the user's current request and prior authorization, including explicit proposal-only limits. Investigate technical uncertainty yourself.

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

10. **Capture One Lesson, or None**
   - Append at most one line to `docs/lessons.md` (create it if absent): `- YYYY-MM-DD <area>: <what would have saved time if known up front>`.
   - It qualifies only if a future agent could not derive it from the code, tests, git history, or repo instructions. If nothing qualifies, write nothing and report `Lesson: none`. `/trim docs/lessons.md` prunes the file.

11. **Report**
```
Files modified: <list of absolute paths>
Verdict: <validator / test output>
Lesson: <the line appended | none>
Next: <remaining blocker or decision | none>
```

## Rules
- Ask for missing product decisions or materially broader scope, not file count or technical uncertainty. Reversibility does not expand scope. Preserve deliberate design decisions; a reviewer suggestion is not authorization to add a feature or refactor.
- Stakes is orthogonal to complexity: a 1-line auth or payment change is high-stakes and always gets `adversarial-reviewer`.
- Parallel subagents only when all three hold: provably disjoint write surfaces, no step needs another's output, each result verifiable alone. Read-only fan-out (search, audit, review) always qualifies.
- Carry the outcome, exclusions, owned paths, acceptance checks, and existing authorization into every worker brief. Workers report a needed wider surface to the lead instead of expanding it.
- Finish already-authorized commits, pushes, PRs, or deployments after their required checks without asking again. An implementation request alone does not authorize release, purchases, data deletion, or infrastructure changes.
