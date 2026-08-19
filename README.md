# The Other Ninety

> The first 90 percent of the code accounts for the first 90 percent of the development time. The remaining 10 percent of the code accounts for the other 90 percent of the development time.
>
> — Tom Cargill, Bell Labs

Your agent writes the code. **o90** does everything else: planning, delegation, review, verification, and the configuration that keeps those workflows consistent. The name is from the quote above; o90 is the short form.

## Independent runtimes, Pi-first default

| Surface | Purpose | Source |
|---|---|---|
| Pi | Standalone agent runtime: agents, extensions, prompts, skills, themes, and pinned packages | `pi/` |
| Claude plugin | Commands, agents, skills, hooks, and project templates | `claude/plugin/` |
| Claude config | Public-safe global rules, hooks, skills, and settings | `claude/config/` |
| Codex adapter | Native global `AGENTS.md`, custom agents, and shared o90 skills | `codex/`, `skills/` |
| Cursor adapter | Native project rule, custom agents, and shared o90 skills | `cursor/`, `skills/` |
| Pi bridge | Optional cross-runtime Pi leaf delegation | `bin/`, `integrations/` |
| Repository tooling | Bootstrap, rollback, drift, leak, and verification checks | `bootstrap.sh`, `install.sh`, `scripts/` |

With no component flags, o90 installs Pi as the convenient default. Once any
`--with` flag is present, the flags are the exact component set: Claude, Codex,
and Cursor work independently without Pi, or can be combined with it by adding
`--with pi`. The runtimes stay separate where their APIs differ and share the
same operating ideas: clarify only real ambiguity, route by complexity and
stakes, keep the active runtime accountable, and verify before claiming
completion.

When Pi and a host runtime are selected together, Pi delegation is an optional
enhancement. Claude exposes `/pi`; Codex and Cursor receive the `o90-pi-worker`
skill and `o90-pi` command. The leaf worker is read-only by default and has no
shell or nested delegation. No native host workflow depends on this bridge.

## Quick start

Core requirements: macOS, Git, and Python 3.9+. Install only the runtimes you
select; Pi additionally needs Bun. This repository configures runtimes but does
not install their applications, credentials, or optional third-party plugins. See
the [install matrix](docs/install-matrix.md) and
[new-machine checklist](docs/new-machine.md).

```bash
git clone https://github.com/vrennat/other-ninety.git
cd other-ninety

./bootstrap.sh          # Pi-only preflight and exact config plan; writes nothing
./bootstrap.sh --apply  # Pi-only dependencies and shared config
```

Explicit components are exact and composable:

| Setup | Bootstrap arguments |
|---|---|
| Pi only | none |
| Claude only | `--with claude` |
| Codex only | `--with codex` |
| Cursor only | `--with cursor --cursor-project /path/to/project` |
| Codex + Pi | `--with codex --with pi` |
| Claude + Codex + Cursor + Pi | `--with claude --with codex --with cursor --with pi --cursor-project /path/to/project` |

Repeat `--cursor-project` to install the rule into more than one existing
project. Dry-run and apply must use the same component arguments:

```bash
./bootstrap.sh --with codex --with cursor --cursor-project ~/Developer/app
./bootstrap.sh --apply --with codex --with cursor --cursor-project ~/Developer/app
```

After a successful apply, bootstrap prints concise manual next steps for the
selected runtimes. It suggests an `o90-pi` smoke check only when Pi was selected.

The apply command:

1. Applies each selected runtime's native config and skills with targeted backups and a rollback manifest.
2. When Pi is selected, installs its locked Bun dependencies and pinned packages.
3. When Pi and Codex or Cursor are both selected, installs the optional Pi-worker skill.
4. When Claude is selected, adds or updates its marketplace and plugin at user scope.

Package and Claude plugin installation is not covered by the config rollback
manifest. Provider login, model choice, Linear OAuth, trust decisions, and
other credentials remain local and interactive. When Pi is selected, the
`o90-pi` command is linked to `~/.local/bin` by default; set
`OTHER_NINETY_BIN_DIR` or `--bin-dir` when that directory is not on your `PATH`.
The complete public skill and role mapping is in the
[catalog parity matrix](docs/catalog-parity.md).

Pi uses a strict [model policy](pi/MODEL_POLICY.md). OpenRouter routes need an
exact allowlist entry and must remain below the runtime price ceiling.

Every selected runtime receives the same canonical, STE-inspired output policy
from `shared/output-style.md`. It favors active voice, short sentences, one
instruction per sentence, clear warnings, and vertical lists. It preserves
technical text exactly when required. This policy does not claim formal
ASD-STE100 conformance.

## Rollback

A successful config apply prints its manifest path. Restore only manifests created by this checkout:

```bash
./install.sh --rollback ~/.local/state/other-ninety/backups/<timestamp>/manifest.json
```

Rollback restores config paths touched by `install.sh`. It does not uninstall Bun dependencies, Pi packages, or the Claude plugin. If a managed path was absent during apply, rollback removes that path; preserve any state the tool wrote there after installation before rolling back.

## Private overlay

Keep private configuration outside this repository. The overlay mirrors destination groups:

```text
my-private-overlay/
├── claude/
│   ├── CLAUDE.md
│   ├── settings.json
│   └── skills/
├── pi/
│   ├── settings.json
│   └── AGENTS.md
└── pi-root/
    └── web-search.json
```

```bash
./bootstrap.sh --with pi --with claude --overlay ../my-private-overlay
./bootstrap.sh --apply --with pi --with claude --overlay ../my-private-overlay
```

Overlay files replace the same public path. There is no JSON merge or template engine. Maintain a complete replacement file when the overlay owns a path. Dry-run output and local manifests include overlay source paths.

Claude and Pi overlay groups are applied only when their matching component is
selected. With no `--with` flags, the default Pi selection applies Pi overlays.

## Layout

```text
other-ninety/
├── bin/                  # cross-harness constrained Pi leaf-worker command
├── codex/                # Codex-native global instructions and custom agents
├── cursor/               # Cursor-native project rule and custom agents
├── integrations/         # optional cross-runtime integrations
├── shared/               # canonical cross-runtime policy
├── skills/               # complete shared public skill catalog
├── .claude-plugin/       # marketplace catalog
├── claude/
│   ├── plugin/           # distributable Claude Code plugin
│   └── config/           # shared global Claude configuration
├── pi/                   # complete Pi configuration and extensions
├── scripts/              # installer, checks, and tests
├── bootstrap.sh          # one-go config bootstrap
└── install.sh            # dry-run-first config installer and rollback
```

The marketplace points at `claude/plugin/`, so the repository can stay coherent without exposing plugin components across the root.

## Install only the Claude plugin

```text
/plugin marketplace add vrennat/other-ninety
/plugin install other-ninety@other-ninety
```

The plugin replaces command names also used by `obra/superpowers`; uninstall that plugin first if it is enabled.

## Shadow install

Test config deployment without touching live paths:

```bash
tmp=$(mktemp -d)
HOME="$tmp/home" \
CLAUDE_CONFIG_DIR="$tmp/home/.claude" \
CODEX_HOME="$tmp/home/.codex" \
OTHER_NINETY_AGENTS_DIR="$tmp/home/.agents" \
PI_CODING_AGENT_DIR="$tmp/home/.pi/agent" \
OTHER_NINETY_BIN_DIR="$tmp/home/.local/bin" \
OTHER_NINETY_STATE_DIR="$tmp/state" \
./install.sh --apply
```

Use the same variables when launching Pi. Claude Code isolation through a temporary `HOME` should be checked on the installed Claude Code version before relying on it.

## Check drift and private data

```bash
./check-drift.sh --overlay ../my-private-overlay
./check-leaks.sh --patterns-file ../my-private-patterns.txt
```

Pass the same `--with`, `--cursor-project`, and custom target arguments to
`check-drift.sh` that you used for installation.

`check-leaks.sh` proves each scanner rule is active with a positive control, then checks the working tree and Git history. It cannot prove free-form prose is safe or inspect deleted binary blobs in history; public releases still require manual review.

## Develop

```bash
git config core.hooksPath .githooks
scripts/verify.sh
```

The repository hook runs plugin lint and the leak scanner before pushes. The verification script also runs installer and bootstrap tests, shell and JSON checks, Pi typechecking, and Pi tests.

## Migration policy

The previous source repositories and live configuration remain untouched until this repository passes shadow apply, rollback rehearsal, manual privacy review, and normal-use burn-in. Publishing and live cutover are separate actions.

## License

MIT
