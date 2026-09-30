---
name: research
description: Opt-in, explicit /research invocation only. Measurable experimentation loop that sets up a .lab/ directory and runs THINK -> TEST -> REFLECT iterations. Does not auto-trigger on experimentation-shaped asks; use only when the user types /research.
---

# /research

User input: $ARGUMENTS

Autonomous experimentation for tasks with measurable outcomes. Use when you can quantify success: a benchmark, an accuracy score, a latency number, an A/B comparison.

## Procedure

1. Restate the question and success metric. Set a sample plan, stopping criterion, and resource budget before running experiments.
2. Create `.lab/<slug>/` if it doesn't exist. This is the experiment workspace.
3. **THINK:** form a hypothesis. Write it to `.lab/<slug>/hypothesis.md` with: claim, predicted measurement, smallest experiment that would prove or disprove it.
4. **TEST:** run the experiment. Capture inputs, outputs, and the raw measurement to `.lab/<slug>/runs/<timestamp>.md`.
5. **REFLECT:** compare measurement to prediction. Was the hypothesis confirmed, refuted, or unclear (variance too high)? Write to `.lab/<slug>/reflections.md`.
6. Follow the sample plan; an inconclusive result is valid. Report sample size, variance, and confidence where supported.
7. Iterate within the declared budget. Stop when the criterion or budget is reached; preserve inconclusive findings.
8. Final report: `.lab/<slug>/conclusion.md` with the answer, the evidence, and the variance.

## Rules

- Never report a benchmark without sample size and variance.
- If the result could plausibly be noise, say so. Don't rerun fishing for a better number.
- Keep raw run data on disk; don't delete it.

## When NOT to use

- The answer is already known and just needs implementation: skip to `/impl`.
- The question is qualitative (taste, style): brainstorming, not research.
- Pure reading research: just read.
