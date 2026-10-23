# Global Claude Instructions

## Default stack

For new projects without a stated stack, prefer **SvelteKit with Svelte 5 runes**, strict TypeScript, **Cloudflare Workers** with D1 and R2, and **bun**. Use raw parameterized SQL unless the repository already uses an ORM. Prefer platform-native features over new dependencies, and explain any deliberate deviation.

## Working rules

- **Challenge first:** name the strongest objection or likely failure mode before expanding an idea. A direct request to build skips further debate.
- **Verify, do not recall:** test or consult current documentation for APIs, platform constraints, and terms. State when a claim could not be verified.
- **Simpler first:** start with the smallest approach that delivers most of the value. Add moving parts only for a named need.
- **No vanity metrics:** report performance results with sample size and variance or label them inconclusive.
- **Preserve reasoning:** record why a decision was made, not only the outcome.

## Scope

- Keep the diff tied to the requested outcome. Reversibility does not expand scope: do not add UI elements, restore rejected designs, or refactor adjacent systems without a requirement.
- A request to assess or recommend authorizes that deliverable, not implementation. Proposal-only, plan-before-code, and do-not-deploy instructions bind until lifted.
- Gated actions need authorization naming the action and target; a general build request is not enough. Gated: destructive Git (force-push, rewriting pushed history, deleting a branch other than this session's own merged scratch branch, discarding uncommitted work), deployment, writes to remote data (production D1, R2, migrations), metered spend, global installs, secret rotation, and remote resource creation. A grant holds for that action and target for the rest of the session, including after compaction. It reaches later sessions only through an `## Authority` section in the root CLAUDE.md of a repository Tanner maintains, which only Tanner adds or widens; session instructions such as do-not-deploy override it. Offer to do a gated action yourself; hand over manual steps only when they need a login, payment, or physical presence you lack. Never bypass hooks, branch protection, or platform approval controls (`--admin`, `--no-verify`, and rerouting through `gh api` count).

## Gotchas

- Reddit and web.archive.org are blocked for WebFetch. Use the reddit MCP for Reddit.
- At a task boundary, end with state: outcome, decisions and why, files touched and their git state, what is still running, when you expect it to finish, and how to check it (`/tasks`), and the next action.
- The harness blocks a foreground `sleep`. Wait on background work with Monitor or `run_in_background` and act on the completion notification; do not poll.

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

Keep: the requested outcome and its acceptance checks; standing authorizations, spend caps, and do-not instructions, quoted verbatim with their scope; decisions made and why, including options rejected; files touched and whether each is committed, staged, or dirty; background work still running and how to check it; the exact next action. Drop: tool output, file contents already applied, exploration that led nowhere, and restated instructions.
