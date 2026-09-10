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


def capture_login_shell_env(timeout: float = 20.0) -> dict:
    """Capture env vars the user's interactive login shell would set.

    Calling harnesses commonly invoke this script through a non-interactive
    shell, so PATH (Node version) and provider credentials exported from
    dotfiles that only load interactively (~/.zshrc, a sourced secrets file)
    never reach os.environ here even when they're configured and valid.
    Shell out once and use what a real interactive shell reports instead of
    guessing which dotfile a given machine uses.
    """
    shell = os.environ.get("SHELL") or "/bin/zsh"
    try:
        result = subprocess.run(
            [shell, "-ic", "env -0"],
            capture_output=True,
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {}
    if result.returncode != 0 or not result.stdout:
        return {}
    captured = {}
    for pair in result.stdout.split(b"\0"):
        if not pair:
            continue
        key, sep, value = pair.partition(b"=")
        if not sep:
            continue
        try:
            captured[key.decode()] = value.decode()
        except UnicodeDecodeError:
            continue
    return captured


def find_model_policy(env: dict) -> Path:
    override = env.get("OTHER_NINETY_PI_MODEL_POLICY")
    if override:
        policy = Path(override).expanduser()
    else:
        config_dir = Path(
            env.get("PI_CODING_AGENT_DIR", str(Path.home() / ".pi" / "agent"))
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

    env = os.environ.copy()
    env.update(capture_login_shell_env())

    pi = shutil.which("pi", path=env.get("PATH"))
    if not pi:
        print("pi executable not found", file=sys.stderr)
        return 127
    try:
        model_policy = find_model_policy(env)
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
        if env.get(variable):
            args += [flag, env[variable]]
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
