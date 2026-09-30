---
name: trim
description: Deletion-focused review of over-engineering, dead flexibility, reinvented stdlib, and speculative abstraction. Outputs one line per finding plus a net line-savings total.
---

# /trim

A review with exactly one question: what can be removed? Correctness, security, and style belong to a separate review; `adversarial-reviewer` handles the break-it pass. `/trim` hunts code that works but should not exist: over-engineering, dead flexibility, reinvented standard library, speculative generality.

## Scope

Default target is the working change: `git diff`, staged, and untracked files. Given a path (`/trim src/foo.ts` or a directory), review that instead.

`/trim docs/lessons.md` reviews the lessons file `/impl` appends to. Flag as `delete` any entry the code, tests, or repo instructions now make derivable, or that names a path or behavior that no longer exists. Same output format.

## What to flag

| Tag | Finding |
|---|---|
| `delete` | Dead code, unused export, unreachable branch, a wrapper that only forwards. |
| `stdlib` | Hand-rolled logic the language's standard library already does (date math, dedupe, deep clone, clamp). |
| `native` | A dependency or helper replaceable by a built-in platform feature. |
| `yagni` | Flexibility, config, or abstraction with one caller and no second on the horizon. |
| `shrink` | Works, but says in N lines what 1-2 would; collapse it. |

## Output

One line per finding, nothing more per finding:

```
<file>:<line> — <tag> <what>. <replacement>.
```

Order by impact, most lines saved first. Then a single closing line:

```
net: -<N> lines possible.
```

`<N>` is the summed lines the findings would remove; when uncertain, undercount. If there is genuinely nothing to cut, output exactly:

```
Lean already. Ship.
```

## Rules

- Every finding names a concrete replacement, not "consider simplifying."
- Flag only what is safe to remove or shrink without changing behavior. A deletion that alters behavior is a correctness call — out of scope.
- Output is the findings and the closing line, nothing before, between, or after.

## Example

```
src/util/dates.ts:14 — stdlib hand-rolled day-diff loop. Use (b - a) / 86400000.
src/api/client.ts:33 — yagni RetryStrategy interface, one impl. Inline the loop.
src/hand/sort.ts:8 — delete unused compareLegacy export. Remove.
net: -41 lines possible.
```
