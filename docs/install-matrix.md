# Install matrix

Claude, Codex, Cursor, and Pi are independent o90 runtimes. With no `--with`
flags, bootstrap defaults to Pi. If any `--with` flag is present, the repeated
flags define the exact component set. Bootstrap is always a dry run unless
`--apply` is present.

Every component installs the same compact writing policy through its native
always-loaded guidance. The policy is independent of Pi and does not select a
model or provider.

| Desired setup | Dry run | Apply |
|---|---|---|
| Pi only | `./bootstrap.sh` | `./bootstrap.sh --apply` |
| Claude only | `./bootstrap.sh --with claude` | `./bootstrap.sh --apply --with claude` |
| Codex only | `./bootstrap.sh --with codex` | `./bootstrap.sh --apply --with codex` |
| Cursor only | `./bootstrap.sh --with cursor --cursor-project ~/code/app` | `./bootstrap.sh --apply --with cursor --cursor-project ~/code/app` |
| Codex + Cursor, no Pi | `./bootstrap.sh --with codex --with cursor --cursor-project ~/code/app` | `./bootstrap.sh --apply --with codex --with cursor --cursor-project ~/code/app` |
| Claude + Pi | `./bootstrap.sh --with claude --with pi` | `./bootstrap.sh --apply --with claude --with pi` |
| Codex + Pi | `./bootstrap.sh --with codex --with pi` | `./bootstrap.sh --apply --with codex --with pi` |
| All runtimes | `./bootstrap.sh --with claude --with codex --with cursor --with pi --cursor-project ~/code/app` | `./bootstrap.sh --apply --with claude --with codex --with cursor --with pi --cursor-project ~/code/app` |

Use `--cursor-project` more than once to configure multiple existing projects.
The installer refuses a Cursor component with no project and refuses a path
that is not an existing directory. This prevents a typo from silently creating
a new project tree.

## What each component installs

### Pi

- The portable config under `PI_CODING_AGENT_DIR` (default `~/.pi/agent`).
- The complete five-skill public catalog, linked from the shared `skills/`
  source. A `pi/skills/` entry with the same name overrides the shared copy;
  none exist today.
- `web-search.json` under the Pi root.
- Locked Bun dependencies and Pi packages.
- `o90-pi` in `OTHER_NINETY_BIN_DIR` (default `~/.local/bin`).

`o90-pi` launches one ephemeral leaf worker. It disables sessions, context
files, extensions, skills, prompt templates, themes, approvals, shell access,
and nested delegation. Read-only tools are the default; `--write` adds only
file edit/write tools. The launcher explicitly loads the delegated-worker model
policy. Direct Pi sessions remain unrestricted and can use any available model.

Pi is installed by default only when no explicit component selection is given.
In an explicit selection, add `--with pi`.

### Claude

- Public-safe global config under `CLAUDE_CONFIG_DIR`.
- The o90 marketplace and plugin at user scope.
- Native o90 commands, agents, and skills. They work without Pi.
- A Python SessionStart hook. Claude-only use does not require Bun.

The plugin includes a `/pi` command, but it is an optional bridge and is useful
only when Pi is also installed.

### Codex

- The `other-ninety@other-ninety` skills plugin from this repository's local
  marketplace. Its five skills are exposed with the `other-ninety:` namespace.
- Global guidance at `$CODEX_HOME/AGENTS.md`.
- All five public o90 roles as native custom-agent TOML under
  `$CODEX_HOME/agents`: `adversarial-reviewer`, `brutal-code-reviewer`,
  `debug-genius`, `fast-impl`, and `validator`.
- The `o90-pi-worker` skill only when both Codex and Pi are selected.

Official OpenAI documentation defines a plugin as a package with a
`.codex-plugin/plugin.json` manifest and optional skills, MCP servers, or hooks;
see [Build plugins](https://developers.openai.com/plugins/build/plugins).
Codex discovers global instructions from `AGENTS.md` in `CODEX_HOME` (normally
`~/.codex`) and personal custom agents from `$CODEX_HOME/agents`; see
[Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
Install and authenticate the Codex CLI separately using the
[official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli).

### Cursor

- `.cursor/rules/o90.mdc` in every selected project.
- All five public o90 skills under `.cursor/skills` in every selected project.
- All five public o90 roles as native agents under `.cursor/agents` in every
  selected project.
- The `o90-pi-worker` skill only when both Cursor and Pi are selected.

Cursor's official documentation defines project rules as version-controlled
`.mdc` files under `.cursor/rules`; global User Rules are managed in Cursor's
Customize UI. o90 therefore installs a project-scoped rule and never mutates
Cursor's application database. See the
[Cursor rules documentation](https://cursor.com/docs/rules).
Cursor's supported skill locations are documented in
[Agent Skills](https://cursor.com/docs/skills), and its project agent format is
documented in [Subagents](https://cursor.com/docs/subagents).

See [public catalog parity](catalog-parity.md) for the item-by-item matrix and
invocation notes. Native Codex and Cursor role definitions inherit the active
session's model instead of selecting a provider or premium model.

## Direct installer and drift checks

`install.sh` accepts the same component and target flags when dependency or
plugin setup is not wanted:

```bash
./install.sh --with codex --with cursor --cursor-project ~/code/app
./install.sh --apply --with codex --with cursor --cursor-project ~/code/app
```

For Codex this is a native companion-config operation, not a complete install:
it manages global instructions and custom agents but does not register or
install the skills plugin. It also leaves any older global skill links in place
unless bootstrap has already verified their plugin replacement. Use
`bootstrap.sh --apply --with codex` for the full setup and migration.

After applying, check exactly the surfaces you selected:

```bash
./check-drift.sh --with codex --with cursor --cursor-project ~/code/app
```

For Codex, drift checks cover the filesystem companion and retired legacy
links. Plugin-manager state is verified by bootstrap; inspect it independently
with `codex plugin list --json` when diagnosing an existing installation.

Useful target overrides are `--pi-dir`, `--pi-root`, `--bin-dir`,
`--claude-dir`, `--codex-dir`, `--agents-dir`, and repeated `--cursor-project`. Configuration
writes are recorded in one rollback manifest. Pi package installation and the
Claude and Codex marketplace/plugin operations are intentionally outside that
manifest.
