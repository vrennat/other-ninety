#!/usr/bin/env python3
"""Run one constrained, ephemeral Pi leaf worker."""

import os
import shutil
import subprocess
import sys
from pathlib import Path


LEAF_RULES = """
You are a leaf worker. Do not spawn nested agents. Do not commit, push, deploy,
or perform destructive actions. Work only on the requested task and report what
you found or changed. Do not expand scope.
Your final message is the only thing the caller sees. Be terse and dense; lead
with anything that blocks. Do not include file contents, diffs, or narration of
the commands you ran. "I could not verify this and here is precisely why" is an
acceptable report; do not run a weaker check and present it as the requested
one.
""".strip()


def find_model_policy() -> Path:
    override = os.environ.get("OTHER_NINETY_PI_MODEL_POLICY")
    if override:
        policy = Path(override).expanduser()
    else:
        config_dir = Path(
            os.environ.get("PI_CODING_AGENT_DIR", Path.home() / ".pi" / "agent")
        ).expanduser()
        policy = config_dir / "extensions" / "model-policy.ts"
    if not policy.is_file():
        raise FileNotFoundError(
            f"delegated-worker model policy not found at {policy}; install o90 with Pi"
        )
    return policy.resolve()


def main() -> int:
    write = len(sys.argv) == 2 and sys.argv[1] == "--write"
    if len(sys.argv) not in (1, 2) or (len(sys.argv) == 2 and not write):
        print("usage: pi_worker.py [--write]", file=sys.stderr)
        return 2
    task = sys.stdin.read().strip()
    if not task:
        print("empty task", file=sys.stderr)
        return 2
    if os.environ.get("PI_CODING_AGENT") or os.environ.get("OTHER_NINETY_PI_LEAF"):
        print("refusing recursive Pi leaf invocation", file=sys.stderr)
        return 2
    pi = shutil.which("pi")
    if not pi:
        print("pi executable not found", file=sys.stderr)
        return 127
    try:
        model_policy = find_model_policy()
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 2

    tools = "read,grep,find,ls" + (",edit,write" if write else "")
    args = [
        pi, "--print", "--no-session", "--no-context-files", "--no-extensions",
        "--extension", str(model_policy),
        "--no-skills", "--no-prompt-templates", "--no-themes", "--no-approve",
        "--tools", tools, "--append-system-prompt", LEAF_RULES,
    ]
    for variable, flag in (("OTHER_NINETY_PI_PROVIDER", "--provider"),
                           ("OTHER_NINETY_PI_MODEL", "--model"),
                           ("OTHER_NINETY_PI_THINKING", "--thinking")):
        if os.environ.get(variable):
            args += [flag, os.environ[variable]]
    env = os.environ.copy()
    env["OTHER_NINETY_PI_LEAF"] = "1"
    env["PI_SKIP_VERSION_CHECK"] = "1"
    try:
        result = subprocess.run(
            args + ["Complete the task supplied on stdin."],
            input=task,
            text=True,
            env=env,
            timeout=600,
        )
    except subprocess.TimeoutExpired:
        print("Pi leaf timed out", file=sys.stderr)
        return 124
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
