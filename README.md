# The Other Ninety

**o90** is a small set of native rules, commands, and one specialist agent for
Claude Code, plus a matching Pi configuration. It adds what the model's own
system prompt cannot know about you, and nothing that it already does.

Two rules carry most of the value:

- **Finish the request within its scope.** Complete necessary supporting work
  and verification without re-asking for existing authorization. Investigate
  technical uncertainty yourself. Ask for missing product decisions or materially
  broader scope; reversibility does not authorize new features or refactors.
- **Stakes decide review, not size.** Auth, money, data integrity, security,
  privacy, or hard-to-undo changes get an independent `adversarial-reviewer`
  pass even when the diff is one line.

Everything else in the repository exists to install those rules safely, keep
them from drifting, and keep private context out of the public copy.

## What ships

| Surface | Contents | Source |
|---|---|---|
| Claude plugin | `/brainstorm`, `/impl`, `/plan`, `/trim`; the `adversarial-reviewer` agent; the `clean-writing` skill | `claude/plugin/` |
| Claude config | Public-safe global `CLAUDE.md`, `rules/`, hooks, the `teammate` agent protocol, and reusable skills (`conductor`, `i-have-adhd`, `wizard`, `summarize`, `svelte5-best-practices`, `retro`, `ponytail`) | `claude/config/` |
| Pi | Agents, extensions, prompt templates, themes, and pinned packages; the o90 behavior text is opt-in (`--with pi-text`) | `pi/` |
| Private Codex config | Overlay-only personal instructions and a portable named profile; no public Codex adapter | `--with codex` |
| Repository tooling | Bootstrap, rollback, drift, leak, and verification checks | `bootstrap.sh`, `install.sh`, `scripts/` |

The Claude plugin and Pi configuration work independently. Plugin-only installs
provide commands, the reviewer, and `clean-writing`; they do not install global
`CLAUDE.md`, rules, hooks, or global skills. Linked hooks run only when your Claude
settings register them. Fresh settings enable session discovery, the push guard,
and focus nudges; the WebFetch guard is available but not enabled there.

Pi installs extensions and packages by default. Only the additional o90 behavior
text is opt-in. See [Pi's README](pi/README.md) for runtime options.

[When to move up a rung](docs/ladder.md) says which workflow to reach for as
work grows from a single prompt to a conductor session. Choices with more than
one defensible answer are numbered in [docs/decisions.md](docs/decisions.md);
D5 to D9 record the 2026-09 strip-back and the evidence behind it.
[Agent provenance](docs/agent-provenance.md) documents the optional attribution
line. [Scope examples](docs/autonomy-scenarios.md) make the completion boundary
reviewable across Claude, Codex plugin migration, and Pi.

## Choose an install

This repository configures applications; it does not install Claude Code, Pi,
or credentials. The scripts require Git and Python 3.9+. Full Pi bootstrap also
requires Bun and Pi; Claude bootstrap requires Claude Code.

```bash
git clone https://github.com/vrennat/other-ninety.git
cd other-ninety
```

Choose the smallest setup you need:

| Setup | Action |
|---|---|
| Claude plugin only | In Claude: `/plugin marketplace add vrennat/other-ninety`, then `/plugin install other-ninety@other-ninety` |
| Configuration only | `./install.sh --with claude --with pi` |
| Configuration plus dependencies and plugins | `./bootstrap.sh --with claude --with pi` |

Both scripts preview without writes. Review the output, then repeat with
`--apply`. Omit a component you do not use. With no `--with` flags, the default
is Pi; otherwise the flags select the exact set. Add `--with pi-text` alongside
`--with pi` only to load the additional o90 behavior text.

The [install matrix](docs/install-matrix.md) explains file ownership and target
overrides. The [new-machine checklist](docs/new-machine.md) covers verification.
Package and plugin operations persist outside the config rollback manifest.

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
selected. Codex is an explicit private-only component:

```bash
./install.sh --with codex --overlay ../my-private-overlay
```

It manages only `codex/AGENTS.md` and `codex/other-ninety.config.toml` under
`CODEX_HOME` (or `--codex-dir`); base configuration, credentials, host trust, and
plugin/app state remain local. Review the plan and repeat with `--apply`.

Installer, bootstrap package selection, and drift checks share the
same target plan. Preserved real Claude skill directories are reported as
unmanaged; overlay-owned copies are compared exactly.

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

## Updating

Pull changes into this checkout, review the install plan, then rerun the same
setup command and component/overlay arguments. Linked files follow the checkout;
preserved settings stay local and overlay settings are copied again on apply.
Restart the selected runtimes after updating.

Plugin caches are separate from checkout links. Use
`/plugin marketplace update other-ninety` and `/plugin update other-ninety@other-ninety`
in Claude, or rerun Claude bootstrap to update both. Package and plugin updates
are outside configuration rollback.

## Repository layout

```text
other-ninety/
├── .claude-plugin/       # marketplace catalog
├── claude/
│   ├── plugin/           # distributable Claude Code plugin
│   └── config/           # shared global Claude configuration
├── pi/                   # Pi defaults, prompts, and extensions
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
