# The Other Ninety

> The first 90 percent of the code accounts for the first 90 percent of the development time. The remaining 10 percent of the code accounts for the other 90 percent of the development time.
>
> — Tom Cargill, Bell Labs

Your agent writes the code. **o90** does everything else: planning, delegation, review, verification, and the configuration that keeps those workflows consistent. The name is from the quote above; o90 is the short form.

## One toolkit, two runtimes

| Surface | Purpose | Source |
|---|---|---|
| Claude plugin | Commands, agents, skills, hooks, and project templates | `claude/plugin/` |
| Claude config | Public-safe global rules, hooks, skills, and settings | `claude/config/` |
| Pi | Agents, extensions, prompts, skills, themes, and pinned packages | `pi/` |
| Repository tooling | Bootstrap, rollback, drift, leak, and verification checks | `bootstrap.sh`, `install.sh`, `scripts/` |

The runtimes stay separate where their APIs differ. They share the same operating ideas: clarify only real ambiguity, route by complexity and stakes, keep the main session accountable, and verify before claiming completion.

Claude can explicitly hand a bounded task to Pi with `/pi`. This is never automatic. `/pi <task>` is read-only; `/pi --write <task>` also allows file edits. The Pi process is an ephemeral leaf worker with no shell or nested delegation.

## Quick start

Requirements: macOS, Git, Python 3.9+, Bun, Claude Code, and Pi. Install those tools and authenticate Claude Code first; model-provider and Linear authentication remain interactive. This repository does not install runtimes, credentials, or optional plugins. See the [new-machine checklist](docs/new-machine.md).

```bash
git clone https://github.com/vrennat/other-ninety.git
cd other-ninety

./bootstrap.sh          # preflight and exact config plan; writes nothing
./bootstrap.sh --apply  # dependencies, plugin, and shared config
```

After a successful apply, bootstrap prints concise manual next steps: restart Claude Code and Pi, authenticate providers (Linear OAuth is interactive), and run smoke checks with `/mode` and explicit `/pi`.

The apply command:

1. Installs the locked Bun dependencies under `pi/`.
2. Applies Claude and Pi config with targeted backups and a rollback manifest.
3. Installs the pinned Pi packages.
4. Adds or updates the Claude marketplace and plugin at user scope.

Package and plugin installation is not covered by the config rollback manifest. Provider login, model choice, Linear OAuth, trust decisions, and other credentials remain local and interactive.

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
./bootstrap.sh --overlay ../my-private-overlay
./bootstrap.sh --apply --overlay ../my-private-overlay
```

Overlay files replace the same public path. There is no JSON merge or template engine. Maintain a complete replacement file when the overlay owns a path. Dry-run output and local manifests include overlay source paths.

## Layout

```text
other-ninety/
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
PI_CODING_AGENT_DIR="$tmp/home/.pi/agent" \
OTHER_NINETY_STATE_DIR="$tmp/state" \
./install.sh --apply
```

Use the same variables when launching Pi. Claude Code isolation through a temporary `HOME` should be checked on the installed Claude Code version before relying on it.

## Check drift and private data

```bash
./check-drift.sh --overlay ../my-private-overlay
./check-leaks.sh --patterns-file ../my-private-patterns.txt
```

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
