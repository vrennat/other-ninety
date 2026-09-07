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
   - **Reviewer rules.** A mistake `adversarial-reviewer` or `/code-review` should have caught. Candidate: a rule on the reviewer. The implementer carries the context pressure; the reviewer reads a diff and can afford standards.
   - **Always-loaded text.** A steering line that belongs in a check or a reviewer rule instead, or one the session shows did not change behavior. Settle a disputed no-op by running a session without the line, not by debate.
   - **Tool economy.** An expensive call, a polling loop, or a token-heavy tool with a cheaper equivalent (background Bash plus Monitor, a targeted grep, a smaller model for mechanical work).
   - **Information access.** A fact the agent needed and could not reach: dev server logs, a third-party service, a dashboard. Candidate: read-only access or a tee.
   - **Session shape.** The focus hook nudged and the session kept going, or work that could have run from a written brief ran interactively. Evidence lives in `~/.local/state/other-ninety/focus.log`.

3. **Present the candidates** in order of severity: one line each with what the session showed (turn or timestamp), the proposed change, and where it goes. Deletions count as candidates. End with the one to do first.

## Rules

- The repo CLAUDE.md holds navigation pointers and the few rules every turn needs. Docs hold reference material. Skills hold either knowledge the model should find by description, or user-invoked procedures like this one.
- Evidence is the transcript. A candidate with no turn behind it is a guess; label it as one.
- This is a proposal. The user decides what lands. `/trim` handles what to delete from a file.
