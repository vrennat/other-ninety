import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent
PUBLIC_SKILLS = {
    "clean-writing",
    "onboarding",
    "plan-hunter",
    "systematic-debugging",
    "verification-before-completion",
}
PUBLIC_AGENTS = {
    "adversarial-reviewer",
    "brutal-code-reviewer",
    "debug-genius",
    "fast-impl",
    "validator",
}

class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.bin = Path(self.tmp.name) / "bin"
        self.bin.mkdir()
        self.log = Path(self.tmp.name) / "calls"
        for name, body in {
            "git": "exit 0",
            "python3": "if [ \"${FAKE_OLD_PYTHON:-}\" = 1 ] && [ \"${1:-}\" = -c ]; then exit 1; fi\nexec /usr/bin/python3 \"$@\"",
            "bun": "echo bun >>\"$CALLS\"",
            "pi": "echo pi:$* >>\"$CALLS\"",
            "codex": "echo codex:$* >>\"$CALLS\"",
            "cursor": "echo cursor:$* >>\"$CALLS\"",
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
        result = self.run_bootstrap(
            "--apply", "--with", "claude", "--with", "pi",
            "--state-dir", str(Path(self.tmp.name) / "state")
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("bun", calls)
        self.assertIn("pi:install npm:pi-mcp-adapter@2.26.0", calls)
        self.assertIn("claude:plugin marketplace add vrennat/other-ninety", calls)
        self.assertIn("claude:plugin install other-ninety@other-ninety --scope user", calls)
        self.assertIn("Next: restart selected runtimes", result.stdout)
        self.assertIn("Optional Pi smoke check", result.stdout)

    def test_apply_updates_existing_plugin(self):
        self.env["FAKE_EXISTING"] = "1"
        result = self.run_bootstrap("--apply", "--with", "claude")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("claude:plugin marketplace update other-ninety", calls)
        self.assertIn("claude:plugin update other-ninety@other-ninety --scope user", calls)

    def test_marketplace_name_collision_adds_expected_source(self):
        self.env["FAKE_COLLISION"] = "1"
        result = self.run_bootstrap("--apply", "--with", "claude")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("claude:plugin marketplace add vrennat/other-ninety", calls)
        self.assertNotIn("claude:plugin marketplace update other-ninety", calls)

    def test_old_python_fails(self):
        self.env["FAKE_OLD_PYTHON"] = "1"
        result = self.run_bootstrap()
        self.assertEqual(result.returncode, 1)
        self.assertIn("Python 3.9 or newer is required", result.stderr)

    def test_missing_prerequisite_fails(self):
        (self.bin / "bun").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        result = self.run_bootstrap()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing prerequisite for Pi component: bun", result.stderr)

    def test_default_apply_is_pi_only(self):
        result = self.run_bootstrap("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("pi:install", calls)
        self.assertNotIn("claude:", calls)
        self.assertIn("Components: Pi", result.stdout)
        self.assertNotIn("Claude marketplace", result.stdout)

    def test_codex_and_cursor_components_install_without_claude(self):
        project = Path(self.tmp.name) / "project"
        project.mkdir()
        result = self.run_bootstrap(
            "--apply",
            "--with", "codex",
            "--with", "cursor",
            "--cursor-project", str(project),
            "--codex-dir", str(Path(self.tmp.name) / "codex"),
            "--agents-dir", str(Path(self.tmp.name) / "agents"),
            "--bin-dir", str(Path(self.tmp.name) / "bin-target"),
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((Path(self.tmp.name) / "codex" / "AGENTS.md").is_symlink())
        self.assertTrue((project / ".cursor" / "rules" / "o90.mdc").is_file())
        calls = self.log.read_text() if self.log.exists() else ""
        self.assertNotIn("claude:", calls)
        self.assertNotIn("pi:", calls)
        self.assertNotIn("bun", calls)
        self.assertIn("Components: Codex + Cursor", result.stdout)

    def test_claude_only_needs_no_pi_or_bun(self):
        (self.bin / "pi").unlink()
        (self.bin / "bun").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        result = self.run_bootstrap("--apply", "--with", "claude")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((Path(self.tmp.name) / "claude" / "CLAUDE.md").is_symlink())
        self.assertFalse((Path(self.tmp.name) / "pi").exists())
        self.assertNotIn("Optional Pi smoke check", result.stdout)
        calls = self.log.read_text()
        self.assertIn("claude:plugin install other-ninety@other-ninety --scope user", calls)
        self.assertEqual(
            {path.parent.name for path in (ROOT / "claude" / "plugin" / "skills").glob("*/SKILL.md")},
            PUBLIC_SKILLS,
        )
        self.assertEqual(
            {path.stem for path in (ROOT / "claude" / "plugin" / "agents").glob("*.md")},
            PUBLIC_AGENTS,
        )

    def test_codex_only_needs_no_pi_or_bun(self):
        (self.bin / "pi").unlink()
        (self.bin / "bun").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        result = self.run_bootstrap(
            "--apply", "--with", "codex",
            "--codex-dir", str(Path(self.tmp.name) / "codex"),
            "--agents-dir", str(Path(self.tmp.name) / "agents"),
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in PUBLIC_SKILLS:
            self.assertTrue((Path(self.tmp.name) / "agents" / "skills" / name).is_symlink(), name)
        for name in PUBLIC_AGENTS:
            self.assertTrue((Path(self.tmp.name) / "codex" / "agents" / f"{name}.toml").is_symlink(), name)
        self.assertFalse((Path(self.tmp.name) / "agents" / "skills" / "o90-pi-worker").exists())
        self.assertFalse((Path(self.tmp.name) / "pi").exists())

    def test_cursor_only_needs_no_pi_or_bun(self):
        (self.bin / "pi").unlink()
        (self.bin / "bun").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        project = Path(self.tmp.name) / "cursor-project"
        project.mkdir()
        result = self.run_bootstrap(
            "--apply", "--with", "cursor", "--cursor-project", str(project)
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in PUBLIC_SKILLS:
            self.assertTrue((project / ".cursor" / "skills" / name).is_symlink(), name)
        for name in PUBLIC_AGENTS:
            self.assertTrue((project / ".cursor" / "agents" / f"{name}.md").is_symlink(), name)
        self.assertFalse((project / ".cursor" / "skills" / "o90-pi-worker").exists())
        self.assertFalse((Path(self.tmp.name) / "pi").exists())

    def test_missing_selected_codex_prerequisite_fails(self):
        (self.bin / "codex").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        result = self.run_bootstrap("--with", "codex")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing prerequisite for Codex component: codex", result.stderr)

if __name__ == "__main__":
    unittest.main()
