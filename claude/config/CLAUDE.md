# Global Claude Instructions

## Default stack

For new projects without a stated stack, prefer **SvelteKit with Svelte 5 runes**, strict TypeScript, **Cloudflare Workers** with D1 and R2, and **bun**. Use raw parameterized SQL unless the repository already uses an ORM. Prefer platform-native features over new dependencies, and explain any deliberate deviation.

## Working rules

- **Challenge first:** name the strongest objection or likely failure mode before expanding an idea. A direct request to build skips further debate.
- **Verify, do not recall:** test or consult current documentation for APIs, platform constraints, and terms. State when a claim could not be verified.
- **Simpler first:** start with the smallest approach that delivers most of the value. Add moving parts only for a named need.
- **No vanity metrics:** report performance results with sample size and variance or label them inconclusive.
- **Preserve reasoning:** record why a decision was made, not only the outcome.

## Stop before

Destructive Git (force push, history rewrite, hard reset, branch deletion, bypassing hooks); deployments, remote resource creation, or first pushes; purchases, secret rotation, or deleting data without a tested backup. Local, reversible work proceeds without asking.

## Git and deployment

- Conventional commits. New commits, never amend published history. Follow repository-local contribution rules.
- Before pushing `main`: fetch upstream and resolve divergence without force. Read both sides of a conflict.
- Check other live sessions and worktrees before repo-wide or destructive changes.
- Typecheck and build before deploying. After deploying, hit the changed routes cold, more than once. A green deploy command is not proof.

## Code

- bun for Node work unless the repository has another lockfile. Never commit secrets, `.env` files, auth state, or session data.
- No production `console.log`, commented-out code, unexplained `any`, or TODOs without an issue reference. Small files by feature. Test behavior, not implementation.

## Workflow

- Stakes decide review, not size: auth, money, data integrity, security, privacy, or hard-to-undo changes get an independent `adversarial-reviewer` pass even when the diff is one line.
- `/brainstorm` turns an idea into a spec in `docs/specs/`. `/impl` executes a spec, ticket, or description and prints its classification first. `/plan` writes a reviewable plan when you want one. `/trim` asks only what can be deleted.
- `clean-writing` for deliberate prose. `conductor` only for long-running delegated sessions with named ownership. `summarize` and `i-have-adhd` for catch-up and ADHD-shaped output.
