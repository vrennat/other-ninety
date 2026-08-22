---
description: Set how aggressively /impl confirms before acting
argument-hint: "[cautious|default|autonomous]"
---

Set or report the o90 confirmation mode for this project: $ARGUMENTS

The canonical mode file is `.o90/mode` and contains one word. When reading,
fall back to the legacy `.claude/other-ninety-mode` if the canonical file is
absent.

| Mode | `/impl` pauses for |
|---|---|
| `cautious` | Ambiguous tasks and clear medium or complex tasks. |
| `default` | Ambiguous tasks only. |
| `autonomous` | No routine task; destructive or irreversible actions still require confirmation. |

## Procedure

1. Trim and lowercase the requested mode.
2. With no argument, read `.o90/mode`, then the legacy path; treat both missing or an invalid value as `default`. Print `Mode: <mode> — <one-line behavior>.` and stop.
3. If the argument is not `cautious`, `default`, or `autonomous`, print the valid values and stop without writing.
4. Otherwise create `.o90/` when needed and write the selected mode plus a trailing newline to `.o90/mode`.
5. Read the file back. If it does not contain the selected mode, report the failure and do not claim success.
6. Print `Mode set: <mode> — <one-line behavior>.`

Touch no other file. If the mode is a personal preference rather than a shared
project setting, suggest adding `.o90/mode` to `.gitignore`.
