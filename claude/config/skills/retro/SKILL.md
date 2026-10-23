---
name: retro
description: Retrospective on the agent's environment after a session, not on the code. Reads the transcript and proposes changes to navigation pointers, automated checks, reviewer rules, always-loaded text, tool economy, and information access, ranked by severity.
disable-model-invocation: true
license: MIT
metadata:
  source: https://github.com/mattpocock/skills (retro)
---

# retro

Improve the environment the agent works in so the next run goes better. The code is not under review here; the instructions, checks, tools, and access around the agent are.

## Procedure

1. **Pick the session.** Default to the current one. For another, find its transcript under `~/.claude/projects/<escaped-cwd>/<session-id>.jsonl`; `ls -t` finds the newest. Read the main thread: user turns, tool calls, and results. Sidechains are subagents; read one only when a candidate points at it.

2. **Collect candidates** in these categories. Each names the evidence that makes it apply.
   - **Navigation.** The agent spent several calls finding a file or a fact. Candidate: a pointer in the repo CLAUDE.md, or in a doc it already points to.
   - **Automated checks.** A mistake that a typecheck, lint, test, or filesystem rule would have caught. Candidate: the check, wired into the verify step.
   - **Reviewer rules.** A mistake independent review should have caught. Candidate: a rule on the reviewer. The implementer carries the context pressure; the reviewer reads a diff and can afford standards.
   - **Always-loaded text.** A steering line that belongs in a check or a reviewer rule instead, or one the session shows did not change behavior. Settle a disputed no-op by running a session without the line, not by debate.
   - **Tool economy.** An expensive call, a polling loop, or a token-heavy tool with a cheaper equivalent (background Bash plus Monitor, a targeted grep, a smaller model for mechanical work).
   - **Information access.** A fact the agent needed and could not reach: dev server logs, a third-party service, a dashboard. Candidate: read-only access or a tee.
   - **Session shape.** Work that could have run from a written brief ran interactively.
   - **Scratch helpers.** Run `~/.claude/skills/retro/scripts/scratch-helpers.py <transcript.jsonl>`. It lists helper scripts the session wrote to /tmp or the scratchpad and reused three or more times. For each, the candidate is: promote it to the repo's `scripts/` with a usage line, or leave it.

3. **Present the candidates** in order of severity: one line each with what the session showed (turn or timestamp), the proposed change, and where it goes. Deletions count as candidates. End with the one to do first.

## Cross-session mode

When asked to audit many sessions (a week, a month, every repo), mine first, then read only what the numbers point at. The scripts live in `~/.claude/skills/retro/scripts/` and write to `~/.local/state/session-audit/data` (override with `AUDIT_DATA`; never inside a repo, since transcripts can hold pasted secrets and the miner's redaction is pattern-based).

1. `AUDIT_EXCLUDE=<this session id> python3 mine.py` flattens every transcript under `~/.claude/projects` into tool calls, human messages, and per-session stats (about 2 s for 2 GB).
2. `python3 analyze.py [YYYY-MM-DD]` prints error classes, retry chains, repeated commands, one-off scripts, and user corrections since the date, and writes extracts beside the data.
3. `python3 ctx.py <session> [call-index] [--before N] [--after M] [--full]` prints the context around one signal. Cite findings as `<session>[<index>]`.
4. Fan out read-only reviewers by theme when the volume calls for it; each reads the extracts, not raw transcripts.
5. Compare against the last audit's report so a fix's acceptance check (a count that should drop) is confirmed or refuted. The 2026-10-09 baseline is `~/Developer/session-audit/REPORT.md`; rerun about monthly.

Known limits: the correction regex is about 90% precise; nested-memory attachments are unreliable in main-session transcripts; Codex and pi transcripts need their own adapters. Cost and token usage per week is a separate job (`manabase/scripts/session-audit`, Sunday launchd).

## Rules

- The repo CLAUDE.md holds navigation pointers and the few rules every turn needs. Docs hold reference material. Skills hold either knowledge the model should find by description, or user-invoked procedures like this one.
- Evidence is the transcript. A candidate with no turn behind it is a guess; label it as one.
- This is a proposal. The user decides what lands. `/trim` handles what to delete from a file.
