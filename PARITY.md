# Safe-parity checklist

Parity means the public toolkit preserves reusable behavior from the two source repositories. It does not mean preserving private settings or byte-identical Claude/Pi prompts.

## Claude plugin

- [ ] Manifests parse and agree on name `other-ninety` and version `0.2.0`.
- [ ] Commands load: `bootstrap`, `brainstorm`, `debt`, `impl`, `mode`, `pi`, `plan`, `research`, `tdd`, `trim`.
- [ ] Agents load: `adversarial-reviewer`, `brutal-code-reviewer`, `debug-genius`, `fast-impl`, `validator`.
- [ ] Skills load: `onboarding`, `plan-hunter`, `systematic-debugging`, `verification-before-completion`.
- [ ] SessionStart emits valid JSON and injects the `other-ninety` routing context.
- [ ] `/mode` writes `.claude/other-ninety-mode`.
- [ ] `/debt` recognizes current `o90:` plus legacy `on:` and `dD:` markers.
- [ ] `/bootstrap` resolves the `other-ninety/other-ninety` plugin cache path.
- [ ] `/pi` launches one ephemeral leaf worker, defaults to read-only tools, and requires explicit `--write` for edits.

## Global Claude configuration

- [ ] Public `CLAUDE.md`, rules, hooks, agents, and post-compact rules install without private context.
- [ ] Existing `settings.json`, `keybindings.json`, and skills are not overwritten by a base install.
- [ ] An explicit overlay can replace mutable settings with rollback coverage.
- [ ] Reusable global skills include conductor, design context, ADHD output mode, PR/review, researcher, skill creator, Svelte guidance, ticketing, and typecheck.

## Pi adapter

- [ ] Pi loads `AGENTS.md` and `APPEND_SYSTEM.md` from an isolated `PI_CODING_AGENT_DIR`.
- [ ] Eight routed agents are available.
- [ ] Prompt templates load: `brainstorm`, `debt`, `impl`, `plan`, `research`, `tdd`, `trim`.
- [ ] Skills load: `plan-hunter`, `systematic-debugging`, `verification-before-completion`.
- [ ] Extensions typecheck and the focused Chrome extension tests pass.
- [ ] Four themes load.
- [ ] Public settings and agent definitions contain no default provider, model routing, enabled-model cycle, or credentials.
- [ ] `auth.json`, OAuth state, sessions, trust decisions, caches, and installed package directories remain local.

## Installer and safety

- [ ] Dry-run creates no files or directories.
- [ ] Apply records absent, symlink, file, and directory prior states.
- [ ] Rollback restores all recorded paths.
- [ ] Overlay replacement is included in the same rollback manifest.
- [ ] Pi shadow install writes nothing under the live Pi directory.
- [ ] Drift check reports a non-zero number of checked paths.
- [ ] Leak scanner detects its positive control before accepting a clean scan.
- [ ] Every migrated prose/config file receives manual privacy review.
- [ ] `bootstrap.sh` remains write-free by default and installs dependencies, config, and plugins only with `--apply`.

## Intentional differences

- Claude plugin commands and Pi prompt templates use runtime-specific tool names and delegation primitives.
- Pi has no `/bootstrap` or `/mode` prompt in v1; its `/impl` reads the same project-local mode file when present.
- Public settings are safe examples, not the maintainer's provider, model, permission, MCP, status-line, or notification choices.
- Historical plans, retrospectives, and real-session examples are not migrated.
