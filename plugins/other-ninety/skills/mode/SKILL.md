---
name: mode
description: Set or report o90's project confirmation mode for implementation routing. Use when the user explicitly asks for cautious, default, or autonomous o90 behavior.
---

# o90 mode

Store the project mode in `.o90/mode` as one lowercase word followed by a
newline. For reads, fall back to the legacy `.claude/other-ninety-mode` when the
canonical file is absent.

| Mode | Implementation routing pauses for |
|---|---|
| `cautious` | Ambiguous work and clear medium or complex work. |
| `default` | Genuinely ambiguous work only. |
| `autonomous` | No routine work; ambiguity gets a stated default and proceeds. |

Mode affects confirmation frequency only. It never authorizes destructive or
irreversible actions and never weakens high-stakes review.

With no requested value, report the effective mode and whether it came from the
canonical file, the legacy file, or the default. Do not write.

With a requested value:

1. Normalize it to lowercase and accept only `cautious`, `default`, or `autonomous`.
2. If invalid, list the valid values and stop without writing.
3. Create `.o90/` when needed and write the canonical file. Touch no other path.
4. Read it back before reporting `Mode set: <mode> — <one-line behavior>.`

If mode is a personal preference rather than a shared project decision, suggest
adding `.o90/mode` to `.gitignore`.
