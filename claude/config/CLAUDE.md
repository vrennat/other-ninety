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

Use Simplified Technical English (STE) rules where they are compatible with the task. This policy is STE-inspired. It does not claim formal ASD-STE100 conformance.

- Use active voice.
- Keep instructional sentences at 20 words or fewer when practical.
- Keep descriptions at 25 words or fewer when practical.
- Put one instruction in each sentence.
- Put one topic in each paragraph.
- Use explicit subjects, verbs, and articles.
- Use vertical lists for complex information.
- Write each warning with a clear condition and a clear command.
- Preserve exact code, identifiers, commands, paths, quotations, error text, API terms, schema terms, and necessary domain vocabulary.
- Preserve technical accuracy when an STE rule conflicts with the task.
<!-- o90-output-style:end -->

## Workflow

The Other Ninety (o90) provides `/brainstorm`, `/impl`, `/research`, `/trim`, `/debt`, `/plan`, `/tdd`, and the explicit `/pi` leaf-worker bridge. `systematic-debugging` triggers on observed failures and `verification-before-completion` applies before success claims. Use `conductor` only for long-running delegated sessions that need named ownership.
