#!/usr/bin/env python3

import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.check_leaks import RULES, compile_private_pattern, fingerprint, history, scan_history, scan_text, tag_texts


class PrivatePatternTest(unittest.TestCase):
    def test_name_patterns_match_words_not_substrings(self) -> None:
        pattern = compile_private_pattern("ProjectX")
        self.assertIsNotNone(pattern.search("ProjectX configuration"))
        self.assertIsNone(pattern.search("MyProjectX configuration"))

    def test_nonword_patterns_remain_literal(self) -> None:
        pattern = compile_private_pattern("config/private")
        self.assertIsNotNone(pattern.search("path=config/private/repo"))

    def test_github_noreply_email_is_public_safe(self) -> None:
        findings = scan_text(
            "12345+person@users.noreply.github.com",
            {"email address": RULES["email address"]},
            "commit",
        )
        self.assertEqual(findings, [])

    def test_anthropic_noreply_email_is_public_safe(self) -> None:
        findings = scan_text(
            "noreply" + "@" + "anthropic.com",
            {"email address": RULES["email address"]},
            "commit",
        )
        self.assertEqual(findings, [])

    def test_regular_email_still_fails_beside_noreply_email(self) -> None:
        findings = scan_text(
            "12345+person@users.noreply.github.com person" + "@" + "private.test",
            {"email address": RULES["email address"]},
            "commit",
        )
        self.assertEqual(findings, ["commit:1: email address"])

    def test_history_baseline_is_limited_to_exact_commit(self) -> None:
        email = "person" + "@" + "private.test"
        rules = {"email address": RULES["email address"]}
        baseline = {"allowed": {"email address": {fingerprint(email)}}}

        self.assertEqual(scan_history([("allowed", email)], rules, baseline), [])
        self.assertEqual(
            scan_history([("new-commit", email)], rules, baseline),
            ["git-history:new-commit: email address"],
        )


class HistoryTest(unittest.TestCase):
    def test_commit_identity_is_skipped_but_message_is_scanned(self) -> None:
        email = "person" + "@" + "private.test"
        trailer = "other" + "@" + "private.test"
        with tempfile.TemporaryDirectory() as tmp:
            git = ["git", "-C", tmp, "-c", "user.name=P", "-c", f"user.email={email}"]
            subprocess.run(["git", "init", "-q", tmp], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", f"msg\n\nCo-authored-by: O <{trailer}>"], check=True)
            text = "".join(body for _, body in history(Path(tmp)))
        self.assertNotIn(email, text)
        self.assertIn(trailer, text)

    def test_history_is_what_the_checked_out_commit_reaches(self) -> None:
        on_head = "head" + "@" + "private.test"
        elsewhere = "side" + "@" + "private.test"
        with tempfile.TemporaryDirectory() as tmp:
            author = "p" + "@" + "example.com"
            git = ["git", "-C", tmp, "-c", "user.name=P", "-c", f"user.email={author}"]
            subprocess.run(["git", "init", "-q", "-b", "main", tmp], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", "base"], check=True)
            subprocess.run([*git, "checkout", "-q", "-b", "side"], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", f"leak {elsewhere}"], check=True)
            subprocess.run([*git, "checkout", "-q", "main"], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", f"leak {on_head}"], check=True)
            text = "".join(body for _, body in history(Path(tmp)))
        self.assertIn(on_head, text)
        self.assertNotIn(elsewhere, text)

    def test_history_follows_merges_detached_heads_and_named_revisions(self) -> None:
        merged = "merged" + "@" + "private.test"
        detached = "detached" + "@" + "private.test"
        with tempfile.TemporaryDirectory() as tmp:
            author = "p" + "@" + "example.com"
            git = ["git", "-C", tmp, "-c", "user.name=P", "-c", f"user.email={author}"]
            subprocess.run(["git", "init", "-q", "-b", "main", tmp], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", "base"], check=True)
            subprocess.run([*git, "checkout", "-q", "-b", "feature"], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", f"leak {merged}"], check=True)
            subprocess.run([*git, "checkout", "-q", "main"], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", "main moves on"], check=True)
            subprocess.run([*git, "merge", "-q", "--no-ff", "--no-edit", "feature"], check=True)
            self.assertIn(merged, "".join(body for _, body in history(Path(tmp))))

            subprocess.run([*git, "checkout", "-q", "-b", "other", "main~1"], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", f"leak {detached}"], check=True)
            other = subprocess.run([*git, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
            subprocess.run([*git, "checkout", "-q", "--detach", other], check=True)
            self.assertIn(detached, "".join(body for _, body in history(Path(tmp))))

            subprocess.run([*git, "checkout", "-q", "main"], check=True)
            self.assertNotIn(detached, "".join(body for _, body in history(Path(tmp))))
            self.assertIn(detached, "".join(body for _, body in history(Path(tmp), [other])))

    def test_merge_resolution_content_is_scanned(self) -> None:
        resolved = "resolved" + "@" + "private.test"
        with tempfile.TemporaryDirectory() as tmp:
            author = "p" + "@" + "example.com"
            git = ["git", "-C", tmp, "-c", "user.name=P", "-c", f"user.email={author}"]
            subprocess.run(["git", "init", "-q", "-b", "main", tmp], check=True)
            note = Path(tmp) / "note.txt"
            note.write_text("base\n")
            subprocess.run([*git, "add", "note.txt"], check=True)
            subprocess.run([*git, "commit", "-q", "-m", "base"], check=True)
            subprocess.run([*git, "checkout", "-q", "-b", "side"], check=True)
            note.write_text("side\n")
            subprocess.run([*git, "commit", "-q", "-am", "side"], check=True)
            subprocess.run([*git, "checkout", "-q", "main"], check=True)
            note.write_text("main\n")
            subprocess.run([*git, "commit", "-q", "-am", "main"], check=True)
            subprocess.run([*git, "merge", "-q", "side"], capture_output=True)
            note.write_text(f"{resolved}\n")
            subprocess.run([*git, "commit", "-q", "-am", "merge side"], check=True)
            text = "".join(body for _, body in history(Path(tmp)))
        self.assertIn(resolved, text)

    def test_tag_messages_and_tagged_blobs_are_scanned_without_the_tagger(self) -> None:
        in_message = "message" + "@" + "private.test"
        in_blob = "blob" + "@" + "private.test"
        tagger = "tagger" + "@" + "private.test"
        with tempfile.TemporaryDirectory() as tmp:
            git = ["git", "-C", tmp, "-c", "user.name=T", "-c", f"user.email={tagger}"]
            subprocess.run(["git", "init", "-q", "-b", "main", tmp], check=True)
            subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", "base"], check=True)
            subprocess.run([*git, "tag", "-a", "v1", "-m", f"release by {in_message}"], check=True)
            blob = subprocess.run(
                [*git, "hash-object", "-w", "--stdin"], input=f"{in_blob}\n", capture_output=True, text=True, check=True
            ).stdout.strip()
            subprocess.run([*git, "tag", "data", blob], check=True)
            subprocess.run([*git, "tag", "plain"], check=True)
            texts = dict(tag_texts(Path(tmp)))
        self.assertIn(in_message, texts["v1"])
        self.assertNotIn(tagger, texts["v1"])
        self.assertIn(in_blob, texts["data"])
        self.assertNotIn("plain", texts)

if __name__ == "__main__":
    unittest.main()
