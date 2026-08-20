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
            "--codex-dir", root / "codex",
            "--agents-dir", root / "agents",
            "--pi-dir", pi,
            "--pi-root", pi_root,
            "--bin-dir", root / "bin",
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
                "--pi-root", pi_root, "--bin-dir", root / "bin", "--state-dir", state,
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
            added_after_rollback = claude / "post-compact-rules.md"
            added_after_rollback.parent.mkdir(parents=True, exist_ok=True)
            added_after_rollback.write_text("new user file\n")
            repeated = self.run_installer("--rollback", manifest, check=False)
            self.assertNotEqual(repeated.returncode, 0)
            self.assertEqual(added_after_rollback.read_text(), "new user file\n")

    def test_default_is_pi_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, pi, _, _ = self.targets(root)
            self.run_installer("--apply", *self.arguments(root))
            self.assertTrue((pi / "AGENTS.md").is_symlink())
            self.assertIn(CANONICAL_OUTPUT_STYLE, (pi / "APPEND_SYSTEM.md").read_text())
            for name in PUBLIC_SKILLS:
                self.assertTrue((pi / "skills" / name).is_symlink(), name)
            self.assertTrue((root / "bin" / "o90-pi").is_symlink())
            self.assertFalse(claude.exists())
            self.assertFalse((root / "codex").exists())

    def test_claude_only_does_not_touch_pi(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude, _, _, _ = self.targets(root)
            result = self.run_installer("--apply", "--with", "claude", *self.arguments(root))
            self.assertIn("Components:    claude", result.stdout)
            self.assertTrue((claude / "CLAUDE.md").is_symlink())
            self.assertIn(CANONICAL_OUTPUT_STYLE, (claude / "CLAUDE.md").read_text())
            self.assertFalse((root / "pi").exists())
            self.assertFalse((root / "bin").exists())
            self.assertEqual(
                {path.parent.name for path in (ROOT / "claude" / "plugin" / "skills").glob("*/SKILL.md")},
                PUBLIC_SKILLS,
            )
            self.assertEqual(
                {path.stem for path in (ROOT / "claude" / "plugin" / "agents").glob("*.md")},
                PUBLIC_AGENTS,
            )

    def test_codex_only_installs_companion_config_without_global_skills(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = self.run_installer("--apply", "--with", "codex", *self.arguments(root))
            skills = root / "agents" / "skills"
            self.assertIn("Components:    codex", result.stdout)
            self.assertTrue((root / "codex" / "AGENTS.md").is_symlink())
            self.assertIn(CANONICAL_OUTPUT_STYLE, (root / "codex" / "AGENTS.md").read_text())
            for name in PUBLIC_SKILLS:
                self.assertFalse(os.path.lexists(skills / name), name)
            for name in PUBLIC_AGENTS:
                self.assertTrue((root / "codex" / "agents" / f"{name}.toml").is_symlink(), name)
            self.assertFalse((skills / "o90-pi-worker").exists())
            self.assertFalse((root / "pi").exists())
            self.assertFalse((root / "bin").exists())

    def test_codex_plugin_ready_removes_only_owned_links_and_rollback_restores_them(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skills = root / "agents" / "skills"
            skills.mkdir(parents=True)
            owned = skills / "clean-writing"
            owned.symlink_to(ROOT / "skills" / "clean-writing")
            foreign_target = root / "foreign-skill"
            foreign_target.mkdir()
            foreign_link = skills / "onboarding"
            foreign_link.symlink_to(foreign_target)
            foreign_file = skills / "plan-hunter"
            foreign_file.write_text("user-managed\n")

            result = self.run_installer(
                "--apply",
                "--with", "codex",
                "--codex-plugin-ready",
                *self.arguments(root),
            )
            manifest = Path(
                next(line for line in result.stdout.splitlines() if line.startswith("manifest")).split(maxsplit=1)[1]
            )
            self.assertFalse(os.path.lexists(owned))
            self.assertTrue(foreign_link.is_symlink())
            self.assertEqual(foreign_link.resolve(), foreign_target.resolve())
            self.assertEqual(foreign_file.read_text(), "user-managed\n")
            manifest_data = json.loads(manifest.read_text())
            self.assertIn(
                {"target": str(owned), "kind": "symlink", "link": str(ROOT / "skills" / "clean-writing")},
                manifest_data["entries"],
            )

            self.run_installer("--rollback", manifest)
            self.assertTrue(owned.is_symlink())
            self.assertEqual(Path(os.readlink(owned)), ROOT / "skills" / "clean-writing")
            self.assertTrue(foreign_link.is_symlink())
            self.assertEqual(foreign_file.read_text(), "user-managed\n")

    def test_codex_companion_without_plugin_proof_leaves_owned_legacy_link(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            legacy = root / "agents" / "skills" / "clean-writing"
            legacy.parent.mkdir(parents=True)
            legacy.symlink_to(ROOT / "skills" / "clean-writing")

            self.run_installer("--apply", "--with", "codex", *self.arguments(root))

            self.assertTrue(legacy.is_symlink())
            self.assertEqual(Path(os.readlink(legacy)), ROOT / "skills" / "clean-writing")

    def test_remove_owned_link_handles_dangling_destination_and_rollback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            expected = root / "checkout" / "skills" / "clean-writing"
            target = root / "agents" / "skills" / "clean-writing"
            target.parent.mkdir(parents=True)
            target.symlink_to(expected)
            self.assertFalse(target.exists())

            manifest = installer_module.apply(
                [installer_module.Operation("remove-owned-link", expected, target)],
                root / "state",
                [root / "agents"],
            )
            self.assertFalse(os.path.lexists(target))

            installer_module.rollback(manifest)
            self.assertTrue(target.is_symlink())
            self.assertFalse(target.exists())
            self.assertEqual(Path(os.readlink(target)), expected)

    def test_codex_plugin_ready_requires_codex_component(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = self.run_installer(
                "--with", "pi", "--codex-plugin-ready", *self.arguments(root), check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("requires --with codex", result.stderr)

    def test_cursor_only_installs_native_skills_without_pi(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / "project"
            project.mkdir()
            result = self.run_installer(
                "--apply",
                "--with", "cursor",
                "--cursor-project", project,
                *self.arguments(root),
            )
            skills = project / ".cursor" / "skills"
            self.assertIn("Components:    cursor", result.stdout)
            self.assertTrue((project / ".cursor" / "rules" / "o90.mdc").is_file())
            self.assertIn(CANONICAL_OUTPUT_STYLE, (project / ".cursor" / "rules" / "o90.mdc").read_text())
            for name in PUBLIC_SKILLS:
                self.assertTrue((skills / name).is_symlink(), name)
            for name in PUBLIC_AGENTS:
                self.assertTrue((project / ".cursor" / "agents" / f"{name}.md").is_symlink(), name)
            self.assertFalse((skills / "o90-pi-worker").exists())
            self.assertFalse((root / "pi").exists())
            self.assertFalse((root / "bin").exists())

            manifest = Path(
                next(line for line in result.stdout.splitlines() if line.startswith("manifest")).split(maxsplit=1)[1]
            )
            self.run_installer("--rollback", manifest)
            self.assertFalse((project / ".cursor").exists())

    def test_hosts_plus_pi_add_optional_bridge(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / "project"
            project.mkdir()
            result = self.run_installer(
                "--apply",
                "--with", "pi",
                "--with", "codex",
                "--with", "cursor",
                "--cursor-project", project,
                *self.arguments(root),
            )
            self.assertIn("Components:    pi, codex, cursor", result.stdout)
            self.assertTrue((root / "pi" / "agent" / "AGENTS.md").is_symlink())
            self.assertTrue((root / "agents" / "skills" / "o90-pi-worker").is_symlink())
            self.assertTrue((project / ".cursor" / "skills" / "o90-pi-worker").is_symlink())

            drift = subprocess.run(
                [
                    "python3", str(DRIFT_CHECKER),
                    "--with", "pi",
                    "--with", "codex",
                    "--with", "cursor",
                    "--cursor-project", str(project),
                    *map(str, self.arguments(root)[:-2]),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(drift.returncode, 0, drift.stdout + drift.stderr)
            self.assertIn("RESULT: clean", drift.stdout)

            manifest = Path(
                next(line for line in result.stdout.splitlines() if line.startswith("manifest")).split(maxsplit=1)[1]
            )
            self.run_installer("--rollback", manifest)
            self.assertFalse((project / ".cursor").exists())

    def test_cursor_component_requires_explicit_projects(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = self.run_installer("--with", "cursor", *self.arguments(root), check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("requires at least one --cursor-project", result.stderr)


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

    def test_codex_reports_owned_legacy_skill_link_but_ignores_foreign_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.run_installer("--apply", "--with", "codex", *self.arguments(root))
            skills = root / "agents" / "skills"
            skills.mkdir(parents=True)
            owned = skills / "clean-writing"
            owned.symlink_to(ROOT / "skills" / "clean-writing")
            foreign_target = root / "foreign-skill"
            foreign_target.mkdir()
            (skills / "onboarding").symlink_to(foreign_target)
            (skills / "plan-hunter").write_text("user-managed\n")

            drift = self.run_drift(root, "--with", "codex")

            self.assertNotEqual(drift.returncode, 0, drift.stdout)
            self.assertIn("checkout-owned legacy global skill link remains", drift.stdout)
            self.assertIn(str(owned), drift.stdout)
            self.assertNotIn(str(skills / "onboarding"), drift.stdout)
            self.assertNotIn(str(skills / "plan-hunter"), drift.stdout)


class CatalogParityTest(unittest.TestCase):
    def test_every_host_guidance_contains_the_canonical_output_style(self) -> None:
        host_guidance = (
            ROOT / "pi" / "APPEND_SYSTEM.md",
            ROOT / "claude" / "config" / "CLAUDE.md",
            ROOT / "claude" / "plugin" / "output-style.md",
            ROOT / "codex" / "AGENTS.md",
            ROOT / "cursor" / "rules" / "o90.mdc",
        )
        for path in host_guidance:
            self.assertEqual(path.read_text().count(CANONICAL_OUTPUT_STYLE), 1, str(path))

        self.assertIn("Write clear, compact prose", CANONICAL_OUTPUT_STYLE)
        self.assertIn("Skip generic introductions and conclusions", CANONICAL_OUTPUT_STYLE)
        self.assertIn("Preserve exact code", CANONICAL_OUTPUT_STYLE)

    def test_every_public_skill_has_shared_native_source(self) -> None:
        claude = {
            path.parent.name for path in (ROOT / "claude" / "plugin" / "skills").glob("*/SKILL.md")
        }
        shared = {path.parent.name for path in (ROOT / "skills").glob("*/SKILL.md")}
        self.assertEqual(claude, PUBLIC_SKILLS)
        self.assertEqual(shared, PUBLIC_SKILLS)
        clean_writing = ROOT / "skills" / "clean-writing"
        for path in clean_writing.rglob("*"):
            if not path.is_file():
                continue
            plugin_path = ROOT / "claude" / "plugin" / "skills" / "clean-writing" / path.relative_to(clean_writing)
            self.assertEqual(path.read_text(), plugin_path.read_text())
        self.assertTrue((ROOT / "skills" / "plan-hunter" / "REFERENCE.md").is_file())
        pi_native = {path.parent.name for path in (ROOT / "pi" / "skills").glob("*/SKILL.md")}
        self.assertTrue(pi_native <= PUBLIC_SKILLS)

    def test_every_public_agent_has_codex_and_cursor_native_source(self) -> None:
        claude = {path.stem for path in (ROOT / "claude" / "plugin" / "agents").glob("*.md")}
        codex = {path.stem for path in (ROOT / "codex" / "agents").glob("*.toml")}
        cursor = {path.stem for path in (ROOT / "cursor" / "agents").glob("*.md")}
        self.assertEqual(claude, PUBLIC_AGENTS)
        self.assertEqual(codex, PUBLIC_AGENTS)
        self.assertEqual(cursor, PUBLIC_AGENTS)
        pi = {path.stem for path in (ROOT / "pi" / "agents").glob("*.md")}
        self.assertTrue(PUBLIC_AGENTS <= pi)

        for name in PUBLIC_AGENTS:
            codex_text = (ROOT / "codex" / "agents" / f"{name}.toml").read_text()
            self.assertIn(f'name = "{name}"', codex_text)
            self.assertIn("description = ", codex_text)
            self.assertIn("developer_instructions = ", codex_text)
            cursor_text = (ROOT / "cursor" / "agents" / f"{name}.md").read_text()
            self.assertIn(f"name: {name}", cursor_text)
            self.assertIn("description:", cursor_text)
            self.assertIn("model: inherit", cursor_text)


if __name__ == "__main__":
    unittest.main()
