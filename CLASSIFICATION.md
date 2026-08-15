# Migration classification

This is the public/private boundary for the initial migration.

| Source | Destination | Class | Reason |
|---|---|---|---|
| Former plugin manifest | `.claude-plugin/` | ADAPT | Rename product, marketplace, author metadata, and repository |
| Former plugin agents | `agents/` | ADAPT | Preserve behavior; rename namespaces and routing markers |
| Former plugin commands | `commands/` | ADAPT | Preserve behavior; rename mode, cache paths, and debt markers |
| Former plugin hooks | `hooks/` | ADAPT | Preserve hook behavior under the new product tag |
| Former plugin skills | `skills/` | ADAPT | Public plugin skills; rename product references |
| Former plugin templates | `templates/` | ADAPT | Public project templates |
| Former plugin history | — | DROP | Historical plans contain stale paths and personal context |
| `claude-setup/global/CLAUDE.md` | `config/claude/CLAUDE.md` | ADAPT | Keep general working policy; remove identity and private context |
| `claude-setup/global/rules/` | `config/claude/rules/` | ADAPT | Generic policy with new plugin namespace |
| `claude-setup/global/hooks/` | `config/claude/hooks/` | ADAPT | General hooks; remove personal wording |
| `claude-setup/global/agents/` | `config/claude/agents/` | PUBLIC | Generic agent protocol |
| `claude-setup/global/skills/` | `config/claude/skills/` | ADAPT | Keep reusable skills; sanitize conductor references |
| `claude-setup/global/settings.json` | `config/claude/settings.example.json` | ADAPT | Minimal example only; remove private MCP, model, UI, and permission choices |
| `claude-setup/docs/` | — | DROP | Real retrospectives, handoffs, paths, and project history |
| `claude-setup/pi/agents/` | `adapters/pi/agents/` | ADAPT | Pi-specific agent ports |
| `claude-setup/pi/extensions/` | `adapters/pi/extensions/` | PUBLIC | Portable extension source and tests |
| `claude-setup/pi/prompts/` | `adapters/pi/prompts/` | ADAPT | Pi command ports under the new name |
| `claude-setup/pi/skills/` | `adapters/pi/skills/` | ADAPT | Pi-compatible shared workflows |
| `claude-setup/pi/themes/` | `adapters/pi/themes/` | PUBLIC | Portable theme data |
| `claude-setup/pi/settings.json` | `adapters/pi/settings.json` | ADAPT | Remove provider, model, and model-cycle preferences |
| Pi auth, OAuth, sessions, trust, caches, browser profile | — | PRIVATE/OVERLAY | Mutable or sensitive machine state; never migrate |
| Identity, employer, private projects, machine paths | external overlay | PRIVATE/OVERLAY | Must never enter this repository or its Git history |

`PUBLIC` means copied as reusable source. `ADAPT` means behavior was retained while runtime, identity, or privacy-specific details changed. `PRIVATE/OVERLAY` never passes through this repository. `DROP` is intentionally not migrated.
