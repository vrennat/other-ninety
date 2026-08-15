#!/usr/bin/env python3

import unittest

from scripts.check_leaks import compile_private_pattern


class PrivatePatternTest(unittest.TestCase):
    def test_name_patterns_match_words_not_substrings(self) -> None:
        pattern = compile_private_pattern("ProjectX")
        self.assertIsNotNone(pattern.search("ProjectX configuration"))
        self.assertIsNone(pattern.search("MyProjectX configuration"))

    def test_nonword_patterns_remain_literal(self) -> None:
        pattern = compile_private_pattern("config/private")
        self.assertIsNotNone(pattern.search("path=config/private/repo"))


if __name__ == "__main__":
    unittest.main()
