#!/usr/bin/env python3
"""Read-only drift report for The Other Ninety managed paths."""

from __future__ import annotations

import argparse
import filecmp
import json
import os
from pathlib import Path


VOLATILE = {"lastChangelogVersion", "model"}

CLAUDE_LINKS = ("CLAUDE.md", "post-compact-rules.md", "rules", "hooks", "agents")
CLAUDE_COPIES = {"settings.json", "keybindings.json"}
PI_LINKS = ("AGENTS.md", "APPEND_SYSTEM.md", "agents", "extensions", "prompts", "themes")
PI_COPIES = {"settings.json", "mcp.json"}


def linked_names(base: tuple[str, ...], overlay_dir: Path | None, copied: set[str]) -> list[str]:
    """Names install.py symlinks: the base set plus whatever else the overlay carries."""
    names = list(base)
    if overlay_dir and overlay_dir.is_dir():
        extra = (item.name for item in overlay_dir.iterdir() if item.name != "skills" and item.name not in copied)
        names.extend(name for name in sorted(extra) if name not in names)
    return names


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
    if left.is_file() and right.is_file():
        return left.read_bytes() == right.read_bytes()
    if left.is_dir() and right.is_dir():
        comparison = filecmp.dircmp(left, right)
        if comparison.left_only or comparison.right_only or comparison.diff_files or comparison.funny_files:
            return False
        return all(same_tree(left / name, right / name) for name in comparison.common_dirs)
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
    parser.add_argument("--overlay", type=Path)
    parser.add_argument("--claude-dir", type=Path)
    parser.add_argument("--pi-dir", type=Path)
    parser.add_argument("--pi-root", type=Path)
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    claude_base = repo / "claude" / "config"
    pi_base = repo / "pi"
    overlay = args.overlay.expanduser().resolve() if args.overlay else None
    claude_overlay = overlay / "claude" if overlay else None
    pi_overlay = overlay / "pi" if overlay else None
    pi_root_overlay = overlay / "pi-root" if overlay else None

    claude_dir = (args.claude_dir or Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))).expanduser().absolute()
    pi_dir = (args.pi_dir or Path(os.environ.get("PI_CODING_AGENT_DIR", Path.home() / ".pi" / "agent"))).expanduser().absolute()
    pi_root = (args.pi_root or Path(os.environ.get("PI_ROOT_DIR", pi_dir.parent))).expanduser().absolute()

    drift: list[str] = []
    checked = 0

    def source(base: Path, override: Path | None, name: str) -> Path:
        candidate = override / name if override else None
        return candidate if candidate and candidate.exists() else base / name

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

    for name in linked_names(CLAUDE_LINKS, claude_overlay, CLAUDE_COPIES):
        check_link(source(claude_base, claude_overlay, name), claude_dir / name)

    claude_settings = source(claude_base, claude_overlay, "settings.json") if claude_overlay and (claude_overlay / "settings.json").exists() else claude_base / "settings.example.json"
    check_copy(claude_settings, claude_dir / "settings.json", json_subset=True, exact=bool(claude_overlay and (claude_overlay / "settings.json").exists()))
    check_copy(source(claude_base, claude_overlay, "keybindings.json"), claude_dir / "keybindings.json", json_subset=True, exact=True)

    expected_claude_skills = {item.name: item for item in (claude_base / "skills").glob("*")}
    if claude_overlay and (claude_overlay / "skills").is_dir():
        expected_claude_skills.update({item.name: item for item in (claude_overlay / "skills").glob("*")})
    for name, src in sorted(expected_claude_skills.items()):
        check_copy(src, claude_dir / "skills" / name)

    for name in linked_names(PI_LINKS, pi_overlay, PI_COPIES):
        check_link(source(pi_base, pi_overlay, name), pi_dir / name)
    for name in ("settings.json", "mcp.json"):
        src = source(pi_base, pi_overlay, name)
        check_copy(src, pi_dir / name, json_subset=True, exact=bool(pi_overlay and (pi_overlay / name).exists()))
    web_source = source(pi_base, pi_root_overlay, "web-search.json")
    check_copy(web_source, pi_root / "web-search.json", json_subset=True, exact=bool(pi_root_overlay and (pi_root_overlay / "web-search.json").exists()))

    expected_pi_skills = {item.name: item for item in (pi_base / "skills").glob("*")}
    if pi_overlay and (pi_overlay / "skills").is_dir():
        expected_pi_skills.update({item.name: item for item in (pi_overlay / "skills").glob("*")})
    for name, src in sorted(expected_pi_skills.items()):
        check_link(src, pi_dir / "skills" / name)

    strays, scanned = stray_links(
        [claude_dir, claude_dir / "skills", pi_dir, pi_dir / "skills"],
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
    raise SystemExit(main())
