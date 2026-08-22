# The Other Ninety

**o90** is an opinionated, runtime-native working system for Claude Code,
Codex, Cursor, and Pi. It installs the rules, skills, and specialist agents that
keep planning, delegation, review, and verification consistent without putting
another harness between you and the runtime.

This is a published working system, not a claim that every team should work the
same way. The defaults favor local, reversible action; questions only when a
decision is genuinely open; stronger review when the stakes rise; and evidence
before a completion claim.

## How it changes the work

Every runtime receives native `impl` and `mode` workflows that make four
decisions explicit. Claude Code exposes commands, Pi exposes prompt templates,
and Codex and Cursor expose skills:

| Decision | o90 behavior |
|---|---|
| Clarity | Ask only when requirements are missing or multiple approaches carry real tradeoffs. |
| Complexity | Keep small changes in the active session; route larger work to bounded specialist agents. |
| Stakes | Add an independent adversarial review for auth, money, data integrity, security, privacy, or hard-to-undo changes. |
| Completion | Run the relevant checks and report what passed, what failed, and what remains uncertain. |

The shared catalog contains seven reusable skills and five specialist roles.
Codex and Cursor receive them with the working agreements and compact writing
policy in their native formats. They do not require Pi or a wrapper runtime.

## What ships

| Surface | Purpose | Source |
|---|---|---|
| Pi | Standalone agent runtime: agents, extensions, prompts, skills, themes, and pinned packages | `pi/` |
| Claude plugin | Commands, agents, skills, hooks, and project templates | `claude/plugin/` |
| Claude config | Public-safe global rules, hooks, skills, and settings | `claude/config/` |
| Codex plugin | Namespaced o90 skills installed through Codex's plugin manager | `plugins/other-ninety/` |
| Codex companion | Native global `AGENTS.md` and custom agents | `codex/` |
| Cursor adapter | Native project rule, custom agents, and shared o90 skills | `cursor/`, `skills/` |
| Pi bridge | Optional cross-runtime Pi leaf delegation | `bin/`, `integrations/` |
| Repository tooling | Bootstrap, rollback, drift, leak, and verification checks | `bootstrap.sh`, `install.sh`, `scripts/` |

With no component flags, bootstrap selects Pi. Once any `--with` flag is
present, the flags are the exact component set. Claude, Codex, and Cursor work
independently without Pi, or can be combined with it by adding `--with pi`.

When Pi and a host runtime are selected together, Pi delegation is optional.
Claude exposes `/pi`; Codex and Cursor receive the `o90-pi-worker` skill and
`o90-pi` command. The leaf worker is read-only by default and has no shell or
nested delegation. It uses the cheap-model boundary; direct Pi sessions remain
unrestricted. No native host workflow depends on this bridge.

See the [catalog parity matrix](docs/catalog-parity.md) for the complete skill,
role, and runtime mapping.

## Quick start

Core requirements are macOS, Git, and Python 3.9+. Install only the runtimes you
select; Pi additionally needs Bun. This repository configures runtimes but does
not install their applications, credentials, or optional third-party plugins.
It does install the selected o90 Claude or Codex plugin.

```bash
git clone https://github.com/vrennat/other-ninety.git
cd other-ninety

./bootstrap.sh          # Pi-only preflight and exact config plan; writes nothing
./bootstrap.sh --apply  # Pi-only dependencies and shared config
```

Select another runtime explicitly. Dry-run and apply must use the same
component arguments:

```bash
./bootstrap.sh --with codex --with cursor --cursor-project ~/Developer/app
./bootstrap.sh --apply --with codex --with cursor --cursor-project ~/Developer/app
```

Repeat `--cursor-project` to install the rule into more than one existing
project. The [install matrix](docs/install-matrix.md) lists every supported
combination; the [new-machine checklist](docs/new-machine.md) covers a complete
setup.

After a successful apply, bootstrap prints manual next steps for the selected
runtimes. It suggests an `o90-pi` smoke check only when Pi was selected.

### What apply changes

1. When Codex is selected, adds or verifies the repository marketplace and installs the o90 plugin.
2. Applies each selected runtime's native companion config with targeted backups and a rollback manifest.
3. When Pi is selected, installs its locked Bun dependencies and pinned packages.
4. When Pi and Codex or Cursor are both selected, installs the optional Pi-worker skill.
5. When Claude is selected, adds or updates its marketplace and plugin at user scope.

Package, Claude plugin, and Codex plugin installation is not covered by the
config rollback manifest. Provider login, model choice, Linear OAuth, trust
decisions, and other credentials remain local and interactive. When Pi is
selected, `o90-pi` is linked to `~/.local/bin` by default; set
`OTHER_NINETY_BIN_DIR` or `--bin-dir` when that directory is not on your `PATH`.

Pi uses a strict [delegated-worker model policy](pi/MODEL_POLICY.md). Direct Pi
sessions can use any model. OpenRouter worker routes need an exact allowlist
entry and must remain below the runtime price ceiling.

Every selected runtime receives the same compact writing policy from
`shared/output-style.md`. It leads with outcomes, removes generic framing and
unsupported claims, and preserves technical detail, uncertainty, conditions,
and voice. The `clean-writing` skill adds controlled, technical, and natural
writing modes without loading all three on every task.

## Safe installation and maintenance

Bootstrap is a dry run unless `--apply` is present. Applied config writes use
targeted backups and a manifest rather than replacing an entire runtime
directory.

### Private overlay

Keep personal configuration outside this repository. An overlay mirrors the
destination groups:

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

Overlay files replace the same public path. There is no JSON merge or template
engine. Maintain a complete replacement file when the overlay owns a path.
Dry-run output and local manifests include overlay source paths. Claude and Pi
overlay groups are applied only when their matching component is selected. With
no `--with` flags, the default Pi selection applies Pi overlays.

### Rollback

A successful config apply prints its manifest path. Restore only manifests
created by this checkout:

```bash
./install.sh --rollback ~/.local/state/other-ninety/backups/<timestamp>/manifest.json
```

Rollback restores config paths touched by `install.sh`, including any
checkout-owned legacy Codex skill links retired after a verified plugin install.
It does not uninstall Bun dependencies, Pi packages, or plugins. To remove the
Codex package and its repository marketplace too, run:

```bash
codex plugin remove other-ninety@other-ninety
codex plugin marketplace remove other-ninety
```

Only remove the marketplace when no other local checkout depends on that named
registration. If a managed path was absent during apply, rollback removes that
path; preserve any state the tool wrote there after installation before rolling
back.

### Shadow install

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

Use the same variables when launching Pi. Claude Code isolation through a
temporary `HOME` should be checked on the installed Claude Code version before
relying on it.

### Check drift and private data

```bash
./check-drift.sh --overlay ../my-private-overlay
./check-leaks.sh --patterns-file ../my-private-patterns.txt
```

Pass the same `--with`, `--cursor-project`, and custom target arguments to
`check-drift.sh` that you used for installation.

`check-leaks.sh` proves each scanner rule is active with a positive control,
then checks the working tree and Git history. It cannot prove free-form prose is
safe or inspect deleted binary blobs in history; public releases still require
manual review.

## Install one plugin

### Codex

```bash
codex plugin marketplace add "$PWD"
codex plugin add other-ninety@other-ninety
```

Open a new Codex task after installation. Plugin skills are namespaced, for
example `other-ninety:plan-hunter`. The standalone `install.sh --with codex`
path manages only the global `AGENTS.md` and custom-agent TOML companion files;
use `bootstrap.sh --apply --with codex` for the complete plugin-plus-companion
setup and safe migration from older global skill links.

### Claude Code

```text
/plugin marketplace add vrennat/other-ninety
/plugin install other-ninety@other-ninety
```

The plugin replaces command names also used by `obra/superpowers`; uninstall
that plugin first if it is enabled.

## Repository layout

```text
other-ninety/
├── .agents/plugins/     # Codex repository marketplace
├── bin/                  # cross-harness constrained Pi leaf-worker command
├── codex/                # Codex-native global instructions and custom agents
├── cursor/               # Cursor-native project rule and custom agents
├── integrations/         # optional cross-runtime integrations
├── shared/               # canonical cross-runtime policy
├── plugins/
│   └── other-ninety/     # distributable Codex skills plugin
├── skills -> plugins/other-ninety/skills
│                         # compatibility path for other runtime adapters
├── .claude-plugin/       # marketplace catalog
├── claude/
│   ├── plugin/           # distributable Claude Code plugin
│   └── config/           # shared global Claude configuration
├── pi/                   # complete Pi configuration and extensions
├── scripts/              # installer, checks, and tests
├── bootstrap.sh          # one-go config bootstrap
└── install.sh            # dry-run-first config installer and rollback
```

Each marketplace points at its runtime-specific package: Claude uses
`claude/plugin/`, while Codex uses `plugins/other-ninety/`. The repository root
is not packaged into either plugin.

## Develop

```bash
git config core.hooksPath .githooks
scripts/verify.sh
```

The repository hook runs plugin lint and the leak scanner before pushes. The
verification script also runs installer and bootstrap tests, shell and JSON
checks, Pi typechecking, and Pi tests.

## Release policy

Publishing a release and changing live configuration are separate actions. A
release must pass repository verification, a shadow apply and rollback
rehearsal, and manual privacy review before it is used as a new machine or live
configuration baseline.

## Name

The name comes from Tom Cargill's observation at Bell Labs:

> The first 90 percent of the code accounts for the first 90 percent of the
> development time. The remaining 10 percent of the code accounts for the other
> 90 percent of the development time.

## Acknowledgments

The Pi timer, effort control, MCP health display, session alias, cache telemetry,
and original clean-writing modes were independently adapted from ideas in
Michael Lam's [`mical-pi`](https://github.com/Michaelyklam/mical-pi). Later
clean-writing refinements draw on Michael's clean-writing guidance and Lauren
Tan's [`unslop`](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md)
skill.

## License

MIT
