#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = ROOT / "scripts" / "install.py"
DRIFT_CHECKER = ROOT / "scripts" / "check_drift.py"
PUBLIC_SKILLS = {"clean-writing"}
PUBLIC_AGENTS = {"adversarial-reviewer"}
CANONICAL_OUTPUT_STYLE = (ROOT / "shared" / "output-style.md").read_text().strip()

sys.path.insert(0, str(ROOT / "scripts"))
import install as installer_module  # noqa: E402


class InstallerHarness(unittest.TestCase):
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
        return [
            "--claude-dir", claude,
            "--pi-dir", pi,
            "--pi-root", pi_root,
            "--state-dir", state,
        ]


class InstallerTest(InstallerHarness):
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

            result = self.run_installer(
                "--apply", "--with", "claude", "--with", "pi", *self.arguments(root)
            )
            manifest_line = next(line for line in result.stdout.splitlines() if line.startswith("manifest"))
            manifest = Path(manifest_line.split(maxsplit=1)[1])

            self.assertTrue((claude / "CLAUDE.md").is_symlink())
            self.assertEqual(json.loads((claude / "settings.json").read_text()), {"custom": True})
            self.assertTrue((pi / "agents").is_symlink())
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

            result = self.run_installer(
                "--apply", "--with", "claude", "--overlay", overlay, *self.arguments(root)
            )
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
            self.assertTrue((pi / "agents").is_symlink())
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
            result = self.run_installer("--apply", "--with", "claude", *self.arguments(root))
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
            added_after_rollback = claude / "agents"
            added_after_rollback.parent.mkdir(parents=True, exist_ok=True)
            added_after_rollback.write_text("new user file\n")
            repeated = self.run_installer("--rollback", manifest, check=False)
            self.assertNotEqual(repeated.returncode, 0)
            self.assertEqual(added_after_rollback.read_text(), "new user file\n")

    def test_existing_real_skill_directory_is_kept_and_linked_ones_replaced(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            private = claude / "skills" / "conductor"
            private.mkdir(parents=True)
            (private / "SKILL.md").write_text("private conductor\n")
            stale = claude / "skills" / "summarize"
            stale.symlink_to(root / "retired-repo" / "summarize")

            result = self.run_installer("--apply", "--with", "claude", *self.arguments(root))
            self.assertIn("keep            " + str(private) + " (user copy)", result.stdout)
            self.assertFalse(private.is_symlink())
            self.assertEqual((private / "SKILL.md").read_text(), "private conductor\n")
            self.assertTrue(stale.is_symlink())
            self.assertEqual(stale.resolve(), (ROOT / "claude" / "config" / "skills" / "summarize").resolve())

    def test_default_is_pi_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, pi, _, _ = self.targets(root)
            result = self.run_installer("--apply", *self.arguments(root))
            self.assertIn("Pi text:       not linked (stock Pi)", result.stdout)
            self.assertFalse(os.path.lexists(pi / "AGENTS.md"))
            self.assertFalse(os.path.lexists(pi / "APPEND_SYSTEM.md"))
            self.assertTrue((pi / "agents").is_symlink())
            for name in PUBLIC_SKILLS:
                self.assertTrue((pi / "skills" / name).is_symlink(), name)
            self.assertFalse(claude.exists())

    def test_pi_text_is_opt_in(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, pi, _, _ = self.targets(root)
            result = self.run_installer("--apply", "--with", "pi", "--with", "pi-text", *self.arguments(root))
            self.assertIn("Pi text:       linked (opt-in)", result.stdout)
            self.assertTrue((pi / "AGENTS.md").is_symlink())
            self.assertIn(CANONICAL_OUTPUT_STYLE, (pi / "APPEND_SYSTEM.md").read_text())
            rejected = self.run_installer("--with", "pi-text", *self.arguments(root), check=False)
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("requires --with pi", rejected.stderr)

    def test_claude_only_does_not_touch_pi(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            result = self.run_installer("--apply", "--with", "claude", *self.arguments(root))
            self.assertIn("Components:    claude", result.stdout)
            self.assertTrue((claude / "CLAUDE.md").is_symlink())
            self.assertNotIn("## Output style", (claude / "CLAUDE.md").read_text())
            for name in ("conductor", "i-have-adhd", "summarize", "svelte5-best-practices"):
                self.assertTrue((claude / "skills" / name).is_symlink(), name)
            self.assertFalse((root / "pi").exists())
            self.assertEqual(
                {path.parent.name for path in (ROOT / "claude" / "plugin" / "skills").glob("*/SKILL.md")},
                PUBLIC_SKILLS,
            )
            self.assertEqual(
                {path.stem for path in (ROOT / "claude" / "plugin" / "agents").glob("*.md")},
                PUBLIC_AGENTS,
            )


class DriftCheckerTest(InstallerHarness):
    def run_drift(self, root: Path, *extra: object) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(DRIFT_CHECKER), *map(str, self.arguments(root)[:-2]), *(str(item) for item in extra)],
            capture_output=True,
            text=True,
        )

    def test_symlink_pointing_outside_managed_sources_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            self.run_installer("--apply", "--with", "claude", *self.arguments(root))

            retired = root / "retired-repo"
            retired.mkdir()
            (retired / "AGENTS.md").write_text("stale instructions\n")
            (claude / "leftover.md").symlink_to(retired / "AGENTS.md")

            drift = self.run_drift(root, "--with", "claude")
            self.assertNotEqual(drift.returncode, 0, drift.stdout)
            self.assertIn("points outside every managed source", drift.stdout)
            self.assertIn("leftover.md", drift.stdout)

    def test_leftover_pi_text_link_is_drift_unless_pi_text_selected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, pi, _, _ = self.targets(root)
            self.run_installer("--apply", "--with", "pi", "--with", "pi-text", *self.arguments(root))
            self.assertEqual(self.run_drift(root, "--with", "pi", "--with", "pi-text").returncode, 0)
            drift = self.run_drift(root, "--with", "pi")
            self.assertNotEqual(drift.returncode, 0, drift.stdout)
            self.assertIn("o90 text linked without --with pi-text", drift.stdout)

    def test_overlay_only_path_is_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            overlay = root / "overlay"
            (overlay / "claude" / "bin").mkdir(parents=True)
            (overlay / "claude" / "bin" / "statusline").write_text("#!/bin/sh\n")

            self.run_installer(
                "--apply", "--with", "claude", "--overlay", overlay, *self.arguments(root)
            )
            self.assertTrue((claude / "bin").is_symlink())
            self.assertEqual(
                self.run_drift(root, "--with", "claude", "--overlay", overlay).returncode, 0
            )

            (claude / "bin").unlink()
            (claude / "bin").mkdir()
            drift = self.run_drift(root, "--with", "claude", "--overlay", overlay)
            self.assertNotEqual(drift.returncode, 0, drift.stdout)
            self.assertIn("expected symlink", drift.stdout)


class CatalogParityTest(unittest.TestCase):
    def test_every_claude_agent_has_a_pi_counterpart(self) -> None:
        claude = {path.stem for path in (ROOT / "claude" / "plugin" / "agents").glob("*.md")}
        pi = {path.stem for path in (ROOT / "pi" / "agents").glob("*.md")}
        self.assertEqual(claude, PUBLIC_AGENTS)
        self.assertTrue(PUBLIC_AGENTS <= pi)

    def test_pi_guidance_contains_the_canonical_output_style(self) -> None:
        self.assertEqual((ROOT / "pi" / "APPEND_SYSTEM.md").read_text().count(CANONICAL_OUTPUT_STYLE), 1)
        self.assertNotIn(CANONICAL_OUTPUT_STYLE, (ROOT / "claude" / "config" / "CLAUDE.md").read_text())

        self.assertIn("Write clear, compact prose", CANONICAL_OUTPUT_STYLE)
        self.assertIn("Skip generic introductions and conclusions", CANONICAL_OUTPUT_STYLE)
        self.assertIn("Preserve exact code", CANONICAL_OUTPUT_STYLE)

if __name__ == "__main__":
    unittest.main()
