---
name: tdd
description: Strict RED-GREEN-REFACTOR scaffold. Opt-in. Use when you want full TDD discipline. Not an always-on behavior.
---

# /tdd

Test-driven development loop. RED -> GREEN -> REFACTOR.

Opt-in only. The plugin does NOT auto-enforce TDD on every implementation. Use this when you want the discipline.

## Procedure

1. **SCAFFOLD:** define the interface. Types, function signature, throw `Not implemented`. Commit.
2. **RED:** write the failing test(s). Cover happy path, edge cases (empty/null/max), error conditions. Run tests; verify they FAIL for the right reason.
3. **GREEN:** write the minimum code to pass. No gold-plating. Run tests; verify PASS.
4. **REFACTOR:** improve naming, extract helpers, reduce complexity. Run tests after each change; must stay green.
5. **REPEAT:** next behavior or scenario, back to RED.

Commit after each phase that produces working state (after GREEN, after REFACTOR). Don't commit RED — the test is failing.

## Rules

- Test FIRST. No exceptions in this command.
- Verify the test fails before implementing. A test that "passes" before you implement is testing the wrong thing.
- Refactor only when green. Tests are your safety net.
- Test behavior, not implementation. Don't mock everything; prefer integration tests where reasonable.

## When NOT to use

- Quick spike or throwaway script: just write it.
- Exploring a library: write a scratch file, no tests needed.
- Bug fix where reproduction is the test: regression test then fix is fine, but you don't need the full RED-GREEN-REFACTOR ceremony.
