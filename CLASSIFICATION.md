# Migration classification

This is the public/private boundary for the initial migration.

| Source | Destination | Class | Reason |
|---|---|---|---|
| Former plugin manifest | `claude/plugin/.claude-plugin/` | ADAPT | Rename product, marketplace, author metadata, and repository |
| Former plugin agents | `claude/plugin/agents/` | ADAPT | Preserve behavior; rename namespaces and routing markers |
| Former plugin commands | `claude/plugin/commands/` | ADAPT | Preserve behavior; rename mode, cache paths, and debt markers |
| Former plugin hooks | `claude/plugin/hooks/` | ADAPT | Preserve hook behavior under the new product tag |
| Former plugin skills | `claude/plugin/skills/` | ADAPT | Public plugin skills; rename product references |
| Former plugin templates | `claude/plugin/templates/` | ADAPT | Public project templates |
| Former plugin history | — | DROP | Historical plans contain stale paths and personal context |
| `claude-setup/global/CLAUDE.md` | `claude/config/CLAUDE.md` | ADAPT | Keep general working policy; remove identity and private context |
| `claude-setup/global/rules/` | `claude/config/rules/` | ADAPT | Generic policy with new plugin namespace |
| `claude-setup/global/hooks/` | `claude/config/hooks/` | ADAPT | General hooks; remove personal wording |
| `claude-setup/global/agents/` | `claude/config/agents/` | PUBLIC | Generic agent protocol |
| `claude-setup/global/skills/` | `claude/config/skills/` | ADAPT | Keep reusable skills; sanitize conductor references |
| `claude-setup/global/settings.json` | `claude/config/settings.example.json` | ADAPT | Minimal example only; remove private MCP, model, UI, and permission choices |
| `claude-setup/docs/` | — | DROP | Real retrospectives, handoffs, paths, and project history |
| `claude-setup/pi/agents/` | `pi/agents/` | ADAPT | Pi-specific agent ports |
| `claude-setup/pi/extensions/` | `pi/extensions/` | PUBLIC | Portable extension source and tests |
| `claude-setup/pi/prompts/` | `pi/prompts/` | ADAPT | Pi command ports under the new name |
| `claude-setup/pi/skills/` | `pi/skills/` | ADAPT | Pi-compatible shared workflows |
| `claude-setup/pi/themes/` | `pi/themes/` | PUBLIC | Portable theme data |
| `claude-setup/pi/settings.json` | `pi/settings.json` | ADAPT | Remove provider, model, and model-cycle preferences |
| Pi auth, OAuth, sessions, trust, caches, browser profile | — | PRIVATE/OVERLAY | Mutable or sensitive machine state; never migrate |
| Cross-harness Pi leaf launcher | `bin/o90-pi` | ADAPT | Reuse the constrained Claude bridge without a Claude-specific plugin path |
| Shared global agent policy | `codex/AGENTS.md` | ADAPT | Keep generic working agreements; use Codex's documented global instruction path |
| Portable native agent workflows | `skills/` | ADAPT | Share the complete public skill catalog without requiring Pi |
| Public Claude agent roles | `codex/agents/` | ADAPT | Express every public role in Codex's documented personal custom-agent TOML format |
| Optional Pi delegation workflow | `integrations/pi-worker/` | ADAPT | Add the constrained Pi leaf bridge only to explicitly selected host-plus-Pi installs |
| Shared agent policy and roles | `cursor/rules/`, `cursor/agents/` | ADAPT | Use Cursor's documented project rule and custom-agent formats; do not mutate UI-managed User Rules |
| Cross-runtime output policy | `shared/output-style.md` plus native guidance | ADAPT | Apply one compact technical-writing contract while preserving precision and voice |
| Identity, employer, private projects, machine paths | external overlay | PRIVATE/OVERLAY | Must never enter this repository or its Git history |

`PUBLIC` means copied as reusable source. `ADAPT` means behavior was retained while runtime, identity, or privacy-specific details changed. `PRIVATE/OVERLAY` never passes through this repository. `DROP` is intentionally not migrated.
