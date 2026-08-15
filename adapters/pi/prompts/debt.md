---
name: debt
description: Audit the repo for `on:` (legacy `dD:`) routing-decision markers and print a ledger grouped by file, flagging entries that name no upgrade trigger. Use to review accumulated deliberate-shortcut debt left by /impl. Read-only; never edits or removes markers.
---

# /debt

User input: $ARGUMENTS

Surface the deliberate routing shortcuts the workflow has taken. A `// on:` marker (also accept legacy `// dD:`) (`# on:` (also accept `# dD:`) for Python/shell) records a borderline classification call /impl made on purpose — routing simple where medium was plausible, treating stakes as normal where high was arguable, skipping a review pass on a borderline change. Each marker should name an upgrade trigger: the condition under which the shortcut stops being safe. `/debt` collects them so the debt stays visible instead of silently compounding.

## Procedure

1. Search the repo for markers (ripgrep preferred; fall back to grep):

   ```
   rg -n -e 'on:' -e 'dD:' .        # or: grep -rn -e 'on:' -e 'dD:' .
   ```

   Match both `// on:` and `# on:` forms, plus legacy `// dD:` and `# dD:` forms.

2. Drop matches that document the convention rather than incur debt: this plugin's own files (`commands/`, `skills/`, `agents/`, `hooks/`, `README.md`, and spec/plan docs that explain `on:`). A real marker sits next to source code it is justifying.

3. For each surviving match, extract: file path, line number, and the marker text after `on:`.

4. Classify each marker. It has an **upgrade trigger** if its text names a revisit condition — a clause using words like `if`, `when`, `once`, `until`, `escalate`, `upgrade`, `beyond`, `grows`, `past`, `exceeds`, or `over`. If none is present, tag it `[no-trigger]`.

5. Print a ledger grouped by file (file order, lines ascending):

   ```
   <file>
     L<line> — <marker text>
     L<line> — <marker text>  [no-trigger]
   ```

6. End with exactly one summary line:

   ```
   <N> markers, <M> with no trigger.
   ```

## Rules

- Read-only. `/debt` reports; it never edits code or removes markers.
- If zero markers survive step 2, print `No on: markers found.` and stop — no summary line.
- Do not invent triggers. A decision with no written revisit condition is `[no-trigger]` by design; that gap is the signal worth surfacing.

## Example

```
src/hand/sort.ts
  L42 — routed simple, escalate if sorting logic grows beyond this file
  L88 — skipped adversarial pass, borderline stakes  [no-trigger]

2 markers, 1 with no trigger.
```
