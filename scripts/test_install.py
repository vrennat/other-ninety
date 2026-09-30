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
            self.assertIn("Pi text:       not linked", result.stdout)
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

    def test_preserved_public_skill_is_unmanaged_until_overlay_claims_it(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            skill = claude / "skills" / "conductor"
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text("private instructions")
            self.run_installer("--apply", "--with", "claude", *self.arguments(root))
            result = self.run_drift(root, "--with", "claude")
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertIn(f"UNMANAGED: {skill}", result.stdout)
            overlay = root / "overlay"
            owned = overlay / "claude" / "skills" / "conductor"
            owned.mkdir(parents=True)
            (owned / "SKILL.md").write_text("overlay instructions")
            result = self.run_drift(root, "--with", "claude", "--overlay", overlay)
            self.assertEqual(result.returncode, 1, result.stdout)
            self.assertIn(f"{skill}: differs", result.stdout)

    def test_overlay_copy_checks_bytes_even_with_identical_size_and_mtime(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            overlay = root / "overlay"
            owned = overlay / "claude" / "skills" / "conductor"
            owned.mkdir(parents=True)
            source = owned / "SKILL.md"
            source.write_text("original")
            result = self.run_installer("--apply", "--with", "claude", "--overlay", overlay, *self.arguments(root))
            target = claude / "skills" / "conductor" / "SKILL.md"
            target.write_text("modified")
            os.utime(target, ns=(source.stat().st_atime_ns, source.stat().st_mtime_ns))
            drift = self.run_drift(root, "--with", "claude", "--overlay", overlay)
            self.assertEqual(drift.returncode, 1, drift.stdout)
            self.assertIn("differs", drift.stdout)
            manifest = Path(next(line for line in result.stdout.splitlines() if line.startswith("manifest")).split(maxsplit=1)[1])
            entries = json.loads(manifest.read_text())["entries"]
            self.assertEqual(sum(entry["target"] == str(target.parent) for entry in entries), 1)
            self.run_installer("--rollback", manifest)
            self.assertFalse(target.parent.exists())

    def test_overlay_pi_text_obeys_component_selection(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, pi, _, _ = self.targets(root)
            overlay = root / "overlay"
            (overlay / "pi").mkdir(parents=True)
            text = overlay / "pi" / "AGENTS.md"
            text.write_text("private Pi behavior")
            self.run_installer("--apply", "--overlay", overlay, *self.arguments(root))
            self.assertFalse(os.path.lexists(pi / "AGENTS.md"))
            self.assertEqual(self.run_drift(root, "--overlay", overlay).returncode, 0)
            self.run_installer("--apply", "--with", "pi", "--with", "pi-text", "--overlay", overlay, *self.arguments(root))
            self.assertEqual((pi / "AGENTS.md").resolve(), text.resolve())
            self.assertEqual(self.run_drift(root, "--with", "pi", "--with", "pi-text", "--overlay", overlay).returncode, 0)
            self.assertEqual(self.run_drift(root, "--overlay", overlay).returncode, 1)

    def test_settings_subset_and_overlay_exactness_are_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, pi, _, _ = self.targets(root)
            self.run_installer("--apply", *self.arguments(root))
            settings = pi / "settings.json"
            value = json.loads(settings.read_text())
            value["privatePreference"] = True
            settings.write_text(json.dumps(value))
            self.assertEqual(self.run_drift(root).returncode, 0)
            overlay = root / "overlay"
            (overlay / "pi").mkdir(parents=True)
            (overlay / "pi" / "settings.json").write_bytes((ROOT / "pi" / "settings.json").read_bytes())
            self.assertEqual(self.run_drift(root, "--overlay", overlay).returncode, 1)
            settings.write_bytes((overlay / "pi" / "settings.json").read_bytes())
            self.assertEqual(self.run_drift(root, "--overlay", overlay).returncode, 0)

    def test_overlay_pi_runtime_config_is_linked_and_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, pi, _, _ = self.targets(root)
            overlay = root / "overlay"
            (overlay / "pi").mkdir(parents=True)
            config = overlay / "pi" / "quota-fallback.json"
            config.write_text('[{"provider": "private", "id": "model"}]')
            self.run_installer("--apply", "--overlay", overlay, *self.arguments(root))
            target = pi / "quota-fallback.json"
            self.assertEqual(target.resolve(), config.resolve())
            self.assertEqual(self.run_drift(root, "--overlay", overlay).returncode, 0)
            target.unlink()
            target.write_bytes(config.read_bytes())
            result = self.run_drift(root, "--overlay", overlay)
            self.assertEqual(result.returncode, 1, result.stdout)
            self.assertIn(f"{target}: expected symlink", result.stdout)

    def test_symlinked_overlay_skill_source_matches_installed_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            source = root / "private-skill"
            source.mkdir()
            (source / "SKILL.md").write_text("private instructions")
            (source / "reference.md").symlink_to("SKILL.md")
            overlay = root / "overlay"
            (overlay / "claude" / "skills").mkdir(parents=True)
            (overlay / "claude" / "skills" / "conductor").symlink_to(source)
            self.run_installer("--apply", "--with", "claude", "--overlay", overlay, *self.arguments(root))
            target = claude / "skills" / "conductor"
            self.assertFalse(target.is_symlink())
            self.assertEqual(self.run_drift(root, "--with", "claude", "--overlay", overlay).returncode, 0)
            (target / "reference.md").unlink()
            (target / "reference.md").symlink_to("other.md")
            drift = self.run_drift(root, "--with", "claude", "--overlay", overlay)
            self.assertEqual(drift.returncode, 1, drift.stdout)
            self.assertIn(f"{target}: differs", drift.stdout)

    def test_invalid_overlay_is_not_silently_ignored_by_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.run_installer("--apply", *self.arguments(root))
            result = self.run_drift(root, "--overlay", root / "missing")
            self.assertEqual(result.returncode, 1)
            self.assertIn("overlay is not a directory", result.stderr)


class CodexOverlayTest(InstallerHarness):
    def overlay(self, root: Path) -> Path:
        overlay = root / "overlay"
        source = overlay / "codex"
        source.mkdir(parents=True)
        (source / "AGENTS.md").write_text("portable personal instructions\n")
        (source / "other-ninety.config.toml").write_text('model = "test-model"\n')
        # These must never be installed, even if an overlay accidentally contains them.
        (source / "config.toml").write_text('host_setting = "private"\n')
        (source / "auth.json").write_text('{"fixture":true}\n')
        return overlay

    def test_codex_apply_drift_and_rollback_preserve_host_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            overlay = self.overlay(root)
            target = root / "codex"
            target.mkdir()
            (target / "AGENTS.md").write_text("previous instructions\n")
            (target / "config.toml").write_text('host_setting = "existing"\n')
            (target / "auth.json").write_text('{"fixture":"existing"}\n')
            args = ["--with", "codex", "--overlay", overlay, "--codex-dir", target, *self.arguments(root)]
            result = self.run_installer("--apply", *args)
            manifest = Path(next(line.split(maxsplit=1)[1] for line in result.stdout.splitlines() if line.startswith("manifest ")))
            self.assertEqual((target / "AGENTS.md").resolve(), (overlay / "codex" / "AGENTS.md").resolve())
            self.assertTrue((target / "other-ninety.config.toml").is_symlink())
            self.assertEqual((target / "config.toml").read_text(), 'host_setting = "existing"\n')
            self.assertEqual((target / "auth.json").read_text(), '{"fixture":"existing"}\n')
            self.assertEqual(len(json.loads(manifest.read_text())["entries"]), 2)
            drift = subprocess.run(["python3", str(DRIFT_CHECKER), *map(str, args[:-2])], capture_output=True, text=True)
            self.assertEqual(drift.returncode, 0, drift.stdout + drift.stderr)
            (target / "AGENTS.md").unlink()
            (target / "AGENTS.md").write_text("wrong instructions\n")
            drift = subprocess.run(["python3", str(DRIFT_CHECKER), *map(str, args[:-2])], capture_output=True, text=True)
            self.assertEqual(drift.returncode, 1, drift.stdout + drift.stderr)
            self.run_installer("--rollback", manifest)
            self.assertEqual((target / "AGENTS.md").read_text(), "previous instructions\n")
            self.assertFalse(os.path.lexists(target / "other-ninety.config.toml"))
            self.assertEqual((target / "config.toml").read_text(), 'host_setting = "existing"\n')
            self.assertEqual((target / "auth.json").read_text(), '{"fixture":"existing"}\n')
            self.assertFalse((root / "claude").exists())
            self.assertFalse((root / "pi").exists())

    def test_codex_uses_codex_home_and_requires_owned_overlay_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            overlay = self.overlay(root)
            target = root / "custom-codex-home"
            args = ["--with", "codex", "--overlay", overlay, *self.arguments(root)]
            result = subprocess.run(["python3", str(INSTALLER), *map(str, args)],
                                    env={**os.environ, "CODEX_HOME": str(target)}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(str(target / "AGENTS.md"), result.stdout)
            self.assertFalse(target.exists())
            missing = self.run_installer("--apply", "--with", "codex", *self.arguments(root), check=False)
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("requires --overlay", missing.stderr)
            for name in installer_module.CODEX_FILES:
                (overlay / "codex" / name).unlink()
            missing = self.run_installer("--apply", *args, check=False)
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("must contain", missing.stderr)
            self.assertFalse((root / "state").exists())

    def test_source_alias_to_target_is_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            overlay = root / "overlay"
            (overlay / "codex").mkdir(parents=True)
            target = root / "codex"
            target.mkdir()
            original = target / "AGENTS.md"
            original.write_text("original instructions\n")
            (overlay / "codex" / "AGENTS.md").symlink_to(original)
            result = self.run_installer("--apply", "--with", "codex", "--overlay", overlay,
                                        "--codex-dir", target, *self.arguments(root), check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("source would be replaced", result.stderr)
            self.assertFalse(original.is_symlink())
            self.assertEqual(original.read_text(), "original instructions\n")
            self.assertFalse((root / "state").exists())

    def test_source_inside_replaced_directory_is_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            destination = root / "rules"
            destination.mkdir()
            source = destination / "source.md"
            source.write_text("original\n")
            with self.assertRaisesRegex(ValueError, "source would be replaced"):
                installer_module.apply([installer_module.Operation("link", source, destination)], root / "state", [root])
            self.assertEqual(source.read_text(), "original\n")
            self.assertFalse((root / "state").exists())


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
