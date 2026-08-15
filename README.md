# The Other Ninety

> The first 90 percent of the code accounts for the first 90 percent of the development time. The remaining 10 percent of the code accounts for the other 90 percent of the development time.
>
> — Tom Cargill, Bell Labs

An opinionated Claude Code workflow plugin, reusable global Claude configuration, and Pi adapter in one repository.

## What is included

- The `other-ninety` Claude Code plugin: commands, agents, skills, hooks, and project templates.
- `config/claude/`: public-safe global instructions, rules, hooks, skills, and settings examples.
- `adapters/pi/`: Pi extensions, prompts, agents, skills, themes, and package configuration.
- A dry-run-first installer with targeted backups and rollback.
- Read-only drift and leak checks.

Credentials, sessions, OAuth state, trust decisions, caches, machine paths, employer context, and personal project context are intentionally excluded.

## Install the plugin

After the repository is public:

```text
/plugin marketplace add vrennat/other-ninety
/plugin install other-ninety@other-ninety
```

The plugin replaces command names also used by `obra/superpowers`; uninstall that plugin first if it is enabled.

## Install the shared configuration

Requirements: macOS, Python 3, bun, Claude Code, and Pi. `jq` is required only by the optional Claude hook examples.

```bash
git clone https://github.com/vrennat/other-ninety.git
cd other-ninety
(cd adapters/pi && bun install --frozen-lockfile)

./install.sh                 # dry-run; writes nothing
./install.sh --apply         # apply after reviewing the plan
```

The installer prints a rollback manifest after a successful apply. Treat manifests as trusted local restore instructions and use only manifests created by this checkout:

```bash
./install.sh --rollback ~/.local/state/other-ninety/backups/<timestamp>/manifest.json
```

It links stable resources and copies mutable settings that Claude Code or Pi may rewrite. Existing mutable settings are kept unless an overlay explicitly owns them.

## Shadow install

Test without touching live configuration:

```bash
tmp=$(mktemp -d)
HOME="$tmp/home" \
CLAUDE_CONFIG_DIR="$tmp/home/.claude" \
PI_CODING_AGENT_DIR="$tmp/home/.pi/agent" \
OTHER_NINETY_STATE_DIR="$tmp/state" \
./install.sh --apply
```

Use the same variables when launching Pi. Claude Code isolation through a temporary `HOME` should be checked on the installed Claude Code version before relying on it.

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
./install.sh --overlay ../my-private-overlay          # inspect
./install.sh --apply --overlay ../my-private-overlay  # apply
```

Overlay files replace the same public path. There is no JSON merge or template engine. Maintain a complete replacement file when the overlay owns a path. Dry-run output and local manifests include overlay source paths.

## Check drift and private data

```bash
./check-drift.sh --overlay ../my-private-overlay
./check-leaks.sh --patterns-file ../my-private-patterns.txt
```

`check-leaks.sh` proves each scanner rule is active with a positive control, then checks the working tree and Git history. It cannot prove free-form prose is safe or inspect deleted binary blobs in history; public release still requires fresh history and manual review.

## Develop

```bash
git config core.hooksPath .githooks
scripts/verify.sh
```

The repository hook runs plugin lint and the leak scanner before pushes. The verification script also runs installer tests, shell and JSON checks, Pi typechecking, and Pi tests.

## Migration policy

The existing source repositories remain untouched until this repository passes a shadow install, apply/rollback rehearsal, manual privacy review, and normal-use burn-in. Publishing and live cutover are separate explicit steps.

## License

MIT
