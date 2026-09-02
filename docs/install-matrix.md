# Install matrix

Claude and Pi are independent o90 runtimes. With no `--with` flags, bootstrap
defaults to Pi. If any `--with` flag is present, the repeated flags define the
exact component set. Bootstrap is always a dry run unless `--apply` is present.

| Desired setup | Dry run | Apply |
|---|---|---|
| Pi only | `./bootstrap.sh` | `./bootstrap.sh --apply` |
| Claude only | `./bootstrap.sh --with claude` | `./bootstrap.sh --apply --with claude` |
| Claude + Pi | `./bootstrap.sh --with claude --with pi` | `./bootstrap.sh --apply --with claude --with pi` |
| Pi with the o90 text (opt-in) | `./bootstrap.sh --with pi --with pi-text` | `./bootstrap.sh --apply --with pi --with pi-text` |

## What each component installs

### Pi

- The portable config under `PI_CODING_AGENT_DIR` (default `~/.pi/agent`):
  agents, extensions, prompts, and themes, all linked to the checkout.
- Stock behavior by default. The o90 `AGENTS.md` and `APPEND_SYSTEM.md` link
  only with `--with pi-text`. Three screens on 2026-09-01 and 02 measured that
  text at 1.5x to 1.9x tokens with no task effect (o90-evals experiments 10
  to 12), so it is opt-in until real-task evidence says otherwise.
- The Claude plugin's skills (currently `clean-writing`), linked. A
  `pi/skills/` entry with the same name overrides the shared copy; none exist
  today.
- `web-search.json` under the Pi root.
- Locked Bun dependencies and Pi packages.

Pi is installed by default only when no explicit component selection is given.
In an explicit selection, add `--with pi`.

### Claude

- Public-safe global config under `CLAUDE_CONFIG_DIR`: `CLAUDE.md`, `rules`,
  `hooks`, and `agents`, all linked to the checkout.
- Global skills (`conductor`, `i-have-adhd`, `summarize`,
  `svelte5-best-practices`), linked unless a real directory already exists at
  that name. A real directory is a private copy and is kept as is; an overlay
  replaces it deliberately.
- The o90 marketplace and plugin at user scope: `/brainstorm`, `/impl`,
  `/plan`, `/trim`, the `adversarial-reviewer` agent, the `clean-writing`
  skill, and a Python SessionStart hook. None of it requires Pi or Bun.

## Direct installer and drift checks

`install.sh` accepts the same component and target flags when dependency or
plugin setup is not wanted:

```bash
./install.sh --with claude --with pi
./install.sh --apply --with claude --with pi
```

After applying, check exactly the surfaces you selected, with the same overlay:

```bash
./check-drift.sh --with claude --with pi --overlay ../other-ninety-private
```

Useful target overrides are `--pi-dir`, `--pi-root`, and `--claude-dir`.
Configuration writes are recorded in one rollback manifest. Pi package
installation and the Claude marketplace/plugin operations are intentionally
outside that manifest.
