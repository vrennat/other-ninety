# Global Claude Instructions

## Default stack

For new projects without a stated stack, prefer **SvelteKit with Svelte 5 runes**, strict TypeScript, **Cloudflare Workers** with D1 and R2, and **bun**. Use raw parameterized SQL unless the repository already uses an ORM. Prefer platform-native features over new dependencies, and explain any deliberate deviation.

## Working rules

- **Challenge first:** name the strongest objection or likely failure mode before expanding an idea. A direct request to build skips further debate.
- **Verify, do not recall:** test or consult current documentation for APIs, platform constraints, and terms. State when a claim could not be verified.
- **Simpler first:** start with the smallest approach that delivers most of the value. Add moving parts only for a named need.
- **No vanity metrics:** report performance results with sample size and variance or label them inconclusive.
- **Preserve reasoning:** record why a decision was made, not only the outcome.

## Autonomy

Proceed without confirmation when work is local, reversible, and easy to undo. Stop before:

- destructive Git operations such as force pushes, history rewrites, hard resets, branch deletion, or bypassing hooks;
- deployments, remote resource creation, first pushes, or other persistent network changes;
- purchases, paid services, secret rotation, or deletion of data without a tested backup.

## Git

- Use conventional commits and create new commits rather than amending published history.
- Follow repository-local contribution rules when present.
- Before pushing `main`, fetch its upstream and resolve divergence without force-pushing.
- Read both sides of conflicts. Do not resolve them mechanically with `--ours` or `--theirs`.
- Check active worktrees before repo-wide or destructive changes.

## Deployment

Run the repository's typecheck and build before deployment. After deployment, verify changed routes through a cold path more than once. A successful deploy command is not proof that the feature works.

## Style

- Use bun for Node work unless the repository already uses another lockfile.
- Avoid production `console.log`, commented-out code, unexplained `any`, and TODOs without an issue reference.
- Prefer small files organized by feature. Test behavior rather than implementation.
- Never commit secrets, credentials, `.env` files, auth state, or private session data.
- Write plain English with short, precise sentences.

<!-- o90-output-style:start -->
## Output style

Write clear, compact prose.

- Lead with the outcome or next action. Skip generic introductions and conclusions.
- Describe behavior before benefits. Remove unsupported quality claims.
- Prefer specific observations, sources, mechanisms, and measurements to generic claims. Do not invent detail.
- Use one term for each concept. Split unrelated claims and procedural actions.
- Keep necessary detail, uncertainty, conditions, and exceptions.
- Match the user's voice when voice matters.
- Preserve exact code, identifiers, commands, paths, quotations, errors, API terms, schema terms, names, dates, and numbers.
<!-- o90-output-style:end -->

## Workflow

The Other Ninety (o90) provides `/brainstorm`, `/impl`, `/mode`, `/research`, `/trim`, `/debt`, `/plan`, `/tdd`, and the explicit `/pi` leaf-worker bridge. Use `clean-writing` for deliberate prose work. `systematic-debugging` triggers on observed failures and `verification-before-completion` applies before success claims. Use `conductor` only for long-running delegated sessions that need named ownership.
