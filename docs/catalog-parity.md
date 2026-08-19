# Public catalog parity

The public o90 catalog is available natively in every selectable runtime.
Claude, Codex, and Cursor do not require Pi for any item in this table. The
Claude plugin remains the Claude source of truth. The shared skill catalog and
native role adapters carry the same general behavior into Codex and Cursor.

## Output policy

`shared/output-style.md` is the canonical output-style block. The installer
places the exact block in the always-loaded guidance for Pi, Claude, Codex, and
Cursor. Claude's SessionStart hook also injects the block for plugin-only
installs. Tests compare every host copy with the canonical text.

The policy uses a pragmatic STE-inspired subset. It does not claim formal
ASD-STE100 conformance because this repository does not include the controlled
dictionary or the official specification. Exact code, identifiers, commands,
paths, quotations, errors, API terms, schema terms, and required domain words
take precedence over the style rules.

## Skills

| Skill | Pi | Claude | Codex | Cursor |
|---|---|---|---|---|
| `onboarding` | Shared skill | Plugin skill | `~/.agents/skills/onboarding` | `<project>/.cursor/skills/onboarding` |
| `plan-hunter` | Pi-native skill | Plugin skill | `~/.agents/skills/plan-hunter` | `<project>/.cursor/skills/plan-hunter` |
| `systematic-debugging` | Pi-native skill | Plugin skill | `~/.agents/skills/systematic-debugging` | `<project>/.cursor/skills/systematic-debugging` |
| `verification-before-completion` | Pi-native skill | Plugin skill | `~/.agents/skills/verification-before-completion` | `<project>/.cursor/skills/verification-before-completion` |

The portable `onboarding` skill performs the same safe project bootstrap as
Claude's `/bootstrap` flow without assuming slash-command support. The portable
`plan-hunter` uses whichever native subagent mechanism the active host provides.

## Agent roles

| Role | Pi | Claude | Codex | Cursor |
|---|---|---|---|---|
| `adversarial-reviewer` | Pi agent | Plugin agent | `~/.codex/agents/adversarial-reviewer.toml` | `<project>/.cursor/agents/adversarial-reviewer.md` |
| `brutal-code-reviewer` | Pi agent | Plugin agent | `~/.codex/agents/brutal-code-reviewer.toml` | `<project>/.cursor/agents/brutal-code-reviewer.md` |
| `debug-genius` | Pi agent | Plugin agent | `~/.codex/agents/debug-genius.toml` | `<project>/.cursor/agents/debug-genius.md` |
| `fast-impl` | Pi agent | Plugin agent | `~/.codex/agents/fast-impl.toml` | `<project>/.cursor/agents/fast-impl.md` |
| `validator` | Pi agent | Plugin agent | `~/.codex/agents/validator.toml` | `<project>/.cursor/agents/validator.md` |

In Codex, ask the parent to delegate to the named custom agent. In Cursor, use
the corresponding `/name` invocation. Role files intentionally omit a concrete
model: Codex inherits the spawning session's resolved model, and Cursor uses
`model: inherit`. The runtime owner keeps control of cost and provider policy.

## Native-format choices and limits

- Codex's official custom-agent format is standalone TOML under
  `~/.codex/agents/` for personal agents. The format is documented as a current
  configuration layer that may evolve as sharing support matures. See
  [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- Cursor officially supports project agents under `.cursor/agents/` and agent
  skills under `.cursor/skills/`. o90 uses project scope so installs are
  explicit, version-visible, and reversible. See
  [Cursor subagents](https://cursor.com/docs/subagents) and
  [Cursor Agent Skills](https://cursor.com/docs/skills).
- Claude plugin installation is performed by Claude's plugin manager and is not
  included in o90's filesystem rollback manifest. Codex and Cursor catalog
  files are covered by that manifest.
- Pi supplies its own native roles and workflows. The `o90-pi-worker` skill is a
  separate optional enhancement installed only for an explicit host-plus-Pi
  selection.
