---
name: mode
description: Set how aggressively the workflow confirms before acting — cautious, default, or autonomous. Stored at .o90/mode and read by every o90 runtime. With no argument, reports the current mode.
---

# /mode

Set the confirmation aggressiveness of `/impl`. Input is one of `cautious`, `default`, or `autonomous`. With no argument, report the current mode and stop.

Mode is stored at `.o90/mode` (project-local, one word). The SessionStart hook reads it to state the active mode in ambient context, and every native o90 implementation workflow restates it at the top of a run. Existing `.claude/other-ninety-mode` files remain a read-only fallback.

## Modes

| Mode | Confirms on |
|---|---|
| `cautious` | Ambiguous tasks AND medium/complex tasks. For unfamiliar code or pre-release work — see the planned routing before execution even when the path is clear. |
| `default` | Ambiguous tasks only, regardless of complexity. The standard confirm-only-when-ambiguous behavior. |
| `autonomous` | Nothing routine. Even ambiguous tasks get a sensible stated default and proceed. Only destructive/irreversible ops (the CLAUDE.md escape hatch) still confirm. |

Mode changes confirmation aggressiveness only. It does not touch the destructive-op escape hatch, and it does not touch stakes-gated review — a high-stakes change (auth, money, data) still gets an `adversarial-reviewer` pass in every mode.

## Procedure

1. No argument: read `.o90/mode`, falling back to `.claude/other-ninety-mode` when absent (treat both absent as `default`), and print `Mode: <mode> — <one-line behavior>.` Stop.

2. Argument given: validate it is one of the three. If not, print the three valid options and stop without writing.

3. Write the bare word:

   ```
   mkdir -p .o90 && printf '%s\n' "<mode>" > .o90/mode
   ```

4. Confirm: print `Mode set: <mode> — <one-line behavior>. New sessions and the next /impl will use it.`

## Rules

- The only filesystem write is `.o90/mode`. Touch nothing else.
- Consider adding `.o90/mode` to `.gitignore` if the mode is a personal preference rather than a shared project setting.

## Example

```
/mode autonomous
-> Mode set: autonomous — even ambiguous tasks get a sensible stated default and proceed; only destructive ops confirm. New sessions and the next /impl will use it.
```
