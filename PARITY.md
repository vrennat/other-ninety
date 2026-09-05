# Safe-parity checklist

Parity means the public toolkit preserves reusable behavior from the private sources. It does not mean preserving private settings or byte-identical Claude/Pi prompts.

## Claude plugin

- [ ] Manifests parse and agree on name `other-ninety` and version `0.4.1`.
- [ ] Commands load: `brainstorm`, `impl`, `plan`, `trim`.
- [ ] Agents load: `adversarial-reviewer`.
- [ ] Skills load: `clean-writing`.
- [ ] `scripts/test_parity.py` keeps the lists in this file and the public `CLAUDE.md` equal to the tree.
- [ ] SessionStart emits valid JSON, injects the `other-ninety` routing context, and runs on Python without Pi or Bun.
- [ ] `/impl` prints clarity and stakes before editing, completes authorized work within scope, dispatches `adversarial-reviewer` on high stakes regardless of diff size, and ends with at most one `docs/lessons.md` line or `Lesson: none`. Use `docs/autonomy-scenarios.md` to review the scope boundary.

## Global Claude configuration

- [ ] Public `CLAUDE.md`, rules, hooks, and agents install as links without private context.
- [ ] Existing `settings.json`, `keybindings.json`, and any skill that is already a real directory are never overwritten by a base install.
- [ ] An explicit overlay can replace mutable settings and whole skills with rollback coverage.
- [ ] Reusable global skills: `conductor`, `i-have-adhd`, `summarize`, `svelte5-best-practices`.

## Pi adapter

- [ ] Pi is stock by default: `AGENTS.md` and `APPEND_SYSTEM.md` link only with `--with pi-text`, and the drift check flags a leftover text link when that component is not selected.
- [ ] Eight routed agents are available.
- [ ] Prompt templates load: `brainstorm`, `debt`, `impl`, `mode`, `plan`, `research`, `status`, `tdd`, `trim`.
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

## Intentional differences

- Claude plugin commands and Pi prompt templates use runtime-specific tool names and delegation primitives.
- Pi keeps prompt templates (`mode`, `debt`, `status`, `research`, `tdd`) that the Claude plugin retired on 2026-09-01 under decision D6; their fate on Pi is decided by Pi-side evidence.
- Pi has no `/bootstrap` prompt. Its `/mode` prompt and `/impl` use the project-local mode file.
- Public settings are safe examples, not the maintainer's provider, model, permission, MCP, status-line, or notification choices.
- Historical plans, retrospectives, and real-session examples are not migrated.
