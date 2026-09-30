#!/usr/bin/env python3
"""Read-only drift report for The Other Ninety managed paths."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


from install import COMPONENTS, PI_TEXT, lexists, plan_operations, target_dirs

VOLATILE = {"lastChangelogVersion", "model"}


def stray_links(directories: list[Path], sources: list[Path]) -> tuple[list[str], int]:
    """Symlinks living in a managed directory that resolve outside every managed source.

    The name-by-name checks below only inspect paths we expect, so a leftover pointer at a
    retired repo reads as clean. This sweep is what catches those.
    """
    findings: list[str] = []
    scanned = 0
    for directory in directories:
        if not directory.is_dir():
            continue
        for item in sorted(directory.iterdir()):
            if not item.is_symlink():
                continue
            scanned += 1
            target = item.resolve()
            if not any(target == source or target.is_relative_to(source) for source in sources):
                findings.append(f"{item}: points outside every managed source ({target})")
    return findings, scanned


def same_tree(left: Path, right: Path) -> bool:
    if left.is_symlink() or right.is_symlink():
        return left.is_symlink() and right.is_symlink() and left.readlink() == right.readlink()
    if left.is_file() and right.is_file():
        return left.read_bytes() == right.read_bytes()
    if left.is_dir() and right.is_dir():
        left_names = {item.name for item in left.iterdir()}
        right_names = {item.name for item in right.iterdir()}
        return left_names == right_names and all(same_tree(left / name, right / name) for name in left_names)
    return False


def strip_volatile(value: object) -> object:
    if isinstance(value, dict):
        return {key: strip_volatile(item) for key, item in value.items() if key not in VOLATILE}
    if isinstance(value, list):
        return [strip_volatile(item) for item in value]
    return value


def subset(expected: object, actual: object) -> bool:
    if isinstance(expected, dict) and isinstance(actual, dict):
        return all(key in actual and subset(value, actual[key]) for key, value in expected.items() if key not in VOLATILE)
    return strip_volatile(expected) == strip_volatile(actual)


def json_matches(source: Path, target: Path, exact: bool) -> bool:
    expected = json.loads(source.read_text())
    actual = json.loads(target.read_text())
    return strip_volatile(expected) == strip_volatile(actual) if exact else subset(expected, actual)


def main() -> int:
    parser = argparse.ArgumentParser(description="Report drift without changing files.")
    parser.add_argument(
        "--with", dest="components", action="append", choices=COMPONENTS, default=[],
        metavar="COMPONENT", help="select the exact installed component set",
    )
    parser.add_argument("--overlay", type=Path)
    parser.add_argument("--claude-dir", type=Path)
    parser.add_argument("--codex-dir", type=Path)
    parser.add_argument("--pi-dir", type=Path)
    parser.add_argument("--pi-root", type=Path)
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    components = set(args.components) if args.components else {"pi"}
    overlay = args.overlay.expanduser().resolve() if args.overlay else None
    claude_dir, pi_dir, pi_root, codex_dir = target_dirs(args)
    operations = plan_operations(repo, components, overlay, claude_dir, pi_dir, pi_root, codex_dir)

    drift: list[str] = []
    checked = 0

    def check_link(src: Path, dst: Path) -> None:
        nonlocal checked
        if not src.exists():
            return
        checked += 1
        if not dst.is_symlink():
            drift.append(f"{dst}: expected symlink to {src.resolve()}")
        elif dst.resolve() != src.resolve():
            drift.append(f"{dst}: points to {dst.resolve()}, expected {src.resolve()}")

    def check_copy(src: Path, dst: Path, *, json_subset: bool = False, exact: bool = True) -> None:
        nonlocal checked
        if not src.exists():
            return
        checked += 1
        if not dst.exists():
            drift.append(f"{dst}: missing")
            return
        try:
            matches = json_matches(src, dst, exact=exact) if json_subset else same_tree(src, dst)
        except (json.JSONDecodeError, OSError) as error:
            drift.append(f"{dst}: could not compare ({error})")
            return
        if not matches:
            drift.append(f"{dst}: differs from {src}")

    for operation in operations:
        src, dst = operation.source, operation.target
        if operation.action == "link-if-missing" and lexists(dst) and not dst.is_symlink():
            print(f"UNMANAGED: {dst} (preserved user copy)")
        elif operation.action in {"link", "link-if-missing"}:
            check_link(src, dst)
        else:
            # Public mutable defaults allow user additions; an overlay owns its
            # complete replacement. Keybindings have always compared exactly.
            check_copy(src.resolve(), dst, json_subset=src.suffix == ".json",
                       exact=operation.action == "copy-replace" or dst.name == "keybindings.json")

    if "pi" in components and "pi-text" not in components:
        for name in PI_TEXT:
            target = pi_dir / name
            checked += 1
            if target.is_symlink() and any(
                target.resolve().is_relative_to(source.resolve()) for source in [repo, *([overlay] if overlay else [])]
            ):
                drift.append(f"{target}: o90 text linked without --with pi-text")

    stray_directories: list[Path] = []
    if "pi" in components:
        stray_directories.extend((pi_dir, pi_dir / "skills"))
    if "claude" in components:
        stray_directories.extend((claude_dir, claude_dir / "skills"))
    strays, scanned = stray_links(
        stray_directories,
        [repo, *([overlay] if overlay else [])],
    )
    drift.extend(strays)

    print(f"checked: {checked} managed paths")
    print(f"scanned: {scanned} symlinks in managed directories")
    if drift:
        for item in drift:
            print(f"DRIFT: {item}")
        print(f"RESULT: {len(drift)} drift finding(s)")
        return 1
    print("RESULT: clean")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
