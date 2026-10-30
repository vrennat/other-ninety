# Verification

Two checks that are easy to skip and expensive to miss:

- **An instrument's silence is not evidence.** Before reporting "no occurrences of X", feed the log, grep, or watch a known positive first and show that it was caught.
- **Check the baseline first.** Before accepting a diagnosis, including one handed over as fact, confirm the unmodified baseline does not already show the problem.

"I could not verify this, because …" is a valid result. Do not present a weaker test as the strong one.

## Verification receipt

Keep a compact receipt in the final report or a linked review artifact. For small changes, a few lines suffice; do not create a tracking system. Record:

- Baseline commit and final commit or tree. If work is uncommitted, identify the diff and untracked inputs; do not imply HEAD includes them. Record verification before committing, then bind the receipt to the resulting commit; rerun affected checks after any subsequent content change.
- Requested behavior checked, and existing behavior that must remain intact, as separate acceptance checks.
- For each check: exact command, working directory, exit status, observed result, and relevant output or artifact link. Distinguish directly observed evidence from an agent's summary. Keep secrets and private runtime data out of receipts.
- Changed or deleted tests and why they remain adequate. For high stakes, use proportionate baseline regression checks against the final code in an isolated copy when feasible; preserve legitimate test updates and explain incompatible baseline tests. Missing decisive regression evidence makes the result INCONCLUSIVE.
- Overall verdict: PASS only when all decisive acceptance checks have adequate passing evidence; FAIL when a decisive check demonstrates a defect; INCONCLUSIVE when decisive evidence is missing, skipped, stale, or cannot be trusted. A known failure takes precedence over missing evidence. Explain gaps without substituting weaker checks. Optional checks may be skipped with reasons without blocking PASS.

FAIL and INCONCLUSIVE do not mean ready for review or complete. A receipt records evidence; it does not create an isolation boundary or prove independence.
