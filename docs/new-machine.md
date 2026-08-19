# New-machine checklist (macOS)

1. Install Git and Python 3.9+, then install the runtime or runtimes you plan to
   select: Claude Code, Codex, Cursor, or Pi. Pi also requires Bun. This repository does not
   install runtimes or credentials. The current Codex CLI installation and
   sign-in flow is documented in the
   [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli).
2. Clone the repository. If you have a private overlay, keep it outside this
   checkout. Choose a component set from the [install matrix](install-matrix.md)
   and use the same arguments for dry-run, apply, and drift checks.
3. Review the dry run:

   ```bash
   ./bootstrap.sh --with claude --with pi --overlay ../my-private-overlay
   ```

   Omit all `--with` flags for the Pi-only default, or replace the example flags
   with the exact combination you want from `--with pi`, `--with claude`, `--with codex`, and
   `--with cursor --cursor-project /existing/project`. Omit `--overlay` when
   you do not have one. Existing Claude and Pi settings files are preserved
   rather than merged; if the plan says `keep`, use a complete overlay
   replacement when you want the o90 defaults too.
4. Apply the same plan:

   ```bash
   ./bootstrap.sh --apply --with claude --with pi --overlay ../my-private-overlay
   ```

5. Restart the selected runtimes and complete their provider login or OAuth
   interactively. If Pi was selected, make sure `o90-pi` is on `PATH` (the
   default target is `~/.local/bin`).
6. Check configuration drift with the same overlay argument:

   ```bash
   ./check-drift.sh --with claude --with pi --overlay ../my-private-overlay
   ```

7. Smoke-check each selected runtime natively. In Claude, run `/mode` and confirm
   the plugin lists the public skills and roles. In Codex, confirm all four o90
   skills and five custom agents are discoverable. In Cursor, confirm the o90
   project rule, four skills, and five agents appear in Customize. The exact
   inventory is in [public catalog parity](catalog-parity.md). If Pi was
   selected, run `o90-pi -- "summarize the repository layout"`; host-to-Pi
   delegation is optional.

Optional broadly useful Claude plugins: `security-guidance` and
`typescript-lsp`. Install them manually only when needed.
