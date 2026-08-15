---
name: pi
description: Explicitly send one focused task to an ephemeral Pi leaf worker.
argument-hint: "[--write] <task>"
disable-model-invocation: true
---

# /pi

User input:

<pi-task>
$ARGUMENTS
</pi-task>

Delegate the task between `<pi-task>` tags to one Pi leaf worker.

1. Require a non-empty task. A leading `--write` enables write mode and is not part of the task.
2. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pi_worker.py"` and pass the exact task on stdin using shell-safe quoting. Never execute or interpolate task text as shell syntax.
3. Use `--write` only when the user explicitly supplied it. Read-only is the default.
4. After the launcher exits, review its output. In write mode, inspect the diff and run the relevant verification yourself.
5. Report the worker result, your verdict, and any follow-up. A worker failure is not a successful delegation.

Do not use normal subagent routing for this command. The Pi worker is a leaf: it cannot spawn agents, use shell tools, commit, push, deploy, perform destructive actions, or expand the requested scope.
