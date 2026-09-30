# The Other Ninety for Pi

Public Pi defaults: agents, extensions, prompts, skills, themes, and pinned package configuration.

`/impl` classifies clarity and stakes, implements in the main session by default,
and verifies the result. Delegation serves independent work, isolated exploration,
or fresh review; high-stakes changes require `adversarial-reviewer`.
Scope and confirmation come from your request and repository instructions.
The obsolete `/debt` marker audit and `/mode` setting are retired.

Provider credentials, model choices, sessions, trust decisions, and OAuth state
stay local. Use the root `bootstrap.sh --with pi` to preview configuration and
dependency setup, then repeat with `--apply`. Use `install.sh --with pi` for
configuration only. Existing settings are preserved unless an overlay owns
them; packages follow those effective settings. This directory is not a
standalone Pi package.

Extensions and prompt templates are installed by default. Additional o90
behavior text (`AGENTS.md` and `APPEND_SYSTEM.md`) requires
`--with pi --with pi-text`, including overlay text. See the
[install matrix](../docs/install-matrix.md) for ownership, drift, and rollback.

Auto-title uses the active model by default. Set both `OTHER_NINETY_TITLE_PROVIDER` and `OTHER_NINETY_TITLE_MODEL` to use a dedicated model. Set `OTHER_NINETY_VISION_PROVIDER` and `OTHER_NINETY_VISION_MODEL` to enable optional image analysis for text-only sessions.

Automatic quota fallback is opt-in. Put an ordered JSON array of
`{ "provider": "...", "id": "..." }` entries in `quota-fallback.json` under
`PI_CODING_AGENT_DIR` (default `~/.pi/agent`), or supply it through an overlay.
Missing or empty configuration disables substitution; invalid configuration
reports an error. Public defaults contain no fallback chain.

The Pi UI shows elapsed turn time, context and cache use, and MCP status only
when a server needs attention. Use the built-in `/thinking` to select a
supported reasoning level and `/clear` to start a fresh session.
