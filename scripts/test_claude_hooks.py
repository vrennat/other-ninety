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
CANONICAL_OUTPUT_STYLE = (ROOT / "shared" / "output-style.md").read_text().strip()


class HookTests(unittest.TestCase):
    def run_hook(self, name, payload, config, *, cwd=None, extra_env=None):
        env = {**os.environ, "CLAUDE_CONFIG_DIR": str(config), **(extra_env or {})}
        return subprocess.run(
            [str(HOOKS / name)], input=json.dumps(payload), text=True,
            capture_output=True, env=env, cwd=cwd,
        )

    def test_session_start_registry_and_other_sessions(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            old = (config / "sessions-active.md")
            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            old.write_text(f"{now} | other | /repo\n")
            result = self.run_hook(
                "session-intent.sh",
                {"hook_event_name": "SessionStart", "session_id": "current", "cwd": "/work"},
                config,
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("current", old.read_text())
            self.assertIn("other", result.stdout)

    def test_session_end_removes_current_session(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            registry = config / "sessions-active.md"
            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            registry.write_text(f"{now} | current | /work\n")
            result = self.run_hook(
                "session-intent.sh",
                {"hook_event_name": "SessionEnd", "session_id": "current", "cwd": "/work"},
                config,
            )
            self.assertEqual(result.returncode, 0)
            self.assertNotIn("current", registry.read_text())

    def test_null_session_id_is_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            result = self.run_hook(
                "session-intent.sh",
                {"hook_event_name": None, "session_id": None, "cwd": None},
                config,
            )
            self.assertEqual(result.returncode, 0)
            self.assertFalse((config / "sessions-active.md").exists())

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

    def test_plugin_session_start_needs_no_bun_and_injects_output_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            mode_dir = project / ".claude"
            mode_dir.mkdir()
            (mode_dir / "other-ninety-mode").write_text("autonomous\n")
            result = subprocess.run(
                [sys.executable, str(PLUGIN_HOOK)],
                capture_output=True,
                text=True,
                env={
                    "PATH": "/usr/bin:/bin",
                    "CLAUDE_PROJECT_DIR": str(project),
                },
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            context = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
            self.assertIn("Mode: autonomous", context)
            self.assertIn(CANONICAL_OUTPUT_STYLE, context)

            hook_config = json.loads(
                (ROOT / "claude" / "plugin" / "hooks" / "hooks.json").read_text()
            )
            command = hook_config["hooks"]["SessionStart"][0]["hooks"][0]["command"]
            self.assertTrue(command.startswith("python3 "), command)
            self.assertNotIn("bun", command)


if __name__ == "__main__":
    unittest.main()
