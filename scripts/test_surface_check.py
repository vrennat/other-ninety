#!/usr/bin/env python3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
SCRIPT = ROOT / "claude/plugin/scripts/surface_check.py"
sys.path.insert(0, str(SCRIPT.parent))
import surface_check  # noqa: E402


class GlobTest(unittest.TestCase):
    def matches(self, glob, path):
        return bool(surface_check.glob_to_regex(glob).match(path))

    def test_star_stays_inside_one_segment(self):
        self.assertTrue(self.matches("*.md", "README.md"))
        self.assertFalse(self.matches("*.md", "docs/x.md"))

    def test_dir_double_star_covers_dir_and_below(self):
        for path in ("src", "src/a.ts", "src/a/b/c.ts"):
            self.assertTrue(self.matches("src/**", path), path)
        self.assertFalse(self.matches("src/**", "srcx/a.ts"))

    def test_leading_double_star_allows_no_prefix(self):
        self.assertTrue(self.matches("**/*.test.ts", "a.test.ts"))
        self.assertTrue(self.matches("**/*.test.ts", "x/y/a.test.ts"))
        self.assertFalse(self.matches("**/*.test.ts", "x/y/a.ts"))

    def test_question_mark_and_escaping(self):
        self.assertTrue(self.matches("v?.json", "v1.json"))
        self.assertFalse(self.matches("v?.json", "v12.json"))
        self.assertFalse(self.matches("a.b", "aXb"))

    def test_later_negation_wins(self):
        patterns = surface_check.parse_surface(["src/**", "!src/index.ts", "# comment", ""])
        self.assertTrue(surface_check.inside("src/a.ts", patterns))
        self.assertFalse(surface_check.inside("src/index.ts", patterns))


class RepoTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "surface-test")
        self.git("config", "user.name", "t")
        (self.repo / "src").mkdir()
        (self.repo / "src/a.ts").write_text("a")
        (self.repo / "README.md").write_text("r")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.git("checkout", "-q", "-b", "feature")

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(["git", "-C", str(self.repo), *args], check=True, capture_output=True)

    def run_check(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--repo", str(self.repo), *args],
            capture_output=True, text=True,
        )

    def test_committed_staged_and_untracked_changes_are_all_seen(self):
        (self.repo / "src/a.ts").write_text("changed")
        self.git("commit", "-qam", "edit")
        (self.repo / "src/b.ts").write_text("staged")
        self.git("add", "src/b.ts")
        (self.repo / "src/c.ts").write_text("untracked")
        result = self.run_check("src/**")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("3 changed vs main, 0 outside surface.", result.stdout)

    def test_change_outside_surface_fails_and_is_named(self):
        (self.repo / "README.md").write_text("touched")
        (self.repo / "src/a.ts").write_text("ok")
        result = self.run_check("src/**")
        self.assertEqual(result.returncode, 1)
        self.assertIn("OUTSIDE README.md", result.stdout)
        self.assertNotIn("OUTSIDE src/a.ts", result.stdout)

    def test_surface_file_is_read_and_excludes_itself(self):
        (self.repo / ".o90").mkdir()
        (self.repo / ".o90/surface").write_text("src/**\n!src/a.ts\n")
        (self.repo / "src/b.ts").write_text("new")
        self.assertEqual(self.run_check().returncode, 0)
        (self.repo / "src/a.ts").write_text("excluded")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("OUTSIDE src/a.ts", result.stdout)
        self.assertNotIn(".o90/surface", result.stdout)

    def test_no_surface_is_a_usage_error(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 2)
        self.assertIn("no surface given", result.stderr)


if __name__ == "__main__":
    unittest.main()
