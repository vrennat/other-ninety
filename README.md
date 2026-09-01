# The Other Ninety

**o90** is a small set of native rules, commands, and one specialist agent for
Claude Code, plus a matching Pi configuration. It adds what the model's own
system prompt cannot know about you, and nothing that it already does.

Two rules carry most of the value:

- **Ask only when it matters.** A question is worth asking when two readings of
  the request would produce materially different work: a missing requirement,
  competing approaches with real tradeoffs, or a multi-cause bug. File count is
  not ambiguity.
- **Stakes decide review, not size.** Auth, money, data integrity, security,
  privacy, or hard-to-undo changes get an independent `adversarial-reviewer`
  pass even when the diff is one line.

Everything else in the repository exists to install those rules safely, keep
them from drifting, and keep private context out of the public copy.

## What ships

| Surface | Contents | Source |
|---|---|---|
| Claude plugin | `/brainstorm`, `/impl`, `/plan`, `/trim`; the `adversarial-reviewer` agent; the `clean-writing` skill; a SessionStart hook that injects the two rules | `claude/plugin/` |
| Claude config | Public-safe global `CLAUDE.md`, `rules/`, hooks, the `teammate` agent protocol, and reusable skills (`conductor`, `i-have-adhd`, `summarize`, `svelte5-best-practices`) | `claude/config/` |
| Pi | Agents, extensions, prompt templates, themes, and pinned packages | `pi/` |
| Repository tooling | Bootstrap, rollback, drift, leak, and verification checks | `bootstrap.sh`, `install.sh`, `scripts/` |

The Claude plugin works without Pi. Pi works without the plugin. The two hooks
under `claude/config/hooks/` are the only always-running pieces: one lists
other live Claude sessions in the same repository at session start, the other
blocks a non-fast-forward or forced push to `main` from inside Claude.

[When to move up a rung](docs/ladder.md) says which workflow to reach for as
work grows from a single prompt to a conductor session. Choices with more than
one defensible answer are numbered in [docs/decisions.md](docs/decisions.md);
D5 to D9 record the 2026-09 strip-back and the evidence behind it.
[Agent provenance](docs/agent-provenance.md) documents the optional attribution
line.

## Quick start

Core requirements are macOS, Git, and Python 3.9+. Pi additionally needs Bun.
This repository configures runtimes but does not install their applications or
credentials. It does install the Claude plugin when Claude is selected.

```bash
git clone https://github.com/vrennat/other-ninety.git
cd other-ninety

./bootstrap.sh --with claude          # dry run; writes nothing
./bootstrap.sh --apply --with claude  # links config, installs the plugin
```

With no `--with` flags, bootstrap selects Pi. Once any `--with` flag is present,
the flags are the exact component set. The [install matrix](docs/install-matrix.md)
lists the combinations; the [new-machine checklist](docs/new-machine.md) covers
a complete setup.

### What apply changes

1. Links `CLAUDE.md`, `rules`, `hooks`, and `agents` into `~/.claude` (or
   `CLAUDE_CONFIG_DIR`), with targeted backups and a rollback manifest.
2. Links each global skill unless a real directory already exists at that name.
   A real directory is a private copy and is kept.
3. Copies `settings.json` and `keybindings.json` only when absent.
4. When Pi is selected, links the Pi config and installs its locked
   dependencies and pinned packages.
5. When Claude is selected, adds or updates the marketplace and plugin at user
   scope.

Plugin and package installation is not covered by the config rollback
manifest. Provider login, model choice, and trust decisions stay local and
interactive.

## Private overlay

Keep personal configuration outside this repository. An overlay mirrors the
destination groups and replaces the same public path:

```text
my-private-overlay/
├── claude/
│   ├── CLAUDE.md
│   ├── settings.json
│   └── skills/
│       └── conductor/
└── pi/
    ├── agents/
    └── settings.json
```

```bash
./bootstrap.sh --apply --with claude --with pi --overlay ../my-private-overlay
```

There is no JSON merge or template engine. Maintain a complete replacement when
the overlay owns a path. Overlay groups apply only when their component is
selected.

## Rollback, drift, and leaks

A successful apply prints its manifest path. Restore only manifests created by
this checkout:

```bash
./install.sh --rollback ~/.local/state/other-ninety/backups/<timestamp>/manifest.json
```

Check drift and private data with the same component and overlay arguments you
installed with:

```bash
./check-drift.sh --with claude --with pi --overlay ../my-private-overlay
./check-leaks.sh --patterns-file ../my-private-patterns.txt
```

`check-leaks.sh` proves each scanner rule is active with a positive control,
then checks the working tree and Git history. It cannot prove free-form prose
is safe; public releases still require manual review.

## Install the plugin alone

```text
/plugin marketplace add vrennat/other-ninety
/plugin install other-ninety@other-ninety
```

Plugin caches refresh only on `/plugin marketplace update other-ninety` or a
version bump; editing this checkout does not reach running sessions by itself.

## Repository layout

```text
other-ninety/
├── .claude-plugin/       # marketplace catalog
├── claude/
│   ├── plugin/           # distributable Claude Code plugin
│   └── config/           # shared global Claude configuration
├── pi/                   # complete Pi configuration and extensions
├── shared/               # Pi's compact-writing policy
├── docs/                 # ladder, decisions, install notes, archive
├── scripts/              # installer, checks, and tests
├── bootstrap.sh          # single-command config bootstrap
└── install.sh            # dry-run-first config installer and rollback
```

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
