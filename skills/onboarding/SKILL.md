---
name: onboarding
description: Use when user mentions installing, configuring, or starting a project with The Other Ninety, or asks how to migrate from obra/superpowers. Surfaces the /bootstrap bootstrap command.
---

# Onboarding

Fires when the user is starting fresh with this plugin or migrating from obra/superpowers.

## Procedure

1. Tell the user to run `/bootstrap` in their project root. It:
   - Creates `docs/specs/` and `docs/plans/` if missing.
   - Detects legacy `docs/superpowers/specs/` and `docs/superpowers/plans/` from obra and prints `git mv` commands to migrate.
   - Prints a CLAUDE.md snippet to consider and hook-template copy commands.
   - Is idempotent — safe to re-run.
2. After `/bootstrap`, point them at the plugin README for the full inventory of slash commands and skills.

## Example

User: "I just installed The Other Ninety, what now?"
Response: "Run `/bootstrap` in your project root — it bootstraps `docs/specs/` and `docs/plans/`, prints any migration steps if you have legacy obra paths, and shows the next moves."
