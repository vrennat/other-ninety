---
name: debt
description: Audit the repo for `o90:` routing-decision markers and print a ledger grouped by file, flagging entries that name no upgrade trigger. Accepts legacy `on:` and `dD:` markers. Read-only.
---

# /debt

Surface deliberate routing shortcuts. A `// o90:` marker (`# o90:` for Python or shell) records a borderline classification call that `/impl` made on purpose. Each marker should name the condition under which that shortcut stops being safe.

## Procedure

1. Search the repo for current and legacy markers:

   ```bash
   rg -n -e 'o90:' -e 'on:' -e 'dD:' .
   ```

   Match `//` and `#` forms. Treat `o90:` as current; `on:` and `dD:` are compatibility aliases.

2. Drop documentation of the convention itself. A real marker sits beside the source code it justifies.

3. For each surviving match, extract the file, line, and text after the marker.

4. Tag a marker `[no-trigger]` unless its text names a revisit condition with words such as `if`, `when`, `once`, `until`, `escalate`, `upgrade`, `beyond`, `grows`, `past`, `exceeds`, or `over`.

5. Print a ledger grouped by file, with lines ascending:

   ```text
   <file>
     L<line> — <marker text>
     L<line> — <marker text>  [no-trigger]
   ```

6. End with exactly:

   ```text
   <N> markers, <M> with no trigger.
   ```

## Rules

- Read-only. Never edit or remove markers.
- If no markers survive, print `No o90: markers found.` with no summary line.
- Do not invent triggers. Missing written conditions are the debt signal.
