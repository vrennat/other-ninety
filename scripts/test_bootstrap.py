import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent

class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.bin = Path(self.tmp.name) / "bin"
        self.bin.mkdir()
        self.log = Path(self.tmp.name) / "calls"
        for name, body in {
            "git": "exit 0",
            "python3": "exec /usr/bin/python3 \"$@\"",
            "bun": "echo bun >>\"$CALLS\"",
            "pi": "echo pi:$* >>\"$CALLS\"",
            "claude": """echo claude:$* >>\"$CALLS\"
if [ \"$*\" = \"plugin marketplace list --json\" ]; then
  if [ \"${FAKE_EXISTING:-}\" = 1 ]; then echo '[{\"name\":\"other-ninety\",\"repo\":\"vrennat/other-ninety\"}]'
  elif [ \"${FAKE_COLLISION:-}\" = 1 ]; then echo '[{\"name\":\"other-ninety\",\"repo\":\"attacker/other-ninety\"}]'
  else echo '[]'; fi
elif [ \"$*\" = \"plugin list --json\" ]; then
  if [ \"${FAKE_EXISTING:-}\" = 1 ]; then echo '[{\"id\":\"other-ninety@other-ninety\"}]'; else echo '[]'; fi
fi""",
        }.items():
            p = self.bin / name
            p.write_text(f"#!/bin/sh\n{body}\n")
            p.chmod(0o755)
        self.env = {**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}", "CALLS": str(self.log),
                    "HOME": self.tmp.name, "PI_CODING_AGENT_DIR": str(Path(self.tmp.name) / "pi"),
                    "CLAUDE_CONFIG_DIR": str(Path(self.tmp.name) / "claude"),
                    "OTHER_NINETY_STATE_DIR": str(Path(self.tmp.name) / "state")}

    def tearDown(self):
        self.tmp.cleanup()

    def run_bootstrap(self, *args):
        return subprocess.run([str(ROOT / "bootstrap.sh"), *args], cwd=ROOT, env=self.env,
                              text=True, capture_output=True)

    def test_dry_run_does_not_execute_commands(self):
        result = self.run_bootstrap()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.log.exists())
        self.assertIn("no writes", result.stdout)
        self.assertIn("install.sh (dry-run)", result.stdout)

    def test_dry_run_rejects_rollback(self):
        result = self.run_bootstrap("--rollback", "/tmp/manifest.json")
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.log.exists())
        self.assertIn("Unsupported bootstrap option: --rollback", result.stderr)

    def test_apply_runs_dependencies_and_paths(self):
        result = self.run_bootstrap("--apply", "--state-dir", str(Path(self.tmp.name) / "state"))
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("bun", calls)
        self.assertIn("pi:install npm:pi-mcp-adapter@2.26.0", calls)
        self.assertIn("claude:plugin marketplace add vrennat/other-ninety", calls)
        self.assertIn("claude:plugin install other-ninety@other-ninety --scope user", calls)

    def test_apply_updates_existing_plugin(self):
        self.env["FAKE_EXISTING"] = "1"
        result = self.run_bootstrap("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("claude:plugin marketplace update other-ninety", calls)
        self.assertIn("claude:plugin update other-ninety@other-ninety --scope user", calls)

    def test_marketplace_name_collision_adds_expected_source(self):
        self.env["FAKE_COLLISION"] = "1"
        result = self.run_bootstrap("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("claude:plugin marketplace add vrennat/other-ninety", calls)
        self.assertNotIn("claude:plugin marketplace update other-ninety", calls)

    def test_missing_prerequisite_fails(self):
        (self.bin / "bun").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        result = self.run_bootstrap()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing prerequisite: bun", result.stderr)

if __name__ == "__main__":
    unittest.main()
