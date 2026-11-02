---
name: impl
description: Workhorse command. Spec file, ticket ID, or freeform description -> classified, executed, verified work. Asks only for missing product decisions or broader scope. Auto-detects Linear MCP for ticket flows.
---

# /impl

Execute work. Input is one of:

- Path to a spec file: `/impl docs/specs/foo.md`
- Ticket ID: `/impl ABC-1234` (uses Linear MCP when available)
- Freeform: `/impl "make banner sticky on mobile"`
- `--dry-run`: print the classification and the plan, then stop
- `--tdd`: write the failing test first and show it fail before implementing

## Procedure

1. **Parse input.** A `[A-Z]+-\d+` token with any Linear MCP tool available (`*__get_issue`; the name prefix varies by client) is a ticket: fetch it. A path is a spec: read it. Anything else is freeform.

2. **Classify clarity and stakes, and print them first.**
   `Clarity: clear/ambiguous | Stakes: normal/high`
   - Clarity: ambiguous means an unresolved product requirement or a scope decision that would materially change the result. Investigate unknown APIs, competing technical approaches, and multi-cause bugs yourself; those are not reasons to ask the user.
   - Stakes: high if the change touches auth, money, data integrity, security, privacy, or remote persistence, or is hard to undo. When unsure, round up.

3. **`--dry-run`:** print the planned approach and stop before edits or ticket updates.

4. **Set scope.** Identify the requested outcome, existing authorization, and explicit exclusions from the conversation and project decisions. State the intended change briefly and proceed. Include supporting changes needed to deliver and verify it; leave unrelated cleanup and redesign out. If a product decision or materially broader change is required, explain the decision and ask once; continue work that does not depend on the answer.

5. **Ticket:** move it to "In Progress".

6. **Implement in this session.** Delegate for parallel work on disjoint write surfaces, isolating noisy exploration, or independent review. Size alone is not a reason. A spec that splits into three or more independent slices goes through the ticket graph below. With `--tdd`, write the test, run it, show the failure, then implement.

7. **Review.** High stakes: dispatch `adversarial-reviewer` after implementation, whatever the diff size or a request for speed, and resolve blocking findings before claiming done. Changes spanning multiple systems also benefit from a fresh review. When the input was a spec or ticket, review fidelity too: requirements missing or partial, behavior nobody asked for, and requirements that look done but wrong, each with the source line quoted.

8. **Verify.** Run checks appropriate to the change and all checks required by the repository. Exercise the changed behavior and summarize commands, results, and any gaps. State what remains unverified. Stop after three failed repair cycles and report the evidence. Remove temporary debug output before reporting.

   Record a compact verification receipt in the report or a linked artifact: baseline and final commit/tree (identify uncommitted diff and untracked inputs), requested-behavior and preserved-behavior checks separately, and each check's command, cwd, exit status, observed result, and relevant output/artifact. Bind pre-commit verification to the resulting commit and rerun affected checks after later content changes. Scrutinize changed/deleted tests; for high stakes, use proportionate baseline regression checks against final code in an isolated copy when feasible, explaining legitimate incompatibilities. Keep secrets out of evidence. Verdict: PASS only with adequate passing evidence for every decisive check; FAIL for demonstrated defects; INCONCLUSIVE for missing, skipped, stale, or untrustworthy decisive evidence. Known failure takes precedence; optional skips need reasons. FAIL or INCONCLUSIVE cannot claim ready or complete. This receipt records evidence, not an isolation boundary.

9. **Ticket:** move it to "In Review" only when verification is PASS.

10. **Capture one lesson, or none.** Append at most one line to `docs/lessons.md` (create it if absent) as `- YYYY-MM-DD <area>: <what would have saved time if known up front>`, only if a future agent could not derive it from the code, tests, git history, or repo instructions. Otherwise report `Lesson: none`. `/trim docs/lessons.md` prunes the file.

11. **Report:**

```
Files modified: <list>
Verification: <receipt and PASS | FAIL | INCONCLUSIVE>
Lesson: <line | none>
Next: <remaining blocker or decision | none>
```

A ticket-graph run adds `Fan-out: <slices>, peak <n> parallel, conflicts <lane>/<integration>`.

## Ticket graph

Use it when the work splits into three or more slices that each own distinct files and can be verified alone. Fewer slices, or slices that share files, are built in this session.

1. **Draw the graph.** List each slice: what it delivers end to end, its owned paths, its verification command, and the slices that block it. A slice is vertical, a narrow complete path that can be demoed or tested alone; shared prefactoring is its own first slice. Print the graph before dispatching.
2. **Branch.** Create `integration/<slug>` from the base branch and check it out here, so agent worktrees start from it.
3. **Dispatch the frontier.** For each slice whose blockers have all merged, start a background implementer on Sonnet with `isolation: "worktree"`, at most three at once. Its brief points at the spec and names its slice, owned paths, and verification command. It confirms its branch starts from the `integration/<slug>` tip and resets onto it if not. Before reporting done, it merges the current tip into its own branch, resolves any conflict there, and reruns its checks.
4. **Merge each lane.** When an implementer reports, merge its branch into `integration/<slug>` with `--no-ff` and run the repository checks. If the tip moved since the lane's merge and this merge conflicts, resume that implementer with `SendMessage` to merge again rather than resolving it here. Then dispatch whatever the merge unblocked.
5. **Close.** After the last merge, step 7 reviews the whole integration branch once against the spec; fix the findings in one fresh implementer. Step 8 verifies the integration branch. Remove the lane worktrees. Landing `integration/<slug>` on the base branch follows the existing authorization rules.

## Rules

- Complete already-authorized commits, pushes, PRs, or deployments after the required checks; do not ask again merely because they persist remotely. An implementation request alone does not authorize release, purchase, data deletion, or infrastructure changes.
- Reversibility is not permission to expand scope. Do not add UI elements, restore a rejected design, or refactor adjacent systems unless the requested outcome requires it. Review findings are evidence to assess, not authorization for new work.
- Give subagents the outcome, exclusions, owned paths, existing authorization, and verification criteria. They inherit the same limits and must report a needed scope change rather than silently widening their task.

## Examples

Clear + normal: `/impl "card backs render larger than fronts"` -> classify -> fix the CSS rule -> run the check -> done.

Ambiguous + normal: `/impl "add card sorting to hand"` -> one batched question (sort by? UI?) -> implement -> verify -> done.

Clear + high stakes: `/impl "fix the JWT expiry check"` -> `Stakes: high` -> fix -> verify -> `adversarial-reviewer` -> resolve findings -> done.
