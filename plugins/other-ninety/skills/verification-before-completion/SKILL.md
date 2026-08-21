---
name: verification-before-completion
description: Use before claiming work is complete, fixed, passing, or ready. Run the relevant verification and establish behavioral ground truth before making the success claim.
---

# Verification before completion

Before claiming success, identify exactly what the claim requires.

1. For a gate claim, run the relevant current command: test, typecheck, build,
   lint, or another repository-defined check.
2. For a behavioral claim, exercise the changed path and re-read the source
   being described. A successful build alone is not behavioral evidence.
3. Capture the result. If it fails or is inconclusive, do not claim completion;
   report the gap and continue when possible.
4. State what passed and what remains unverified without rounding partial
   evidence up to success.

Equivalence claims are testable: compare both paths or outputs directly.

## Example

Weak: "Tests are passing now."

Strong:

```text
$ bun run test:run
Test Files  1 passed (1)
     Tests  12 passed (12)
```

Tests pass.

For a behavioral claim such as "the webhook now verifies signatures", re-open
the handler, confirm `verifySignature(raw)` runs before `JSON.parse`, and quote
those lines before claiming.
