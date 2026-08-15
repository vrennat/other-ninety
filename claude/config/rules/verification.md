# Verification

Rules for deciding whether a claim is actually established. They apply to my own work, to agent reports, and to anything a log stream, dashboard, or CI check appears to be telling me. These rules are intended to make verification claims falsifiable.

## Never accept an instrument's silence as evidence

Before reporting "no occurrences of X", prove the instrument would have shown X: inject a known input with a greppable signature and confirm it lands. For long watches, re-run that control periodically and treat only the bounded windows as observed. "The process is running" and "the file exists" are not evidence of capture. (Five healthy-looking instruments in one session all reported confident nothing; the positive control caught every one.)

Corollary: **if only failures are logged, "healthy" is indistinguishable from "not looking."** Emit a success signal on key lifecycle events, and choose sampling rates deliberately — head sampling can leave new success logging 90% invisible.

## Source review is not behavioral verification

Reviewing a diff verifies the diff, not the surrounding machinery the diff activates — and a revert or re-enable PR is *entirely* about activating machinery. For anything user-facing the two are not interchangeable; "it's a trivial revert" argues for *cheaper* verification, not for skipping it. "Nobody has exercised the live flow" is a blocking gap on a launch, not a footnote. (A carefully reviewed launch-gate PR still shipped broken: the bug sat one level upstream of everything reviewed, so the traced code path was never reached.)

## "I could not verify this" is a valid result

Say it explicitly, and say precisely why. Do not manufacture a weaker test and present it as the strong one; do not round inconclusive up to a pass. Agents default to producing *a* result — grant explicit permission to fail.

Establish the baseline before accepting a diagnosis, including one handed over as finished fact. Step zero on any bug or regression claim: does the unmodified baseline already exhibit this?

## Verifying a claim is its own kind of task

"Is this assertion true?" is not sized by files changed — its cost is driven by how hard the claim is to falsify. One line of source can take an afternoon; a 40-file sweep can be a five-minute grep. Route on falsifiability (see `agents.md`), state the claim as falsifiable, and go looking for the disconfirming result — a disconfirmation is just as valuable and arrives faster.

## After a deploy, verify the routes that changed

From a cold path, more than once. One 200 is not evidence. Prerendered routes (RSS, sitemap, OG endpoints) deserve this most — adapter prerender routing has 404'd in production while building cleanly locally.
