---
name: summarize
description: 'One-shot catch-up in the ADHD shape: what got done, where we are, the one next action. With an argument, summarize that file, PR, or doc in the same shape. One response; does not turn on the persistent i-have-adhd mode.'
disable-model-invocation: true
license: MIT
metadata:
  source: https://github.com/ayghri/i-have-adhd
---

# summarize

One-shot state restatement for a reader with ADHD. Companion to `i-have-adhd`: same shape, one response, no mode change.

## Output shape

Exactly these blocks, in this order, nothing else:

```
Done: <concrete wins this session, max 3 lines>
Now:  <current step — "step 3 of 5: backfilling the column" — or "idle">
Next: <ONE action doable in under two minutes>
Open: <blockers or questions only the reader can answer, max 2 — omit if none>
```

## Rules

1. State only what happened. If part of the state is unknown (compacted context, another session's work), write "unknown" — never a plausible guess.
2. Concrete over categorical. "Login works with magic links, try `/login`" — not "made auth changes."
3. Next is exactly one action, doable now. Not a plan, not a list.
4. If Done or Open overflows its cap, keep the most urgent entries and end that block with "+N more — ask if you want them."
5. No preamble, no recap of the recap, no closing pleasantries.

## With an argument

`/summarize <path | PR | URL | topic>`: read the thing, then apply the same discipline to it:

1. First line: what it is, one sentence, plus the action it implies if any.
2. The at-most-5 points that matter, numbered, ranked, one line each.
3. If it demands something from the reader, end with `Next: <one action>`.

Skip anything that changes nothing for the reader. No section-by-section walkthrough.

## Relation to i-have-adhd

This is one response, then back to the session's current style. If the reader keeps losing the thread turn after turn, offer once: "Want `/i-have-adhd` on for the rest of the session?"
