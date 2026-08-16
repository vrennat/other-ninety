#!/usr/bin/env python3

import unittest

from scripts.check_leaks import RULES, compile_private_pattern, fingerprint, scan_history, scan_text


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


if __name__ == "__main__":
    unittest.main()
