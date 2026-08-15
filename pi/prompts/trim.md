---
name: trim
description: Deletion-focused code review. Hunts only what to remove — over-engineering, dead flexibility, reinvented stdlib, speculative abstraction. Not correctness, not security (those are brutal-code-reviewer and adversarial-reviewer). Outputs one line per finding plus a net line-savings total.
---

# /trim

User input: $ARGUMENTS

A review with exactly one question: what can be removed? Correctness, security, and style are out of scope — those belong to `brutal-code-reviewer` (architecture) and `adversarial-reviewer` (break-it). `/trim` hunts the opposite failure: code that works but should not exist. Over-engineering, dead flexibility, reinvented standard library, speculative generality.

## Scope

Default target is the working change: `git diff`, staged, and untracked files. Given a path (`/trim src/foo.ts` or a directory), review that instead.

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
- No praise, no preamble, no "overall this looks good." Findings and the closing line only.

## Example

```
src/util/dates.ts:14 — stdlib hand-rolled day-diff loop. Use (b - a) / 86400000.
src/api/client.ts:33 — yagni RetryStrategy interface, one impl. Inline the loop.
src/hand/sort.ts:8 — delete unused compareLegacy export. Remove.
net: -41 lines possible.
```
