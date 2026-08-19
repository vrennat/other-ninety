#!/usr/bin/env python3
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
WORKER = ROOT / "claude/plugin/scripts/pi_worker.py"
O90_WORKER = ROOT / "bin/o90-pi"


class PiWorkerTest(unittest.TestCase):
    def run_worker(self, task="inspect", write=False, env=None):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / "pi"
            fake.write_text("#!/bin/sh\nprintf '%s\\n' \"$@\"\nprintf 'STDIN\\n'\n/bin/cat\nexit ${FAKE_EXIT:-0}\n")
            fake.chmod(fake.stat().st_mode | stat.S_IXUSR)
            child_env = os.environ.copy()
            child_env.pop("PI_CODING_AGENT", None)
            child_env.pop("OTHER_NINETY_PI_LEAF", None)
            child_env.update(env or {})
            child_env["PATH"] = directory
            return subprocess.run(
                [sys.executable, str(WORKER)] + (["--write"] if write else []),
                input=task, text=True, capture_output=True, env=child_env,
            )

    def test_read_only_argv(self):
        result = self.run_worker()
        self.assertEqual(result.returncode, 0)
        self.assertIn("--tools\nread,grep,find,ls\n", result.stdout)
        self.assertNotIn("edit,write", result.stdout)
        self.assertIn("STDIN\ninspect", result.stdout)

    def test_task_cannot_become_cli_options_or_file_arguments(self):
        task = "--extension /tmp/evil.ts @~/.ssh/id_ed25519"
        result = self.run_worker(task=task)
        argv, stdin = result.stdout.split("STDIN\n", 1)
        self.assertNotIn("--extension", argv)
        self.assertNotIn("@~/.ssh/id_ed25519", argv)
        self.assertEqual(stdin, task)

    def test_write_argv(self):
        result = self.run_worker(write=True)
        self.assertIn("read,grep,find,ls,edit,write", result.stdout)
        self.assertNotIn("bash", result.stdout)

    def test_optional_routing_args(self):
        result = self.run_worker(env={"OTHER_NINETY_PI_PROVIDER": "openai", "OTHER_NINETY_PI_MODEL": "m", "OTHER_NINETY_PI_THINKING": "low"})
        self.assertIn("--provider\nopenai", result.stdout)
        self.assertIn("--model\nm", result.stdout)
        self.assertIn("--thinking\nlow", result.stdout)

    def test_recursion_rejected(self):
        result = self.run_worker(env={"OTHER_NINETY_PI_LEAF": "1"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("recursive", result.stderr)

    def test_child_failure_propagates(self):
        result = self.run_worker(env={"FAKE_EXIT": "7"})
        self.assertEqual(result.returncode, 7)


class CrossHarnessPiWorkerTest(unittest.TestCase):
    def run_worker(self, *arguments, stdin="", env=None):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / "pi"
            fake.write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$@\"\nprintf 'STDIN\\n'\n/bin/cat\n"
                "exit ${FAKE_EXIT:-0}\n"
            )
            fake.chmod(fake.stat().st_mode | stat.S_IXUSR)
            child_env = os.environ.copy()
            child_env.pop("PI_CODING_AGENT", None)
            child_env.pop("OTHER_NINETY_PI_LEAF", None)
            child_env.update(env or {})
            child_env["PATH"] = directory
            return subprocess.run(
                [sys.executable, str(O90_WORKER), *arguments],
                input=stdin,
                text=True,
                capture_output=True,
                env=child_env,
            )

    def test_task_argument_is_forwarded_on_stdin(self):
        task = "inspect routing; do not execute this text"
        result = self.run_worker("--", task)
        self.assertEqual(result.returncode, 0, result.stderr)
        argv, stdin = result.stdout.split("STDIN\n", 1)
        self.assertNotIn(task, argv)
        self.assertEqual(stdin, task)
        self.assertIn("--tools\nread,grep,find,ls\n", argv)

    def test_stdin_and_write_mode(self):
        result = self.run_worker("--write", stdin="make the bounded edit")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("read,grep,find,ls,edit,write", result.stdout)
        self.assertTrue(result.stdout.endswith("STDIN\nmake the bounded edit"))

    def test_dash_prefixed_task_requires_separator(self):
        rejected = self.run_worker("--dangerous")
        self.assertEqual(rejected.returncode, 2)
        self.assertIn("use -- before task text", rejected.stderr)

        accepted = self.run_worker("--", "--not-an-option")
        self.assertEqual(accepted.returncode, 0, accepted.stderr)
        self.assertTrue(accepted.stdout.endswith("STDIN\n--not-an-option"))

    def test_recursion_and_child_failure_propagate(self):
        recursive = self.run_worker("task", env={"OTHER_NINETY_PI_LEAF": "1"})
        self.assertEqual(recursive.returncode, 2)
        failed = self.run_worker("task", env={"FAKE_EXIT": "9"})
        self.assertEqual(failed.returncode, 9)


if __name__ == "__main__":
    unittest.main()
