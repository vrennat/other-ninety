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
| `cautious` | An explicitly requested plan-before-code checkpoint; approval already given satisfies it. Shows the approach for medium or complex work. |
| `default` | Missing product decisions, materially broader scope, or external actions not yet authorized. |
| `autonomous` | The same scope and authorization boundaries; routine implementation choices use stated defaults. |

No mode expands the user's request or requires re-approval of work already authorized.
Investigate technical uncertainty yourself. Explicit proposal-only limits apply in every mode.

## Procedure

1. Trim and lowercase the requested mode.
2. With no argument, read `.o90/mode`, then the legacy path; treat both missing or an invalid value as `default`. Print `Mode: <mode> — <one-line behavior>.` and stop.
3. If the argument is not `cautious`, `default`, or `autonomous`, print the valid values and stop without writing.
4. Otherwise create `.o90/` when needed and write the selected mode plus a trailing newline to `.o90/mode`.
5. Read the file back. If it does not contain the selected mode, report the failure and do not claim success.
6. Print `Mode set: <mode> — <one-line behavior>.`

Touch no other file. If the mode is a personal preference rather than a shared
project setting, suggest adding `.o90/mode` to `.gitignore`.
