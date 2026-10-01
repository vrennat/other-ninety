# Safe-parity checklist

Parity means the public toolkit preserves reusable behavior from the private sources. It does not mean preserving private settings or byte-identical Claude/Pi prompts.

## Claude plugin

- [ ] Manifests parse and agree on name `other-ninety` and version `0.5.1`.
- [ ] Commands load: `brainstorm`, `impl`, `plan`, `trim`.
- [ ] Agents load: `adversarial-reviewer`.
- [ ] Skills load: `clean-writing`.
- [ ] `scripts/test_parity.py` keeps the lists in this file and the public `CLAUDE.md` equal to the tree.
- [ ] The plugin ships no SessionStart hook; the global `CLAUDE.md` carries the routing and stakes rules (D15).
- [ ] `/impl` prints clarity and stakes before editing, completes authorized work within scope, dispatches `adversarial-reviewer` on high stakes regardless of diff size, and ends with at most one `docs/lessons.md` line or `Lesson: none`. Use `docs/autonomy-scenarios.md` to review the scope boundary.

## Global Claude configuration

- [ ] Public `CLAUDE.md`, rules, hooks, and agents install as links without private context. Hooks run only when registered in settings; plugin-only does not install global configuration.
- [ ] Existing `settings.json`, `keybindings.json`, and any skill that is already a real directory are never overwritten by a base install.
- [ ] An explicit overlay can replace mutable settings and whole skills with rollback coverage.
- [ ] Reusable global skills: `conductor`, `i-have-adhd`, `ponytail`, `retro`, `summarize`, `svelte5-best-practices`, `wizard`.

## Pi configuration

- [ ] Pi behavior text is off by default: `AGENTS.md` and `APPEND_SYSTEM.md` link only with `--with pi-text`, and the drift check flags a leftover text link when that component is not selected.
- [ ] Eight routed agents are available.
- [ ] Prompt templates load: `brainstorm`, `impl`, `plan`, `research`, `status`, `tdd`, `trim`.
- [ ] `/impl` classifies clarity and stakes, defaults to the main session, delegates for independent work, isolated exploration, or fresh review, and requires `adversarial-reviewer` for high stakes. It verifies appropriate behavior and stops after three failed repair cycles.
- [ ] Skills load: the Claude plugin's `clean-writing`; `pi/skills/` holds only deliberate per-skill overrides and is currently empty.
- [ ] Extensions typecheck and the focused Chrome extension tests pass.
- [ ] Five themes load, including the high-contrast Tokyo Night variant.
- [ ] Public settings and agent definitions contain no default provider, model routing, enabled-model cycle, or credentials.
- [ ] `auth.json`, OAuth state, sessions, trust decisions, caches, and installed package directories remain local.
- [ ] The opt-in Pi text contains the exact compact-writing policy from `shared/output-style.md`.

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
- [ ] Drift checks accept the same component and target flags as install.

## Private Codex configuration

- [ ] `codex` is an explicit overlay-only component; default installs do not select it.
- [ ] Only private `AGENTS.md` and `other-ninety.config.toml` are managed under `CODEX_HOME` (or `--codex-dir`).
- [ ] Base `config.toml`, credentials, host trust, plugin/app state, and runtime data remain local.
- [ ] There is no public Codex prompt, agent, or hook adapter.

## Intentional differences

- Claude plugin commands and Pi prompt templates use runtime-specific tool names and delegation primitives.
- Pi keeps `status`, `research`, and `tdd` templates that the Claude plugin retired under D6; further removal needs Pi-side evidence. The obsolete `/debt` marker audit and `/mode` setting are retired.
- Pi has no `/bootstrap` prompt. `/impl` uses the request and repository instructions for scope and confirmation.
- Public settings are safe examples, not the maintainer's provider, model, permission, MCP, status-line, or notification choices.
- Historical plans, retrospectives, and real-session examples are not migrated.
