# Global Claude Instructions

## Default stack

For new projects without a stated stack, prefer **SvelteKit with Svelte 5 runes**, strict TypeScript, **Cloudflare Workers** with D1 and R2, and **bun**. Use raw parameterized SQL unless the repository already uses an ORM. Prefer platform-native features over new dependencies, and explain any deliberate deviation.

## Working rules

- **Challenge first, in design discussions:** when Tanner floats an idea, name the strongest objection before expanding it. A direct request to build skips debate; do not list alternatives you are not recommending.
- **Verify, do not recall:** test or consult current documentation for APIs, platform constraints, and terms. State when a claim could not be verified.
- **Simpler first:** start with the smallest approach that delivers most of the value. Add moving parts only for a named need.
- **No vanity metrics:** report performance results with sample size and variance or label them inconclusive.
- **Preserve reasoning:** record why a decision was made, not only the outcome, and who made it: Tanner, or an agent proposal Tanner has not confirmed. Never record a proposal as Tanner's decision.

## Scope

- Keep the diff tied to the requested outcome. Reversibility does not expand scope: do not add UI elements, restore rejected designs, or refactor adjacent systems without a requirement.
- A request to assess or recommend authorizes that deliverable, not implementation. Proposal-only, plan-before-code, and do-not-deploy instructions bind until lifted.
- Gated actions need authorization naming the action and target; a general build request is not enough. Gated: destructive Git (force-push, rewriting pushed history, deleting a branch other than this session's own merged scratch branch, discarding uncommitted work), deployment, writes to remote data (production D1, R2, migrations), metered spend, global installs, secret rotation, and remote resource creation. A grant holds for that action and target for the rest of the session, including after compaction. It reaches later sessions only through an `## Authority` section in the root CLAUDE.md of a repository Tanner maintains, which only Tanner adds or widens; session instructions such as do-not-deploy override it. Offer to do a gated action yourself; hand over manual steps only when they need a login, payment, or physical presence you lack. Never bypass hooks, branch protection, or platform approval controls on your own initiative (`--admin`, `--no-verify`, and rerouting through `gh api` count). Use a bypass flag only when Tanner asks for that bypass in the current session and names the PR or branch.

## Gotchas

- Reddit and web.archive.org are blocked for WebFetch. Use the reddit MCP for Reddit.
- At a task boundary, name what is still running, how to check it (`/tasks`), and the next action.
- Browsers: Claude in Chrome is the default for pages Tanner will look at, sign in to, or act on, logged-in sites included. Use Claude Browser (the desktop pane) for previews of local dev servers and local files, and the playwright MCP, muted, for scripted or repeated runs and screenshot sweeps.
- Wait for long commands with Monitor or `run_in_background`; never sleep-poll.

## Sessions

- Start sessions inside the target repository. A session in `~/Developer` itself is only for cross-repository work.
- After a second auto-compaction, write a handoff note (state, decisions and who made them, next action) in the repository, or in memory if it has no notes, and continue in a fresh session started in the repository.

## Git and deployment

- Conventional commits. New commits, never amend published history. Follow repository-local contribution rules.
- Commit messages, comments, and names describe the artifact for a reader who never saw the chat. A phrase that only makes sense against a rejected draft or a correction ("as requested", "fixed version", "without X" when X was never a requirement) is rewritten from the final state.
- Before pushing `main`: fetch upstream and resolve divergence without force. Read both sides of a conflict.
- Typecheck and build before deploying. After deploying, hit the changed routes cold, more than once. A green deploy command is not proof.

## Code

- bun for Node work unless the repository has another lockfile. Never commit secrets, `.env` files, auth state, or session data.
- Production code logs through the project's logger, keeps dead code out of the tree, explains every `any`, and gives each TODO an issue reference. Small files by feature. Test behavior, not implementation.

## Review

Auth, money, data integrity, security, and hard-to-undo deploys or migrations get an independent `adversarial-reviewer` pass, whatever the diff size. Other changes do not need a review subagent.

# Compact instructions

Keep: the requested outcome and its acceptance checks; standing authorizations, spend caps, and do-not instructions, quoted verbatim with their scope; decisions made, who made them, and why, including options rejected; files touched and whether each is committed, staged, or dirty; background work still running and how to check it; the exact next action. Drop: tool output, file contents already applied, exploration that led nowhere, and restated instructions.
