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
- Destructive Git, deployment, remote resource creation, purchases, global installs, secret rotation, and data deletion need authorization for that specific action and target; a general build request is not enough. Never bypass hooks or platform approval controls.

## Gotchas

- Reddit and web.archive.org are blocked for WebFetch. Use the reddit MCP for Reddit.
- At a task boundary, end with state: outcome, decisions and why, files touched and their git state, what is still running, and the next action.

## Git and deployment

- Conventional commits. New commits, never amend published history. Follow repository-local contribution rules.
- Commit messages, comments, and names describe the artifact for a reader who never saw the chat. A phrase that only makes sense against a rejected draft or a correction ("as requested", "fixed version", "without X" when X was never a requirement) is rewritten from the final state.
- Before pushing `main`: fetch upstream and resolve divergence without force. Read both sides of a conflict.
- Typecheck and build before deploying. After deploying, hit the changed routes cold, more than once. A green deploy command is not proof.

## Code

- bun for Node work unless the repository has another lockfile. Never commit secrets, `.env` files, auth state, or session data.
- Production code logs through the project's logger, keeps dead code out of the tree, explains every `any`, and gives each TODO an issue reference. Small files by feature. Test behavior, not implementation.

## Review

Stakes decide review, not size: auth, money, data integrity, security, privacy, or hard-to-undo changes get an independent `adversarial-reviewer` pass even when the diff is one line.

# Compact instructions

Keep: the requested outcome and its acceptance checks; decisions made and why, including options rejected; files touched and whether each is committed, staged, or dirty; background work still running and how to check it; the exact next action. Drop: tool output, file contents already applied, exploration that led nowhere, and restated instructions.
