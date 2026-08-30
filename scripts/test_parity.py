#!/usr/bin/env python3
"""PARITY.md and the public CLAUDE.md list the shipped surface by hand; this keeps them equal to the tree."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
PARITY = (ROOT / "PARITY.md").read_text()


def listed(prefix: str) -> set[str]:
    line = next(l for l in PARITY.splitlines() if l.startswith(f"- [ ] {prefix}"))
    return set(re.findall(r"`([^`]+)`", line.split(":", 1)[1]))


def stems(pattern: str) -> set[str]:
    return {p.stem for p in ROOT.glob(pattern)}


class ParityDocTest(unittest.TestCase):
    def test_claude_commands(self):
        self.assertEqual(listed("Commands load"), stems("claude/plugin/commands/*.md"))

    def test_claude_agents(self):
        self.assertEqual(listed("Agents load"), stems("claude/plugin/agents/*.md"))

    def test_claude_skills(self):
        self.assertEqual(listed("Skills load"), {p.parent.name for p in ROOT.glob("claude/plugin/skills/*/SKILL.md")})

    def test_pi_prompts(self):
        self.assertEqual(listed("Prompt templates load"), stems("pi/prompts/*.md"))

    def test_version_line_matches_manifest(self):
        version = json.loads((ROOT / "claude/plugin/.claude-plugin/plugin.json").read_text())["version"]
        self.assertIn(f"version `{version}`", PARITY)

    def test_public_claude_md_names_every_command(self):
        workflow = (ROOT / "claude/config/CLAUDE.md").read_text()
        missing = {c for c in stems("claude/plugin/commands/*.md") if f"`/{c}`" not in workflow}
        self.assertEqual(missing, set())


if __name__ == "__main__":
    unittest.main()
