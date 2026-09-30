import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent
PUBLIC_SKILLS = {"clean-writing"}
PUBLIC_AGENTS = {"adversarial-reviewer"}

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
            "pi": "echo pi:$* >>\"$CALLS\"\necho pi-dir:$PI_CODING_AGENT_DIR >>\"$CALLS\"\necho pi-cwd:$PWD >>\"$CALLS\"\nif [ \"${2#./}\" != \"$2\" ]; then test -d \"$2\"; fi",
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

    def test_pi_text_component_passes_through(self):
        result = self.run_bootstrap("--apply", "--with", "pi", "--with", "pi-text")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Components: Pi (+ o90 Pi text)", result.stdout)
        self.assertTrue((Path(self.tmp.name) / "pi" / "AGENTS.md").is_symlink())
        rejected = self.run_bootstrap("--with", "pi-text")
        self.assertEqual(rejected.returncode, 2)
        self.assertIn("requires --with pi", rejected.stderr)

    def test_claude_only_needs_no_pi_or_bun(self):
        (self.bin / "pi").unlink()
        (self.bin / "bun").unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        result = self.run_bootstrap("--apply", "--with", "claude")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((Path(self.tmp.name) / "claude" / "CLAUDE.md").is_symlink())
        self.assertFalse((Path(self.tmp.name) / "pi").exists())
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

    def test_overlay_packages_and_custom_pi_dir_are_effective(self):
        overlay = Path(self.tmp.name) / "overlay"
        (overlay / "pi").mkdir(parents=True)
        (overlay / "pi" / "settings.json").write_text(json.dumps({"packages": ["npm:private-package@1.0.0"]}))
        custom = Path(self.tmp.name) / "custom-agent"
        custom.mkdir()
        (custom / "settings.json").write_text('{"packages": ["npm:old-live@1.0.0"]}')
        result = self.run_bootstrap("--apply", "--overlay", str(overlay), "--pi-dir", str(custom))
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("pi:install npm:private-package@1.0.0", calls)
        self.assertNotIn("pi:install npm:pi-mcp-adapter", calls)
        self.assertNotIn("pi:install npm:old-live", calls)
        self.assertIn(f"pi-dir:{custom}", calls)
        self.assertTrue((custom / "agents").is_symlink())
        self.assertFalse((Path(self.tmp.name) / "pi").exists())

    def test_kept_live_package_settings_are_used(self):
        agent = Path(self.env["PI_CODING_AGENT_DIR"])
        agent.mkdir()
        settings = agent / "settings.json"
        original = json.dumps({"packages": [{"source": "npm:live-package@1.0.0", "extensions": []}], "personal": True})
        settings.write_text(original)
        result = self.run_bootstrap("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("pi:install npm:live-package@1.0.0", calls)
        self.assertNotIn("pi:install npm:pi-mcp-adapter", calls)
        self.assertIn(f"pi-dir:{agent}", calls)
        self.assertEqual(settings.read_text(), original)

    def test_bad_package_settings_fail_before_commands_or_config_writes(self):
        overlay = Path(self.tmp.name) / "overlay"
        (overlay / "pi").mkdir(parents=True)
        settings = overlay / "pi" / "settings.json"
        for value in ('invalid JSON', '{"packages": "not-an-array"}', '{"packages": [null]}', '{"packages": ["--unsafe"]}'):
            with self.subTest(settings=value):
                settings.write_text(value)
                result = self.run_bootstrap("--apply", "--overlay", str(overlay))
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.log.exists())
                self.assertFalse(Path(self.env["PI_CODING_AGENT_DIR"]).exists())
                self.assertFalse(Path(self.env["OTHER_NINETY_STATE_DIR"]).exists())

    def test_relative_live_package_is_installed_from_agent_dir(self):
        agent = Path(self.env["PI_CODING_AGENT_DIR"])
        (agent / "local-extension").mkdir(parents=True)
        (agent / "settings.json").write_text('{"packages": ["./local-extension"]}')
        result = self.run_bootstrap("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn("pi:install ./local-extension", calls)
        self.assertEqual(Path(next(line.removeprefix("pi-cwd:") for line in calls.splitlines() if line.startswith("pi-cwd:"))).resolve(), agent.resolve())

    def test_empty_package_list_installs_no_packages(self):
        overlay = Path(self.tmp.name) / "overlay"
        (overlay / "pi").mkdir(parents=True)
        (overlay / "pi" / "settings.json").write_text('{"packages": []}')
        result = self.run_bootstrap("--apply", "--overlay", str(overlay))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("pi:install", self.log.read_text())

    def test_codex_only_is_config_only_and_honors_target(self):
        for runtime in ("pi", "bun", "claude"):
            (self.bin / runtime).unlink()
        self.env["PATH"] = f"{self.bin}:/usr/bin:/bin"
        overlay = Path(self.tmp.name) / "overlay"
        (overlay / "codex").mkdir(parents=True)
        (overlay / "codex" / "AGENTS.md").write_text("personal instructions\n")
        target = Path(self.tmp.name) / "codex-home"
        result = self.run_bootstrap("--apply", "--with=codex", "--overlay", str(overlay), f"--codex-dir={target}")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Components: Codex", result.stdout)
        self.assertTrue((target / "AGENTS.md").is_symlink())
        self.assertFalse(self.log.exists())
        self.assertFalse(Path(self.env["PI_CODING_AGENT_DIR"]).exists())
        self.assertFalse(Path(self.env["CLAUDE_CONFIG_DIR"]).exists())

if __name__ == "__main__":
    unittest.main()
