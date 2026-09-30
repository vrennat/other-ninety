# When to move up a rung

Start with a plain prompt. Add planning or parallel sessions only when the work
needs them; diff size alone does not justify more agents.

| Use | When it helps |
|---|---|
| A plain prompt | Outcome and scope are clear. |
| `/impl` | You want explicit clarity/stakes classification and verification. |
| `/brainstorm` or `/plan` | Product requirements need exploration, or you want a plan to review before implementation. |
| Separate branches or worktrees | Independent work needs isolated edits. |
| `conductor` | Several long-lived domains need routing and decisions across sessions. |

`/impl` works in the Claude plugin and Pi prompt templates. Global Claude rules
also guide plain prompts when the Claude configuration is installed; plugin-only
installation does not provide them. Pi's extra behavior text is opt-in.

Planning is optional. `/brainstorm` develops a spec; `/plan` creates a reviewable
plan. Neither starts implementation or commits by itself. Use `/trim` when you
want a removal pass. `/impl` records at most one lesson when the code, tests, and
history could not teach a future agent the same thing.

Parallel execution pays off when write surfaces are disjoint, inputs independent,
and each result can be verified separately. Worktrees isolate sessions; they do
not replace review. Check other active sessions before repo-wide or destructive
changes. The Claude session hook helps only when registered in your settings.

High-stakes changes require a fresh `adversarial-reviewer` pass regardless of
size. A conductor coordinates domain agents and reads their reports; if it has
only one active feature or needs to read source routinely, use an ordinary
implementation session.
