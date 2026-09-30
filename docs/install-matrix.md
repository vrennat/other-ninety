# Install matrix

Claude and Pi are independent o90 runtimes. With no `--with` flags, bootstrap
defaults to Pi. If any `--with` flag is present, the repeated flags define the
exact component set. Both `bootstrap.sh` and `install.sh` preview without writes
unless `--apply` is present.
The installer handles configuration only; bootstrap also installs dependencies,
Pi packages, and the Claude plugin for the selected runtimes.

| Desired setup | Dry run | Apply |
|---|---|---|
| Pi only | `./bootstrap.sh` | `./bootstrap.sh --apply` |
| Claude only | `./bootstrap.sh --with claude` | `./bootstrap.sh --apply --with claude` |
| Claude + Pi | `./bootstrap.sh --with claude --with pi` | `./bootstrap.sh --apply --with claude --with pi` |
| Private Codex configuration | `./install.sh --with codex --overlay ../my-private-overlay` | Same command with `--apply` |
| Pi with the o90 text (opt-in) | `./bootstrap.sh --with pi --with pi-text` | `./bootstrap.sh --apply --with pi --with pi-text` |

## What each component installs

### Pi

- The portable config under `PI_CODING_AGENT_DIR` (default `~/.pi/agent`):
  agents, extensions, prompts, and themes, all linked to the checkout.
- The o90 `AGENTS.md` and `APPEND_SYSTEM.md`, including overlay replacements,
  link only with `--with pi-text`.
- The Claude plugin's skills (currently `clean-writing`), linked. A
  `pi/skills/` entry with the same name overrides the shared copy; none exist
  today.
- `web-search.json` under the Pi root.
- Locked Bun dependencies and packages from effective Pi settings: the overlay
  replacement, preserved live settings, or public defaults on a fresh install.
  Package installation uses the selected Pi agent directory. Dependencies and
  packages are bootstrap-only.

Pi is installed by default only when no explicit component selection is given.
In an explicit selection, add `--with pi`.

### Claude

- Public-safe global config under `CLAUDE_CONFIG_DIR` (default `~/.claude`): `CLAUDE.md`, `rules`,
  `hooks`, and `agents`, all linked to the checkout.
- Global skills under `claude/config/skills/`, linked unless a real directory already exists at
  that name. A real directory is a private copy and is kept as is; an overlay
  replaces it deliberately.
- The o90 marketplace and plugin at user scope: `/brainstorm`, `/impl`,
  `/plan`, `/trim`, the `adversarial-reviewer` agent, the `clean-writing`
  skill. These marketplace operations are bootstrap-only; configuration-only
  install does not install the plugin. None of the Claude component requires Pi or Bun.
- Hooks are activated by settings, not by linking the hook directory. Existing
  settings remain unchanged; fresh settings enable session discovery, the push
  guard, and focus, but do not register the WebFetch guard.

### Private Codex

`--with codex` requires a private overlay. It manages only `codex/AGENTS.md` and
`codex/other-ninety.config.toml` under `CODEX_HOME` (default `~/.codex`), overridden
by `--codex-dir`. Base `config.toml`, credentials, host trust, plugin/app state,
and runtime data are preserved. No public Codex prompts, agents, or hooks ship.
These two files are linked. Select the named profile with
`codex --profile other-ninety`; installing it does not activate it in the desktop app.

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

Installer and drift use one target plan. Preserved real Claude skill directories
are unmanaged; overlay copies are checked exactly. Public settings allow added
preferences; overlay settings are complete replacements.

Configuration writes are recorded in one rollback manifest. Pi package
installation and the Claude marketplace/plugin operations are intentionally
outside that manifest.

## Ownership and targets

| Path | Public install | Overlay |
|---|---|---|
| Global Claude text, rules, hooks, agents | Linked to checkout | Linked replacement |
| Claude global skills | Linked; an existing real copy is preserved and unmanaged | Whole skill copied and replaced |
| Claude settings and keybindings | Copied only when absent | Complete copied replacement |
| Pi agents, extensions, prompts, themes and skills | Linked | Linked replacement |
| Pi settings and MCP config | Copied only when absent | Complete copied replacement |
| Pi root web-search config | Copied only when absent | Copied replacement from `pi-root/` |
| Pi behavior text | Linked only with `pi-text` | Same opt-in requirement |
| Codex instructions and named profile | No public defaults | Only the two named files are linked |

Overlay directories replace whole paths; they do not merge with public files.
An overlay with only `pi/agents/` replaces the entire agents directory. Other
runtime-created files, including credentials and sessions, are not managed.

`--claude-dir`, `--pi-dir`, and `--codex-dir` override `CLAUDE_CONFIG_DIR`,
`PI_CODING_AGENT_DIR`, and `CODEX_HOME`. `--pi-root` overrides `PI_ROOT_DIR`, whose default is the
selected Pi agent directory's parent. `--state-dir` selects the installer's
backup location; drift does not take that flag. Use the same target overrides
when checking drift. Rollback uses the roots recorded in its manifest.
