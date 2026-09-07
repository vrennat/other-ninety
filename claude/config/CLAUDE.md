# Global Claude Instructions

## Default stack

For new projects without a stated stack, prefer **SvelteKit with Svelte 5 runes**, strict TypeScript, **Cloudflare Workers** with D1 and R2, and **bun**. Use raw parameterized SQL unless the repository already uses an ORM. Prefer platform-native features over new dependencies, and explain any deliberate deviation.

## Working rules

- **Challenge first:** name the strongest objection or likely failure mode before expanding an idea. A direct request to build skips further debate.
- **Verify, do not recall:** test or consult current documentation for APIs, platform constraints, and terms. State when a claim could not be verified.
- **Simpler first:** start with the smallest approach that delivers most of the value. Add moving parts only for a named need.
- **No vanity metrics:** report performance results with sample size and variance or label them inconclusive.
- **Preserve reasoning:** record why a decision was made, not only the outcome.

## Autonomy and scope

- Finish the requested outcome, including necessary supporting changes, verification, and repairs caused by your changes. Existing authorization carries across turns; do not ask whether to start or continue work already requested.
- Keep the diff tied to that outcome. Reversibility does not expand scope. Preserve unrelated behavior and deliberate design decisions; do not add UI elements, restore rejected designs, or refactor adjacent systems without a requirement. A small API change needed by a requested page is supporting work; redesigning the backend is a separate proposal.
- Investigate technical uncertainty with code, history, documentation, and tests. Ask only when a missing product decision or a materially broader change requires the user's judgment. Continue independent work while that decision is pending.
- Respect explicit proposal-only, plan-before-code, and do-not-deploy instructions. A request to assess or recommend authorizes that deliverable, not implementation; later explicit approval authorizes the approved scope.
- For destructive Git, deployment, remote resource creation, purchases, global installs, secret rotation, or data deletion, check whether the specific action and target are already authorized. Proceed when they are and required checks pass; otherwise prepare the reviewable result before asking. A general build request alone does not authorize those actions. Never bypass hooks or platform approval controls.
## Long-running work and agents

- **Bash timeout is a backstop, not a budget.** Anything likely to exceed 60 seconds (builds, renders, test suites, downloads, servers) starts with `run_in_background` and is checked with Monitor. Waiting happens there, with the per-call timeout left at its default.
- **Compact early.** On 1M-context models, `/compact` around 250k tokens; do not run to the window edge. Every call re-reads the whole context.
- **Long-lived agents stay small.** A wake re-sends the agent's entire context, so brief standing agents narrowly and batch messages to them. Reviewers and other read-only agents are spawned without worktree isolation.
- **Reddit and web.archive.org are blocked for WebFetch.** Use the reddit MCP for Reddit.
- **End the turn after launching background work.** Say what is running and what will signal completion; do not poll with TaskOutput or sleep. The focus hook and the app notify the user when a session goes idle.
- **Close a task with state, not a summary.** At a task boundary end with: outcome, decisions and why, files touched and their git state, what is still running, and the next action. That is what compaction keeps and what a fresh session needs, so the user can `/compact` or start clean.


## Git and deployment

- Conventional commits. New commits, never amend published history. Follow repository-local contribution rules.
- Before pushing `main`: fetch upstream and resolve divergence without force. Read both sides of a conflict.
- Check other live sessions and worktrees before repo-wide or destructive changes.
- Typecheck and build before deploying. After deploying, hit the changed routes cold, more than once. A green deploy command is not proof.

## Code

- bun for Node work unless the repository has another lockfile. Never commit secrets, `.env` files, auth state, or session data.
- Production code logs through the project's logger, keeps dead code out of the tree, explains every `any`, and gives each TODO an issue reference. Small files by feature. Test behavior, not implementation.

## Workflow

- Stakes decide review, not size: auth, money, data integrity, security, privacy, or hard-to-undo changes get an independent `adversarial-reviewer` pass even when the diff is one line.
- `/brainstorm` turns an idea into a spec in `docs/specs/`. `/impl` executes a spec, ticket, or description and prints its classification first. `/plan` writes a reviewable plan when you want one. `/trim` asks only what can be deleted.
- `clean-writing` for deliberate prose. `conductor` only for long-running delegated sessions with named ownership. `i-have-adhd` for ADHD-shaped output. User-invoked only: `/summarize` for catch-up, `/svelte5-best-practices` before SvelteKit work, `/retro` to review the agent's environment after a session, `/wizard` to script steps only a human can do.

# Compact instructions

Keep: the requested outcome and its acceptance checks; decisions made and why, including options rejected; files touched and whether each is committed, staged, or dirty; background work still running and how to check it; the exact next action. Drop: tool output, file contents already applied, exploration that led nowhere, and restated instructions.
