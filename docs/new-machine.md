# New-machine checklist

1. Install Git and Python 3.9+, plus the runtime you use. Full Pi bootstrap also
   needs Bun. Runtime installation and provider authentication are separate.
2. Clone this repository and any private overlay. Keep the overlay outside the
   public checkout. Choose plugin-only, config-only, or bootstrap from the
   [README](../README.md#choose-an-install); use the [install matrix](install-matrix.md)
   for components and target overrides.
3. Preview your configuration, adding `--overlay` when applicable:

   ```bash
   ./install.sh --with claude --with pi --overlay ../other-ninety-private
   ```

   Review links and replacements. Existing settings are preserved by a public
   install; an overlay replaces them completely. No `--with` flags means Pi.
   Add `--with pi-text` only if you want the extra Pi behavior text.
4. Repeat with `--apply`, or use `bootstrap.sh --apply` with the same arguments
   when dependencies and the Claude plugin should also be installed. Save the
   printed manifest path for configuration rollback.
5. Restart the selected runtimes and authenticate providers interactively.
6. Check drift with the same components, overlay, and target overrides:

   ```bash
   ./check-drift.sh --with claude --with pi --overlay ../other-ninety-private
   ```

   Preserved real Claude skill copies are reported as unmanaged. Plugin-only
   installation has no global configuration to check with this command.
7. In each runtime where `/impl` is installed, run
   `/impl --dry-run "rename a variable"`. Confirm that clarity and stakes print
   and no files or ticket states change. For Claude config, check your settings
   register the hooks you intend to use; linked hook files alone do not activate
   them.
   For private Codex, select `codex --profile other-ninety`; there is no o90 `/impl`
   adapter. Its personal instructions are global, while the profile is opt-in.
