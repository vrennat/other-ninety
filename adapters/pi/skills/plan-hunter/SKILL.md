---
name: plan-hunter
description: Tournament-style planning that produces one polished plan from an idea by drafting from four lenses (MVP-first, risk-first, dependency-first, user-first) in parallel, scoring with four judges, and synthesizing the winner with grafted moves from runner-ups. Use when the user asks for a substantive implementation plan, project roadmap, build sequence, or "how should I approach building X" — multi-week scope, real tradeoffs, sequencing decisions. Trigger on "/plan-hunter", "plan-hunter this", or open-ended planning asks. Skip for tactical questions, single-file edits, debugging, or anything answerable in two paragraphs.
---

# Plan Hunter

One polished implementation plan via a four-phase tournament: **Scope → Draft (×4 parallel) → Judge (×4 parallel) → Synthesize**. About 10 subagents and 4 of your turns end-to-end.

## When it pays off

Run when there's real planning weight: multi-week scope, sequence/scope/risk tradeoffs, or explicit user request. Skip for bug triage, tactical "how do I X", single-component choices, or anything answerable in two paragraphs — burning 10 subagents on a small question is the worse failure mode.

## The phases

1. **Scope** (1 subagent) — normalize the idea into a JSON CONTEXT block (`normalized_idea`, `goals`, `constraints`, `assumptions`, `open_questions`). Every downstream agent consumes it verbatim.
2. **Draft** (4 subagents, parallel — launch in a single turn) — each commits to one lens:
   - **A. MVP-first** — smallest shippable thing that delivers the core promise.
   - **B. Risk-first** — sequence so the riskiest assumptions get spiked or proven early.
   - **C. Dependency-first** — build the dependency graph; surface critical path and parallelizable tracks.
   - **D. User-first** — work backward from the user journey; what makes the product feel real at each milestone.
3. **Judge** (4 subagents, parallel — identical prompts) — each scores all four drafts on completeness, practicality, risk_awareness, sequencing (1–10 each). Variance across judges is the point — averaging cuts single-judge noise.
4. **Aggregate** (no subagent) — mean per axis per plan, total mean per plan. Highest = winner; the rest are runner-ups. Collect rationales, union risks, union gaps.
5. **Synthesize** (1 subagent) — polish the winner, graft clearly-better moves from runner-ups (note "(borrowed from {lens} lens)"), prepend assumptions + open questions. No averaging or compromise — pick the better move and justify.

## Invocation

- Slash command: `/plan-hunter <idea>` — `$ARGUMENTS` is the idea.
- Auto-trigger: on substantive planning asks. The idea is the user's most recent planning message; don't ask them to repeat it.

If the idea is missing scope/timeline, hard constraints, or definition of done, ask 2–3 clarifying questions in one turn before launching the tournament. One round maximum — if still vague, surface assumptions explicitly and proceed.

## Final output

The synthesized plan as the main response, structured: `# Project name`, `## Assumptions to confirm` (checkboxes), `## Open questions`, `## The plan`, `## Risks and mitigations`, `## Open gaps`. Footer with the scoreboard so the user sees how the plan was built:

```
Built via plan-hunter tournament. Lenses: MVP / Risk / Dependency / User.
Winner: {lens} — total {score}/10
Scoreboard: A {tot} | B {tot} | C {tot} | D {tot}
```

## Full procedure

The verbatim subagent prompts (Scope, four lens drafts, judge, synthesizer), the JSON schemas, and failure-mode handling live in `REFERENCE.md` next to this file. Read it before launching the tournament — copy the prompts directly rather than paraphrasing them.
