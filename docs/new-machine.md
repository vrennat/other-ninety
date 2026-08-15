# New-machine checklist (macOS)

1. Install Git, Python 3.9+, Bun, Claude Code, and Pi. Authenticate Claude Code before setup; model-provider login and Linear OAuth can happen afterward. This repository does not install runtimes, credentials, or optional plugins.
2. Clone the repository. If you have a private overlay, keep it outside this checkout and include it in every command below.
3. Review the dry run:

   ```bash
   ./bootstrap.sh --overlay ../my-private-overlay
   ```

   Omit `--overlay` when you do not have one. Existing Claude and Pi settings files are preserved rather than merged; if the plan says `keep`, use a complete overlay replacement when you want the o90 defaults too.
4. Apply the same plan:

   ```bash
   ./bootstrap.sh --apply --overlay ../my-private-overlay
   ```

5. Restart Claude Code and Pi. Complete model-provider login and Linear OAuth interactively.
6. Check configuration drift with the same overlay argument:

   ```bash
   ./check-drift.sh --overlay ../my-private-overlay
   ```

7. Smoke-check both runtimes: run `/mode`, then explicitly run `/pi <small read-only task>`. Confirm the routing context and Pi response.

Optional broadly useful Claude plugins: `security-guidance` and `typescript-lsp`. Install them manually only when needed.
