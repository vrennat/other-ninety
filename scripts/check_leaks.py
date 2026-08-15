#!/usr/bin/env python3
"""Conservative public-repo leak check with a built-in positive control."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


RULES = {
    "email address": re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),
    "absolute user home": re.compile(r"(?<![$A-Za-z0-9_])/(?:Users|home)/(?!test(?:/|\b)|example(?:/|\b))[A-Za-z0-9._-]+"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "API token shape": re.compile(
        r"(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|"
        r"AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,})"
    ),
    "legacy product name": re.compile("developers" + "Developers", re.IGNORECASE),
}

SKIP_PARTS = {".git", "node_modules", "__pycache__"}


def files(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        capture_output=True,
        check=True,
    )
    return [root / value.decode() for value in result.stdout.split(b"\0") if value]


def compile_private_pattern(value: str) -> re.Pattern[str]:
    escaped = re.escape(value)
    if value[0].isalnum() and value[-1].isalnum():
        escaped = rf"(?<!\w){escaped}(?!\w)"
    return re.compile(escaped, re.IGNORECASE)


def scan_text(text: str, rules: dict[str, re.Pattern[str]], location: str) -> list[str]:
    findings: list[str] = []
    for line_number, line in enumerate(text.splitlines(), 1):
        for name, pattern in rules.items():
            if pattern.search(line):
                findings.append(f"{location}:{line_number}: {name}")
    return findings


def history(root: Path) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), "log", "--all", "--format=fuller", "--patch", "--no-color"],
        capture_output=True,
        check=True,
    )
    return result.stdout.decode("utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check worktree and Git history for likely private data.")
    parser.add_argument("--patterns-file", type=Path, help="private file with one additional literal per line")
    parser.add_argument("--no-history", action="store_true", help="skip committed history")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    rules = dict(RULES)
    if args.patterns_file:
        for index, value in enumerate(args.patterns_file.read_text().splitlines(), 1):
            value = value.strip()
            if value and not value.startswith("#"):
                rules[f"private pattern {index}"] = compile_private_pattern(value)

    controls = [
        ("email", "email address", "person" + "@" + "example.com"),
        ("home", "absolute user home", "/" + "Users" + "/privateuser/file"),
        ("key", "private key", "-----BEGIN " + "PRIVATE KEY-----"),
        ("sk token", "API token shape", "s" + "k-" + "A" * 24),
        ("GitHub PAT", "API token shape", "g" + "hp_" + "A" * 36),
        ("GitHub OAuth", "API token shape", "g" + "ho_" + "A" * 36),
        ("Slack token", "API token shape", "x" + "oxb-" + "A" * 24),
        ("AWS key", "API token shape", "A" + "KIA" + "A" * 16),
        ("GitLab PAT", "API token shape", "g" + "lpat-" + "A" * 24),
        ("Google key", "API token shape", "A" + "Iza" + "A" * 24),
        ("legacy name", "legacy product name", "developers" + "Developers"),
    ]
    for label, name, value in controls:
        matches = scan_text(value, {name: rules[name]}, "positive-control")
        if not matches:
            print(f"FAIL: positive control was not detected for {label}", file=sys.stderr)
            return 2
    print(f"positive controls: detected ({len(controls)} cases across {len(rules)} rules)")

    findings: list[str] = []
    for path in files(root):
        if not path.is_file() or any(part in SKIP_PARTS for part in path.parts):
            continue
        try:
            text = path.read_bytes().decode("utf-8", errors="replace")
        except OSError:
            continue
        findings.extend(scan_text(text, rules, str(path.relative_to(root))))

    if not args.no_history:
        committed = history(root)
        if committed:
            for name, pattern in rules.items():
                if pattern.search(committed):
                    findings.append(f"git-history: {name}")

    if findings:
        print("FAIL: possible private data found", file=sys.stderr)
        for finding in findings:
            print(f"  {finding}", file=sys.stderr)
        return 1

    print("RESULT: no configured leak patterns found")
    print("Manual review is still required; pattern scans cannot prove prose is public-safe or inspect deleted binary blobs in Git history.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
