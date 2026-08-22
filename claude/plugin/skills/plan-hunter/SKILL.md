---
name: plan-hunter
description: Use for explicit tournament-style planning of a substantive roadmap. Compare MVP, risk, dependency, and user plans before you synthesize one plan. User-invoked only; never auto-trigger the ten-subagent tournament.
---

# Plan Hunter

Produce one polished implementation plan through a planning tournament:
**Scope -> Draft (four in parallel) -> Judge (four in parallel) -> Synthesize**.
This workflow uses the active runtime's native subagents and does not require Pi.

Use it only for substantive planning. Do not spend ten subagents on tactical
questions, single-file edits, debugging, or work answerable in two paragraphs.

## Phases

1. **Scope** (one subagent): normalize goals, constraints, assumptions, and open
   questions into the JSON schema in `REFERENCE.md`.
2. **Draft** (four parallel subagents): produce complete plans through MVP-first,
   risk-first, dependency-first, and user-first lenses.
3. **Judge** (four parallel subagents): independently score every draft on
   completeness, practicality, risk awareness, and sequencing.
4. **Aggregate** (main agent): average scores, rank drafts, and deduplicate all
   risks and gaps.
5. **Synthesize** (one subagent): polish the winner and graft in clearly better
   moves from runners-up without averaging away the tradeoffs.

If scope, hard constraints, or definition of done is missing, ask two or three
questions in one round. If ambiguity remains, state assumptions and proceed.

Read `REFERENCE.md` before running the tournament. It contains the schemas,
prompts, output contract, and failure handling.
