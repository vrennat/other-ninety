#!/usr/bin/env python3
"""Check that a branch's changes stay inside an agent's write surface.

A surface is an ordered list of globs. Later lines win; a leading "!" excludes.
    **/     any number of leading directories, including none
    dir/**  the directory and everything below it
    *       any run of characters inside one path segment
    ?       one character inside one path segment

Changed files are everything different from the merge-base with the base
branch: commits on this branch, staged and unstaged edits, and untracked files.
Exit 0 when every changed file is inside the surface, 1 otherwise, 2 on usage
or git errors. Read-only.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

DEFAULT_SURFACE_FILE = ".o90/surface"


def glob_to_regex(glob: str) -> re.Pattern[str]:
    out = ""
    i = 0
    while i < len(glob):
        c = glob[i]
        if c == "*":
            if glob[i + 1 : i + 2] == "*":
                if glob[i + 2 : i + 3] == "/":
                    out += "(?:[^/]*/)*"
                    i += 3
                    continue
                if i > 0 and glob[i - 1] == "/":
                    out = out[:-1] + "(?:/.*)?"
                    i += 2
                    continue
                out += ".*"
                i += 2
                continue
            out += "[^/]*"
            i += 1
            continue
        if c == "?":
            out += "[^/]"
            i += 1
            continue
        out += re.escape(c)
        i += 1
    return re.compile("^" + out + "$")


def parse_surface(lines: list[str]) -> list[tuple[bool, re.Pattern[str]]]:
    patterns = []
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        negated = line.startswith("!")
        patterns.append((negated, glob_to_regex(line[1:] if negated else line)))
    return patterns


def inside(path: str, patterns: list[tuple[bool, re.Pattern[str]]]) -> bool:
    owned = False
    for negated, regex in patterns:
        if regex.match(path):
            owned = not negated
    return owned


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


def default_base(repo: Path) -> str:
    try:
        return git(repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD").strip().split("/", 1)[1]
    except RuntimeError:
        pass
    for candidate in ("main", "master"):
        if subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify", "-q", candidate], capture_output=True).returncode == 0:
            return candidate
    raise RuntimeError("no base branch found; pass --base")


def changed_files(repo: Path, base: str) -> list[str]:
    merge_base = git(repo, "merge-base", base, "HEAD").strip()
    tracked = git(repo, "diff", "--name-only", merge_base).splitlines()
    untracked = git(repo, "ls-files", "--others", "--exclude-standard").splitlines()
    return sorted(set(tracked) | set(untracked))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("globs", nargs="*", help="surface globs; later wins, '!' excludes")
    parser.add_argument("--surface-file", help=f"file with one glob per line (default: {DEFAULT_SURFACE_FILE} when present)")
    parser.add_argument("--base", help="base branch (default: origin HEAD, then main, then master)")
    parser.add_argument("--repo", default=".", help="repository or worktree path")
    parser.add_argument("--list", action="store_true", help="print every changed file with its status")
    args = parser.parse_args(argv)

    repo = Path(args.repo).resolve()
    lines = list(args.globs)
    surface_file = args.surface_file or (DEFAULT_SURFACE_FILE if (repo / DEFAULT_SURFACE_FILE).exists() else None)
    if surface_file:
        lines = (repo / surface_file).read_text().splitlines() + lines
    patterns = parse_surface(lines)
    if not patterns:
        print("surface_check: no surface given (pass globs or --surface-file)", file=sys.stderr)
        return 2

    try:
        base = args.base or default_base(repo)
        # The file that declares the surface is never judged by it.
        files = [f for f in changed_files(repo, base) if f != surface_file]
    except RuntimeError as error:
        print(f"surface_check: {error}", file=sys.stderr)
        return 2

    outside = [f for f in files if not inside(f, patterns)]
    if args.list:
        for f in files:
            print(f"{'outside' if f in outside else 'inside ':8} {f}")
    for f in outside:
        print(f"OUTSIDE {f}")
    print(f"{len(files)} changed vs {base}, {len(outside)} outside surface.")
    return 1 if outside else 0


if __name__ == "__main__":
    sys.exit(main())
