---
name: impl
description: Execute a repository coding task through o90 clarity, complexity, stakes, delegation, and verification routing. Use when the user explicitly invokes o90 implementation routing; do not auto-trigger for ordinary implementation requests.
---

# o90 implementation routing

Execute the requested repository change end to end. Keep the active runtime
accountable for the result even when work is delegated.

## Mode

Read `.o90/mode`. If it is absent, read the legacy
`.claude/other-ninety-mode`. Treat a missing or invalid value as `default`.

- `cautious`: confirm before ambiguous work and before clear medium or complex work.
- `default`: confirm only when the work is genuinely ambiguous.
- `autonomous`: choose and state a sensible default for ambiguity, then proceed.

Mode never authorizes destructive or irreversible actions and never weakens
high-stakes review.

## Classify

Print these two lines before execution:

```text
Mode: <cautious|default|autonomous>
Clarity: <clear|ambiguous> | Complexity: <simple|medium|complex> | Stakes: <normal|high>
```

- **Clarity** decides whether to ask. Ambiguous means a missing requirement,
  multiple approaches with real tradeoffs, or a multi-cause bug. File count is
  not ambiguity.
- **Complexity** decides how to route. Simple is one bounded file or under about
  50 lines; medium is two or three files with clear ownership; complex is more
  than three files, shared infrastructure, or coupled work.
- **Stakes** decides how hard to review. High stakes include auth, money, data
  integrity, security, privacy, remote persistence, or changes that are hard to
  undo. When unsure, round up.

If the mode requires confirmation, ask all open questions or present the route
in one concise round. Otherwise proceed.

## Execute

1. Inspect repository-local instructions and the actual code path before editing.
2. For medium or complex work, challenge the first obvious approach once. Cut
   unnecessary scope, then commit to a direction.
3. Route using the active runtime's native mechanism:
   - Simple: implement in the active session.
   - Medium: delegate one or two non-overlapping tasks to `fast-impl` when that
     role is available, then use `validator`.
   - Complex: decompose by file ownership and dependency, delegate bounded work
     without concurrent overlap, then use `validator`. Add
     `brutal-code-reviewer` for shared infrastructure or changes spanning more
     than five files.
4. For high-stakes work, use `adversarial-reviewer` after implementation even
   when the change is simple. Resolve blocking findings before completion.
5. If verification produces a real unexplained failure, diagnose it with the
   `systematic-debugging` workflow before attempting another fix. Stop after
   three failed repair cycles and report the evidence.
6. Run the repository's relevant tests, typecheck, lint, build, and behavioral
   check. Do not turn a successful command into a broader behavioral claim.

Do not commit, push, deploy, purchase, or perform another persistent external
action unless the user authorized that action.

Report the files changed, verification evidence, failures or uncertainty, and
the next action that still requires the user.
