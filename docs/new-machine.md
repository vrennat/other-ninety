# New-machine checklist (macOS)

1. Install Git and Python 3.9+, then install the runtime or runtimes you plan to
   select: Claude Code or Pi. Pi also requires Bun. This repository does not
   install runtimes or credentials.
2. Clone the repository. If you have a private overlay, keep it outside this
   checkout. Choose a component set from the [install matrix](install-matrix.md)
   and use the same arguments for dry-run, apply, and drift checks.
3. Review the dry run:

   ```bash
   ./bootstrap.sh --with claude --with pi --overlay ../other-ninety-private
   ```

   Omit all `--with` flags for the Pi-only default. Omit `--overlay` when you
   do not have one. Existing Claude and Pi settings files are preserved rather
   than merged; if the plan says `keep`, use a complete overlay replacement
   when you want the o90 defaults too.
4. Apply the same plan:

   ```bash
   ./bootstrap.sh --apply --with claude --with pi --overlay ../other-ninety-private
   ```

5. Restart the selected runtimes and complete their provider login or OAuth
   interactively.
6. Check configuration drift with the same overlay argument:

   ```bash
   ./check-drift.sh --with claude --with pi --overlay ../other-ninety-private
   ```

7. Smoke-check each selected runtime. In Claude, start a session and confirm
   the `<other-ninety>` block appears in the SessionStart context, then run
   `/impl --dry-run "rename a variable"` and check that `Clarity` and `Stakes`
   print before anything else. In Pi, run `/impl` the same way.

Optional broadly useful Claude plugins: `security-guidance` and
`typescript-lsp`. Install them manually only when needed.
