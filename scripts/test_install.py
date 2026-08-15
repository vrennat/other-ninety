#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = ROOT / "scripts" / "install.py"
DRIFT_CHECKER = ROOT / "scripts" / "check_drift.py"


class InstallerTest(unittest.TestCase):
    def run_installer(self, *args: object, check: bool = True) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(INSTALLER), *(str(arg) for arg in args)],
            check=check,
            capture_output=True,
            text=True,
        )

    def targets(self, root: Path) -> tuple[Path, Path, Path, Path]:
        return root / "claude", root / "pi" / "agent", root / "pi", root / "state"

    def arguments(self, root: Path) -> list[object]:
        claude, pi, pi_root, state = self.targets(root)
        return ["--claude-dir", claude, "--pi-dir", pi, "--pi-root", pi_root, "--state-dir", state]

    def test_dry_run_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = self.run_installer(*self.arguments(root))
            self.assertIn("dry-run (no writes)", result.stdout)
            self.assertFalse((root / "claude").exists())
            self.assertFalse((root / "pi").exists())
            self.assertFalse((root / "state").exists())

    def test_apply_and_rollback_restore_prior_states(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, pi, _, state = self.targets(root)
            claude.mkdir(parents=True)
            (claude / "CLAUDE.md").write_text("old instructions\n")
            (claude / "settings.json").write_text('{"custom": true}\n')

            result = self.run_installer("--apply", *self.arguments(root))
            manifest_line = next(line for line in result.stdout.splitlines() if line.startswith("manifest"))
            manifest = Path(manifest_line.split(maxsplit=1)[1])

            self.assertTrue((claude / "CLAUDE.md").is_symlink())
            self.assertEqual(json.loads((claude / "settings.json").read_text()), {"custom": True})
            self.assertTrue((pi / "AGENTS.md").is_symlink())
            self.assertTrue(manifest.is_file())

            self.run_installer("--rollback", manifest)
            self.assertFalse((claude / "CLAUDE.md").is_symlink())
            self.assertEqual((claude / "CLAUDE.md").read_text(), "old instructions\n")
            self.assertEqual(json.loads((claude / "settings.json").read_text()), {"custom": True})
            self.assertFalse(pi.exists())
            self.assertEqual(json.loads(manifest.read_text())["status"], "rolled-back")
            self.assertTrue(state.exists())

    def test_fresh_apply_has_no_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.run_installer("--apply", *self.arguments(root))
            drift = subprocess.run(
                ["python3", str(DRIFT_CHECKER), *map(str, self.arguments(root)[:-2])],
                capture_output=True,
                text=True,
            )
            self.assertEqual(drift.returncode, 0, drift.stdout + drift.stderr)
            self.assertIn("RESULT: clean", drift.stdout)

    def test_overlay_replaces_mutable_settings_and_rolls_back(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            claude.mkdir(parents=True)
            (claude / "settings.json").write_text('{"before": true}\n')
            overlay = root / "overlay"
            (overlay / "claude").mkdir(parents=True)
            (overlay / "claude" / "settings.json").write_text('{"private": true}\n')

            result = self.run_installer("--apply", "--overlay", overlay, *self.arguments(root))
            manifest_line = next(line for line in result.stdout.splitlines() if line.startswith("manifest"))
            manifest = Path(manifest_line.split(maxsplit=1)[1])
            self.assertEqual(json.loads((claude / "settings.json").read_text()), {"private": True})

            self.run_installer("--rollback", manifest)
            self.assertEqual(json.loads((claude / "settings.json").read_text()), {"before": True})

    def test_custom_pi_dir_outside_pi_root_is_reversible(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude = root / "claude"
            pi = root / "separate-pi-agent"
            pi_root = root / "pi-root"
            state = root / "state"
            result = self.run_installer(
                "--apply", "--claude-dir", claude, "--pi-dir", pi,
                "--pi-root", pi_root, "--state-dir", state,
            )
            manifest = Path(next(line for line in result.stdout.splitlines() if line.startswith("manifest")).split(maxsplit=1)[1])
            self.assertTrue((pi / "AGENTS.md").is_symlink())
            self.run_installer("--rollback", manifest)
            self.assertFalse(claude.exists())
            self.assertFalse(pi.exists())
            self.assertFalse(pi_root.exists())

    def test_rollback_rejects_parent_escape(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            managed = root / "managed"
            managed.mkdir()
            victim = root / "victim.txt"
            victim.write_text("keep\n")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({
                "version": 1,
                "status": "complete",
                "roots": [str(managed)],
                "entries": [{"target": str(managed / ".." / "victim.txt"), "kind": "absent"}],
                "createdDirs": [],
            }))
            result = self.run_installer("--rollback", manifest, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(victim.read_text(), "keep\n")

    def test_rollback_preflights_backups_and_refuses_second_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            claude.mkdir(parents=True)
            original = claude / "CLAUDE.md"
            original.write_text("old\n")
            result = self.run_installer("--apply", *self.arguments(root))
            manifest = Path(next(line for line in result.stdout.splitlines() if line.startswith("manifest")).split(maxsplit=1)[1])
            data = json.loads(manifest.read_text())
            first_backup = Path(next(entry["backup"] for entry in data["entries"] if entry["kind"] == "file"))
            held = first_backup.read_bytes()
            first_backup.unlink()

            failed = self.run_installer("--rollback", manifest, check=False)
            self.assertNotEqual(failed.returncode, 0)
            self.assertTrue(original.is_symlink())

            first_backup.write_bytes(held)
            self.run_installer("--rollback", manifest)
            added_after_rollback = claude / "post-compact-rules.md"
            added_after_rollback.parent.mkdir(parents=True, exist_ok=True)
            added_after_rollback.write_text("new user file\n")
            repeated = self.run_installer("--rollback", manifest, check=False)
            self.assertNotEqual(repeated.returncode, 0)
            self.assertEqual(added_after_rollback.read_text(), "new user file\n")


if __name__ == "__main__":
    unittest.main()
