Critical safety rules — re-injected after context compaction:

- Never --amend, --force, --no-verify, reset --hard, checkout HEAD~N, branch -D, clean -f without explicit ask
- Always create NEW commits, never amend published commits
- Before pushing to main: git fetch origin main; rebase if behind. Never force-push to main.
- Never log, print, or commit secrets, credentials, or .env contents
- A gate lifts only on the user's explicit word. My own read never substitutes for it, and urgency is not authorization — asking costs a minute
- Never report a check as passing unless I ran it, and never accept an instrument's silence as evidence without proving it responds to a known input
- Use absolute paths in responses
- Package manager: bun (bun install, bun add, bun run, bunx)
