# Plan Hunter — Full Procedure

Verbatim subagent prompts and procedural detail referenced by `SKILL.md`. Copy prompts directly rather than paraphrasing.

## Phase 0: Clarify (only if needed)

If the user's idea is vague — missing scope/timeline, hard constraints, or a clear definition of done — ask **2–3 clarifying questions in a single turn** before launching the tournament. Useful clarifiers:

- *"What's the rough scope/timeline you're imagining — weekend hack, two weeks, a quarter?"*
- *"Any hard constraints I should bake in (tech stack, team size, budget, must-ship date)?"*
- *"What does 'done' look like — what's the smallest version that would feel like a win?"*

Skip this phase if the prompt already pins down all three. Don't ask just to ask — clarifiers exist to de-risk the tournament, not to gatekeep. One round of clarifiers maximum; if the answer is still vague after that, proceed with explicit assumptions noted in scope rather than asking again.

Once the idea is concrete, proceed to Scope.

---

## Phase 1: Scope (1 subagent)

Launch one Task subagent to normalize the idea and extract a structured CONTEXT block. Every downstream agent receives this verbatim, so getting it right matters.

**Subagent prompt:**

```
You are the Scope agent for a planning tournament. The user's idea is:

<IDEA>
{the idea — either $ARGUMENTS from the slash command, or the user's most recent
planning-related message; include any clarifier answers from Phase 0}
</IDEA>

Read it carefully and extract a structured representation. Return ONLY valid JSON
matching this schema (no preamble, no markdown fence):

{
  "normalized_idea": "<one-paragraph rewrite in clear, concrete terms>",
  "goals": ["<what success looks like, as concrete outcomes>"],
  "constraints": ["<hard limits: tech, budget, timeline, team, regulatory>"],
  "assumptions": ["<things being taken for granted that the user should confirm>"],
  "open_questions": ["<things that genuinely need user input before building>"]
}

Be specific. "Should be fast" is not a goal; "p99 latency under 200ms for /search"
is. If the idea doesn't specify something, list it under assumptions or
open_questions rather than inventing a number.
```

Save the returned JSON as `SCOPE`. This is your shared CONTEXT for everything downstream.

---

## Phase 2: Draft — four lenses in parallel (4 subagents)

**Launch all 4 Task calls in a single turn.** Don't serialize — that defeats the point. Each subagent gets the same SCOPE block but a different lens framing.

The four lenses:

### Lens A — MVP-first
> Find the smallest shippable thing that delivers the core promise. Phase everything else into v2/v3. Be ruthless about what's NOT in v1.

### Lens B — Risk-first
> Identify the riskiest assumptions and unknowns. Sequence so the riskiest parts get spiked or proven early, before downstream work depends on them.

### Lens C — Dependency-first
> Build the dependency graph between components. Sequence so nothing is blocked. Surface the critical path and parallelizable tracks.

### Lens D — User-first
> Work backward from the user's journey. What does the user touch first? What sequence of capabilities makes the product feel real to them at each milestone?

**Subagent prompt template** — substitute `{LENS_NAME}` and `{LENS_FRAMING}`:

```
You are a planning agent applying the **{LENS_NAME}** lens to a planning tournament.

Your lens:
{LENS_FRAMING}

Shared context (from the Scope phase):
<SCOPE>
{SCOPE JSON, pretty-printed}
</SCOPE>

Write a complete implementation plan from your lens. Return ONLY valid JSON
matching this schema (no preamble, no markdown fence):

{
  "plan": "<the full plan in markdown — phases, milestones, concrete steps, sequencing rationale>",
  "risks": ["<risks specific to this plan or surfaced by your lens>"],
  "gaps": ["<things you couldn't pin down — open decisions, missing info>"]
}

The "plan" field must be a complete, standalone plan (not a sketch). It will be
judged against three rival plans on completeness, practicality, risk-awareness,
and sequencing. Be specific about milestones, what's in each phase, and why this
sequence in particular. Lean into your lens — your job is to produce the
strongest version of *this* perspective, not a balanced compromise. The
synthesizer downstream is the one who balances; you commit to the lens.
```

Collect the 4 results as `DRAFT_A`, `DRAFT_B`, `DRAFT_C`, `DRAFT_D`.

---

## Phase 3: Judge — four identical judges in parallel (4 subagents)

**Launch all 4 Task calls in a single turn.** Identical prompts; the variance across judges is the point — averaging reduces single-judge noise. Each judge sees all 4 drafts and scores them all.

**Subagent prompt** (same for all 4 judges):

```
You are a judge in a planning tournament. Four planners each wrote a complete
plan from a different lens. Score every plan independently on four axes (1–10
each), with brief rationales.

The plans:

<PLAN_A lens="MVP-first">
{DRAFT_A.plan}
Risks surfaced: {DRAFT_A.risks}
Gaps: {DRAFT_A.gaps}
</PLAN_A>

<PLAN_B lens="Risk-first">
{DRAFT_B.plan}
Risks surfaced: {DRAFT_B.risks}
Gaps: {DRAFT_B.gaps}
</PLAN_B>

<PLAN_C lens="Dependency-first">
{DRAFT_C.plan}
Risks surfaced: {DRAFT_C.risks}
Gaps: {DRAFT_C.gaps}
</PLAN_C>

<PLAN_D lens="User-first">
{DRAFT_D.plan}
Risks surfaced: {DRAFT_D.risks}
Gaps: {DRAFT_D.gaps}
</PLAN_D>

Scoring axes (1–10 each):
- **completeness** — does it cover what needs covering, or are there obvious holes?
- **practicality** — could a real team actually execute this, or is it hand-wavy?
- **risk_awareness** — does it surface and account for what could go wrong?
- **sequencing** — does the order make sense — do earliest phases unblock later ones?

Return ONLY valid JSON matching this schema (no preamble, no markdown fence):

{
  "scores": [
    {
      "plan_id": "A",
      "completeness": <1-10>,
      "practicality": <1-10>,
      "risk_awareness": <1-10>,
      "sequencing": <1-10>,
      "rationale": "<2-4 sentences explaining the scores, especially anything notable>"
    },
    {"plan_id": "B", ...},
    {"plan_id": "C", ...},
    {"plan_id": "D", ...}
  ]
}

Be willing to give low scores. A plan with all praise and no critique is useless
to the synthesizer. If a plan has a fatal flaw, score accordingly and call it
out in the rationale. Use the full 1–10 range — don't compress everything into 7–9.
```

Collect the 4 results as `JUDGE_1`, `JUDGE_2`, `JUDGE_3`, `JUDGE_4`.

---

## Phase 4: Aggregate scores (deterministic, no subagent)

For each plan (A, B, C, D), compute the mean across the 4 judges for each axis, then a total mean across all axes (16 raw scores per plan → one total). Rank plans by total mean.

Build a `SCOREBOARD` like:

```
Plan A (MVP-first):        7.8  [comp 8.0, prac 8.5, risk 6.5, seq 8.3]
Plan B (Risk-first):       8.4  [comp 8.5, prac 7.5, risk 9.5, seq 8.0]  ← winner
Plan C (Dependency-first): 7.2  [comp 8.0, prac 7.8, risk 6.0, seq 7.0]
Plan D (User-first):       7.5  [comp 7.5, prac 8.0, risk 6.8, seq 7.8]
```

Identify the **winner** (highest total) and the **3 runner-ups**. Collect all 16 rationales (4 per plan, one from each judge) into `JUDGE_NOTES`. Compute the union of all `risks[]` arrays as `ALL_RISKS` and union of all `gaps[]` arrays as `ALL_GAPS` (deduplicate by meaning, not just exact-string match).

Do this in your head / inline — don't spawn a subagent for arithmetic.

---

## Phase 5: Synthesize (1 subagent)

One last Task subagent. Goal: take the winner, polish its structure, graft in clearly-better moves from the runner-ups, surface all collected risks/gaps, and prepend the assumptions + open questions so the user can confirm before executing.

**Subagent prompt:**

```
You are the synthesizer in a planning tournament. Four plans were drafted from
different lenses; four judges scored them. The winner emerged. Your job is to
produce the FINAL plan.

Original scope:
<SCOPE>
{SCOPE JSON}
</SCOPE>

The winning plan ({winner lens}):
<WINNING_PLAN>
{winning DRAFT.plan}
</WINNING_PLAN>

Judge rationales for the winner (4 judges):
<JUDGE_NOTES_FOR_WINNER>
{the 4 rationales scoring the winner}
</JUDGE_NOTES_FOR_WINNER>

The three runner-up plans (graft good moves from these):
<RUNNER_UP_1 lens="{lens}">
{plan, risks, gaps}
</RUNNER_UP_1>
<RUNNER_UP_2 lens="{lens}">
{plan, risks, gaps}
</RUNNER_UP_2>
<RUNNER_UP_3 lens="{lens}">
{plan, risks, gaps}
</RUNNER_UP_3>

Collected risks across all 4 plans (deduplicated):
<ALL_RISKS>
{union of risks[] arrays}
</ALL_RISKS>

Collected gaps across all 4 plans (deduplicated):
<ALL_GAPS>
{union of gaps[] arrays}
</ALL_GAPS>

Produce the final plan as markdown with this structure:

# {Project name}

## Assumptions to confirm
{from SCOPE.assumptions — list with checkboxes so the user can confirm}

## Open questions
{from SCOPE.open_questions — list, each with a brief note on why it matters}

## The plan
{Polished version of the winner. Keep its structure if it's good. Where a
runner-up clearly had a stronger move on a specific dimension, graft it in and
note "(borrowed from {lens} lens)" briefly. Don't average or compromise — pick
the better move and justify it. Use concrete milestones, sequencing rationale,
what's in/out of each phase.}

## Risks and mitigations
{From ALL_RISKS, deduplicated. For each, a one-line mitigation or detection strategy.}

## Open gaps
{From ALL_GAPS, deduplicated. Things needing decisions before or during execution.}

Return ONLY the markdown — no preamble, no JSON envelope, no commentary about
your synthesis process.
```

---

## Final output to the user

Present:

1. **The synthesized plan** (the markdown from Phase 5) as the main response.
2. **A short footer** with the scoreboard so the user understands how the plan was built:

```
---
Built via plan-hunter tournament. Lenses: MVP / Risk / Dependency / User.
Winner: {lens} — total {score}/10
Scoreboard: A {tot} | B {tot} | C {tot} | D {tot}
{N} subagents in {seconds}s
```

If the user asks afterward for a losing draft, the judge rationales, or the raw scope JSON — you've kept them in context and can present them on request.

---

## Failure modes to watch for

- **Subagent returns prose instead of JSON.** Retry once with a stricter "JSON only, no preamble, no markdown fence" reminder. If it fails twice, drop that result and proceed with the others (e.g., 3 judges instead of 4 — averaging still works, just note `n=3` in the scoreboard footer).

- **Unanimous scoring (all plans within 0.3 of each other).** The tournament didn't differentiate. Tell the synthesizer this explicitly so it leans harder on grafting from runner-ups rather than just polishing the winner — the winner won't be meaningfully better than the others.

- **Idea still vague after one round of clarifiers.** Don't ask a second round. Surface it to the user: "I'd want to nail down X before running the tournament — here's what I'd assume; correct me and I'll proceed." Don't burn 10 subagents on a fuzzy prompt.

- **Lens pollution in synthesis.** If the synthesizer's output reads like one of the lens drafts rather than a polished merge, the prompt didn't land. Re-run with stronger emphasis on "this is a final user-facing plan, not another lens take."

- **User wants to iterate.** After presenting, the user often has small adjustments. You don't need to re-run the tournament — just edit the synthesized plan inline. Re-run only if the user fundamentally changed scope or constraints.
