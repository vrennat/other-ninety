#!/usr/bin/env python3

import unittest

from scripts.check_leaks import RULES, compile_private_pattern, scan_text


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

    def test_regular_email_still_fails_beside_noreply_email(self) -> None:
        findings = scan_text(
            "12345+person@users.noreply.github.com person" + "@" + "private.test",
            {"email address": RULES["email address"]},
            "commit",
        )
        self.assertEqual(findings, ["commit:1: email address"])


if __name__ == "__main__":
    unittest.main()
