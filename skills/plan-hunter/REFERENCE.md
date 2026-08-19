# Plan Hunter reference

Use the active runtime's native subagent mechanism. Launch agents in parallel
where directed. Every subagent should return only the requested artifact.

## 1. Scope

Give one subagent the user's planning request and any clarification answers:

```text
You are the Scope agent for a planning tournament. Normalize the request below.
Return only valid JSON, with no markdown fence.

<REQUEST>
{request and clarification answers}
</REQUEST>

{
  "normalized_idea": "<one concrete paragraph>",
  "goals": ["<observable outcome>"],
  "constraints": ["<hard limit>"],
  "assumptions": ["<unconfirmed assumption>"],
  "open_questions": ["<decision that needs user input>"]
}

Do not invent precision. Put missing information in assumptions or questions.
```

Save the JSON as `SCOPE` and pass it unchanged to every draft agent.

## 2. Draft

Launch four subagents in parallel with the same scope and one lens each:

- MVP-first: smallest shippable version; explicitly defer the rest.
- Risk-first: prove the riskiest assumptions before dependencies accumulate.
- Dependency-first: expose the critical path and parallel work.
- User-first: sequence capabilities around a useful end-to-end journey.

Use this prompt for each lens:

```text
You are a planning agent applying the {LENS} lens.

Lens: {LENS_DESCRIPTION}

<SCOPE>
{SCOPE}
</SCOPE>

Return only valid JSON:
{
  "plan": "<standalone markdown plan with phases and milestones>",
  "risks": ["<risk surfaced by this lens>"],
  "gaps": ["<missing decision or information>"]
}

Be concrete about scope, sequencing, dependencies, and why this order wins.
Commit to the lens; the synthesizer will balance the final result.
```

## 3. Judge

Launch four judges in parallel. Give each judge all four draft plans, risks, and
gaps in labeled blocks and use the same prompt:

```text
You are an independent judge in a planning tournament. Score every supplied
plan from 1 to 10 on completeness, practicality, risk_awareness, and sequencing.
Use the full range and call out fatal flaws. Return only valid JSON:

{
  "scores": [
    {
      "plan_id": "A",
      "completeness": 1,
      "practicality": 1,
      "risk_awareness": 1,
      "sequencing": 1,
      "rationale": "<two to four sentences>"
    }
  ]
}
```

The array must contain A, B, C, and D exactly once.

## 4. Aggregate

For each draft, average the four judges' score on each axis and average the four
axis means into a total. Rank by total. Deduplicate all draft risks and gaps by
meaning. Retain every judge rationale for synthesis.

## 5. Synthesize

Give one subagent the scope, winning plan, all judge notes, all runners-up, and
the deduplicated risks and gaps:

```text
Produce the final user-facing plan in markdown. Polish the winner. Where a
runner-up has a clearly better move, graft it in and briefly identify its lens.
Do not average conflicting choices: choose and justify the stronger one.

Use this structure:
# {Project name}
## Assumptions to confirm
## Open questions
## The plan
## Risks and mitigations
## Open gaps

Return markdown only, with no preamble.
```

Append a short scoreboard with the winning lens and all four totals.

## Failure handling

- Retry invalid JSON once with a stricter JSON-only reminder. If it fails twice,
  drop that result and disclose the reduced sample.
- If all totals are within 0.3, tell the synthesizer the tournament did not
  differentiate and favor the best individual moves across drafts.
- Ask at most one clarification round. Proceed with explicit assumptions after
  that.
- Iterate on small user changes without rerunning the tournament. Rerun only
  when the scope or constraints change materially.
