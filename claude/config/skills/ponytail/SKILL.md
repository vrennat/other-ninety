---
name: ponytail
description: Simplify a coding approach when the user invokes /ponytail. Prefer reuse, standard libraries, native features, and deletion over new machinery.
disable-model-invocation: true
license: MIT
metadata:
  source: https://www.npmjs.com/package/@dietrichgebert/ponytail (folded from the package on removal; mode machinery dropped, core discipline kept)
---

# Ponytail

Understand the requested outcome and the affected code before choosing the
smallest approach that meets it. Prefer deletion and boring code over new
abstractions or scaffolding for speculative needs.

Stop at the first option that fits:

1. Reuse an existing helper, type, or pattern in the codebase.
2. Use the standard library.
3. Use a native platform feature.
4. Use an already-installed dependency.
5. Write the minimum custom code needed; add a dependency only for a clear benefit.

For bugs, trace the affected flow and callers to fix the root cause once in
the appropriate place. A smaller diff is useful only if it solves the problem.

Keep the requested scope, required verification, and safeguards for security,
data integrity, trust boundaries, and accessibility. Explain material tradeoffs
and known limitations concisely; do not silently substitute a partial result.
