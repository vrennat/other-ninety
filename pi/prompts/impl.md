---
description: Implement authorized work, review by stakes, and verify the result
argument-hint: "<spec, ticket ID, task description, or --dry-run>"
---

Execute this work end-to-end: $ARGUMENTS

## Procedure

1. **Parse Input**
   - If input matches `[A-Z]+-\d+` (e.g. Linear ticket): check for Linear MCP tools (`linear_*` or `mcpScript`). If available, fetch the ticket details. Move it to "In Progress" only after any dry-run or explicit plan-before-code stop point.
   - If input is a file path: read the spec file completely.
   - Otherwise treat as a task description.
   - Note whether `--dry-run` is present; it stops before edits or ticket updates.

2. **Classify Clarity & Stakes**
   - Classify independently:
     - **Clarity**: `clear` (outcome and scope are settled) or `ambiguous` (an unresolved product requirement or materially broader scope needs the user's judgment). Investigate technical choices and multi-cause bugs yourself.
     - **Stakes**: `normal` or `high` (touches auth, payments/money, data integrity, security, privacy, remote persistence, or is hard to undo). When unsure, round up.
   - Print first: `Clarity: clear/ambiguous | Stakes: normal/high`

3. **Set Scope**
   - If `--dry-run` is present: print the planned approach and stop before edits or ticket updates.
   - Name the requested outcome, existing authorization, and explicit exclusions. Include necessary supporting changes and verification; leave unrelated cleanup, UI changes, and refactors out.
   - Proceed on settled requirements. Ask once for a missing product decision or materially broader scope; continue independent work while waiting. Honor explicit proposal-only and plan-before-code stop points; existing approval satisfies them without another pause.

4. **Second Look**
   - Challenge the first approach once: what is the reflex pattern, what can be cut, and is there a simpler path dismissed too quickly? Then commit to a direction.

5. **Implement in This Session**
   - Use `subagent` only for independent parallel work on disjoint write surfaces, isolating noisy exploration, or fresh review. File count alone is not a reason to delegate.

6. **Review by Stakes**
   - If `Stakes: high`: dispatch `adversarial-reviewer` via `subagent` after implementation for an independent break-it pass reading source fresh, whatever the diff size. Resolve blocking findings before claiming done.
   - For a spec or ticket, check fidelity: missing or partial requirements, unrequested behavior, and requirements that look done but are wrong. Cite the source requirement for each finding.

7. **Verify**
   - Run checks appropriate to the change and all checks required by the repository. Exercise the changed behavior and summarize commands, results, and gaps.
   - For a failure, inspect code, logs, and tests and reproduce the symptom before fixing it. State a hypothesis and run a minimal experiment before the next fix. Stop after three failed repair cycles and report the evidence. Remove temporary debug output.
   - Ask for evidence only when unavailable locally. Do not claim completion if verification fails or was skipped without explanation.

8. **Linear Status Update**
   - If a Linear ticket was processed and verification passed, update ticket status to "In Review" via Linear MCP.

9. **Capture One Lesson, or None**
   - Append at most one line to `docs/lessons.md` (create it if absent): `- YYYY-MM-DD <area>: <what would have saved time if known up front>`.
   - It qualifies only if a future agent could not derive it from the code, tests, git history, or repo instructions. If nothing qualifies, write nothing and report `Lesson: none`. `/trim docs/lessons.md` prunes the file.

10. **Report**
```
Files modified: <list of absolute paths>
Verification: <commands and results>
Lesson: <the line appended | none>
Next: <remaining blocker or decision | none>
```

## Rules
- Ask for missing product decisions or materially broader scope, not file count or technical uncertainty. Reversibility does not expand scope. Preserve deliberate design decisions; a reviewer suggestion is not authorization to add a feature or refactor.
- Stakes-gated review always runs; task size and requests for speed do not remove it.
- Parallel subagents require disjoint write surfaces, independent inputs, and independently verifiable results.
- Carry the outcome, exclusions, owned paths, acceptance checks, and existing authorization into every worker brief. Workers report a needed wider surface to the lead instead of expanding it.
- Finish already-authorized commits, pushes, PRs, or deployments after their required checks without asking again. An implementation request alone does not authorize release, purchases, data deletion, or infrastructure changes.
