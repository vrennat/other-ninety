import json
import os
from datetime import datetime, timezone
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parent.parent
HOOKS = ROOT / "claude" / "config" / "hooks"
PLUGIN_HOOK = ROOT / "claude" / "plugin" / "hooks" / "session-start.py"


class HookTests(unittest.TestCase):
    def run_hook(self, name, payload, config, *, cwd=None, extra_env=None):
        env = {**os.environ, "CLAUDE_CONFIG_DIR": str(config), **(extra_env or {})}
        return subprocess.run(
            [str(HOOKS / name)], input=json.dumps(payload), text=True,
            capture_output=True, env=env, cwd=cwd,
        )

    def write_session(self, config, pid, session_id, cwd):
        sessions = config / "sessions"
        sessions.mkdir(exist_ok=True)
        (sessions / f"{session_id}.json").write_text(json.dumps(
            {"pid": pid, "sessionId": session_id, "cwd": str(cwd), "name": f"name-{session_id}",
             "procStart": "Tue Sep  1 18:00:00 2026"}
        ))

    def test_session_start_lists_live_sessions_in_same_repo_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "config"
            config.mkdir()
            repo = root / "repo"
            repo.mkdir()
            subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True)
            subprocess.run(["git", "-c", "user.email=tester", "-c", "user.name=t",
                            "commit", "-q", "--allow-empty", "-m", "init"], cwd=repo, check=True)
            worktree = root / "wt"
            subprocess.run(["git", "worktree", "add", "-q", str(worktree), "-b", "feature"], cwd=repo, check=True)
            elsewhere = root / "elsewhere"
            elsewhere.mkdir()
            dead = subprocess.Popen(["true"])
            dead.wait()
            live = os.getpid()
            self.write_session(config, live, "current", repo)
            self.write_session(config, live, "same-repo-worktree", worktree)
            self.write_session(config, live, "other-repo", elsewhere)
            self.write_session(config, dead.pid, "dead-same-repo", repo)
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": "SessionStart", "session_id": "current", "cwd": str(repo)},
                config,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"| name-same-repo-worktree | pid {live} | {worktree}", result.stdout)
            self.assertNotIn("name-current", result.stdout)
            self.assertNotIn("name-other-repo", result.stdout)
            self.assertNotIn("name-dead-same-repo", result.stdout)
            self.assertEqual(result.stdout.count(f"| pid {live} |"), 1, result.stdout)
            self.assertNotIn(f"| pid {dead.pid} |", result.stdout)

    def test_session_start_without_registry_prints_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": "SessionStart", "session_id": "current", "cwd": directory},
                Path(directory),
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")

    def test_null_session_id_is_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": None, "session_id": None, "cwd": None},
                config,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")

    def test_null_cwd_uses_current_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "config"
            work = root / "work"
            fake_bin = root / "bin"
            config.mkdir()
            work.mkdir()
            fake_bin.mkdir()
            git = fake_bin / "git"
            git.write_text("""#!/bin/sh
[ "$1" = -C ] && [ "$2" = "$EXPECTED_CWD" ] || exit 1
case "$*" in
  *"rev-parse --git-dir") exit 0 ;;
  *"rev-parse --abbrev-ref HEAD") echo main ;;
  *"fetch origin main") exit 0 ;;
  *"merge-base --is-ancestor origin/main HEAD") exit 1 ;;
  *"rev-list --count"*) echo 1 ;;
  *) exit 1 ;;
esac
""")
            git.chmod(0o755)
            result = self.run_hook(
                "pre-push-guard.sh",
                {"tool_name": "Bash", "tool_input": {"command": "git push origin main", "cwd": None}},
                config,
                cwd=work,
                extra_env={"PATH": f"{fake_bin}:{os.environ['PATH']}", "EXPECTED_CWD": str(work.resolve())},
            )
            self.assertEqual(result.returncode, 2, result.stderr)

    def test_force_push_main_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_hook(
                "pre-push-guard.sh",
                {"tool_name": "Bash", "tool_input": {"command": "git push --force origin main"}},
                Path(directory),
            )
            self.assertEqual(result.returncode, 2)

    def test_non_bash_payload_allows(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_hook("pre-push-guard.sh", {"tool_name": "Read"}, Path(directory))
            self.assertEqual(result.returncode, 0)

    def test_plugin_session_start_needs_no_bun_and_injects_routing(self):
        result = subprocess.run(
            [sys.executable, str(PLUGIN_HOOK)],
            capture_output=True,
            text=True,
            env={"PATH": "/usr/bin:/bin"},
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["hookSpecificOutput"]["hookEventName"], "SessionStart")
        context = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("<other-ninety>", context)
        self.assertIn("adversarial-reviewer", context)
        self.assertIn("/impl", context)
        self.assertNotIn("Mode:", context)
        self.assertLess(len(context), 1200)

        hook_config = json.loads((ROOT / "claude" / "plugin" / "hooks" / "hooks.json").read_text())
        command = hook_config["hooks"]["SessionStart"][0]["hooks"][0]["command"]
        self.assertTrue(command.startswith("python3 "), command)
        self.assertNotIn("bun", command)


if __name__ == "__main__":
    unittest.main()
