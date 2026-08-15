#!/usr/bin/env python3
"""Dry-run-first installer for The Other Ninety."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class Operation:
    action: str
    source: Path
    target: Path


def lexists(path: Path) -> bool:
    return os.path.lexists(path)


def remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)


def copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, target, symlinks=True)
    else:
        shutil.copy2(source, target, follow_symlinks=False)


def add_base_operations(repo: Path, claude_dir: Path, pi_dir: Path, pi_root: Path) -> list[Operation]:
    operations: list[Operation] = []
    claude = repo / "config" / "claude"
    pi = repo / "adapters" / "pi"

    for name in ("CLAUDE.md", "post-compact-rules.md", "rules", "hooks", "agents"):
        source = claude / name
        if source.exists():
            operations.append(Operation("link", source, claude_dir / name))

    settings = claude / "settings.example.json"
    if settings.exists():
        operations.append(Operation("copy-if-missing", settings, claude_dir / "settings.json"))
    keybindings = claude / "keybindings.json"
    if keybindings.exists():
        operations.append(Operation("copy-if-missing", keybindings, claude_dir / "keybindings.json"))
    for source in sorted((claude / "skills").glob("*")):
        operations.append(Operation("copy-if-missing", source, claude_dir / "skills" / source.name))

    for name in ("settings.json", "mcp.json"):
        source = pi / name
        if source.exists():
            operations.append(Operation("copy-if-missing", source, pi_dir / name))
    web_search = pi / "web-search.json"
    if web_search.exists():
        operations.append(Operation("copy-if-missing", web_search, pi_root / "web-search.json"))
    for name in ("AGENTS.md", "APPEND_SYSTEM.md", "agents", "extensions", "prompts", "themes"):
        source = pi / name
        if source.exists():
            operations.append(Operation("link", source, pi_dir / name))
    for source in sorted((pi / "skills").glob("*")):
        operations.append(Operation("link", source, pi_dir / "skills" / source.name))

    return operations


def add_overlay_operations(
    operations: list[Operation], overlay: Path, claude_dir: Path, pi_dir: Path, pi_root: Path
) -> None:
    if not overlay.is_dir():
        raise ValueError(f"overlay is not a directory: {overlay}")

    claude = overlay / "claude"
    if claude.is_dir():
        for source in sorted(claude.iterdir()):
            if source.name == "skills" and source.is_dir():
                for skill in sorted(source.iterdir()):
                    operations.append(Operation("copy-replace", skill, claude_dir / "skills" / skill.name))
            elif source.name in {"settings.json", "keybindings.json"}:
                operations.append(Operation("copy-replace", source, claude_dir / source.name))
            else:
                operations.append(Operation("link", source, claude_dir / source.name))

    pi = overlay / "pi"
    if pi.is_dir():
        for source in sorted(pi.iterdir()):
            if source.name == "skills" and source.is_dir():
                for skill in sorted(source.iterdir()):
                    operations.append(Operation("link", skill, pi_dir / "skills" / skill.name))
            elif source.name in {"settings.json", "mcp.json"}:
                operations.append(Operation("copy-replace", source, pi_dir / source.name))
            else:
                operations.append(Operation("link", source, pi_dir / source.name))

    pi_root_overlay = overlay / "pi-root"
    if pi_root_overlay.is_dir():
        for source in sorted(pi_root_overlay.iterdir()):
            operations.append(Operation("copy-replace", source, pi_root / source.name))


def describe(operation: Operation) -> str:
    return f"{operation.action:15} {operation.target} <- {operation.source}"


def save_manifest(path: Path, manifest: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def ensure_parent(target: Path, roots: list[Path], manifest: dict) -> None:
    missing: list[Path] = []
    current = target.parent
    while not current.exists() and within(current, roots):
        missing.append(current)
        current = current.parent
    recorded = set(manifest["createdDirs"])
    for directory in reversed(missing):
        directory.mkdir(parents=True, exist_ok=True)
        if str(directory) not in recorded:
            manifest["createdDirs"].append(str(directory))
            recorded.add(str(directory))


def backup(target: Path, backup_dir: Path, manifest: dict, seen: set[str]) -> None:
    key = str(target)
    if key in seen:
        return
    seen.add(key)

    entry: dict[str, str] = {"target": key}
    if target.is_symlink():
        entry.update(kind="symlink", link=os.readlink(target))
    elif target.is_file():
        backup_path = backup_dir / "items" / f"{len(manifest['entries']):04d}"
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup_path, follow_symlinks=False)
        entry.update(kind="file", backup=str(backup_path))
    elif target.is_dir():
        backup_path = backup_dir / "items" / f"{len(manifest['entries']):04d}"
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(target, backup_path, symlinks=True)
        entry.update(kind="directory", backup=str(backup_path))
    else:
        entry["kind"] = "absent"
    manifest["entries"].append(entry)


def apply(operations: list[Operation], state_dir: Path, roots: list[Path]) -> Path:
    roots = list(dict.fromkeys(root.absolute() for root in roots))
    for root in roots:
        if root == Path(root.anchor):
            raise ValueError(f"refusing filesystem root as an install target: {root}")
    for operation in operations:
        if not operation.source.exists():
            raise ValueError(f"source is missing: {operation.source}")
        if not within(operation.target, roots):
            raise ValueError(f"target is outside configured roots: {operation.target}")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = state_dir / "backups" / timestamp
    suffix = 1
    while backup_dir.exists():
        backup_dir = state_dir / "backups" / f"{timestamp}-{suffix}"
        suffix += 1
    backup_dir.mkdir(parents=True)
    os.chmod(backup_dir, 0o700)
    manifest_path = backup_dir / "manifest.json"
    manifest: dict = {
        "version": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "applying",
        "roots": [str(root.absolute()) for root in roots],
        "entries": [],
        "createdDirs": [],
    }
    save_manifest(manifest_path, manifest)
    seen: set[str] = set()

    try:
        for operation in operations:
            target = operation.target
            source = operation.source.resolve()
            if operation.action == "copy-if-missing" and lexists(target):
                print(f"keep            {target}")
                continue
            if operation.action == "link" and target.is_symlink() and target.resolve() == source:
                print(f"current         {target}")
                continue

            backup(target, backup_dir, manifest, seen)
            ensure_parent(target, roots, manifest)
            save_manifest(manifest_path, manifest)
            remove(target)
            if operation.action == "link":
                target.symlink_to(source)
            else:
                copy(source, target)
            print(describe(operation))
    except Exception:
        print(f"Apply failed. Roll back with: {sys.argv[0]} --rollback {manifest_path}", file=sys.stderr)
        raise

    manifest["status"] = "complete"
    save_manifest(manifest_path, manifest)
    print(f"manifest        {manifest_path}")
    return manifest_path


def location(path: Path) -> Path:
    """Resolve parent aliases and `..` without following the final path's symlink."""
    absolute = path.expanduser().absolute()
    return absolute.parent.resolve(strict=False) / absolute.name


def within(path: Path, roots: list[Path]) -> bool:
    candidate = location(path)
    canonical_roots = [root.expanduser().resolve(strict=False) for root in roots]
    return any(candidate == root or candidate.is_relative_to(root) for root in canonical_roots)


def rollback(manifest_path: Path) -> None:
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("version") != 1 or not isinstance(manifest.get("entries"), list):
        raise ValueError("unsupported or invalid rollback manifest")
    if manifest.get("status") == "rolled-back":
        raise ValueError("manifest has already been rolled back")
    if manifest.get("status") not in {"applying", "complete"}:
        raise ValueError(f"manifest has invalid status: {manifest.get('status')}")
    roots = [Path(value).absolute() for value in manifest.get("roots", [])]
    if not roots or any(root == Path(root.anchor) for root in roots):
        raise ValueError("rollback manifest has invalid target roots")

    items_dir = (manifest_path.parent / "items").resolve(strict=False)
    seen_targets: set[Path] = set()
    for entry in manifest["entries"]:
        target = Path(entry["target"]).absolute()
        canonical_target = location(target)
        if canonical_target in seen_targets:
            raise ValueError(f"rollback manifest repeats target: {target}")
        seen_targets.add(canonical_target)
        if not within(target, roots):
            raise ValueError(f"refusing to restore path outside recorded roots: {target}")
        if entry.get("kind") in {"file", "directory"}:
            backup_path = Path(entry.get("backup", "")).resolve(strict=False)
            if not backup_path.is_relative_to(items_dir) or not backup_path.exists():
                raise ValueError(f"missing or invalid backup for: {target}")
    for value in manifest.get("createdDirs", []):
        if not within(Path(value), roots):
            raise ValueError(f"created directory is outside recorded roots: {value}")

    for entry in reversed(manifest["entries"]):
        target = Path(entry["target"]).absolute()
        remove(target)
        kind = entry["kind"]
        if kind == "absent":
            pass
        elif kind == "symlink":
            target.parent.mkdir(parents=True, exist_ok=True)
            target.symlink_to(entry["link"])
        elif kind in {"file", "directory"}:
            copy(Path(entry["backup"]), target)
        else:
            raise ValueError(f"unknown prior state: {kind}")
        print(f"restored        {target} ({kind})")

    for value in sorted(manifest.get("createdDirs", []), key=lambda item: len(Path(item).parts), reverse=True):
        directory = Path(value).absolute()
        if within(directory, roots) and directory.is_dir():
            try:
                directory.rmdir()
                print(f"removed         {directory} (created directory)")
            except OSError:
                pass

    manifest["status"] = "rolled-back"
    manifest["rolledBackAt"] = datetime.now(timezone.utc).isoformat()
    save_manifest(manifest_path, manifest)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install The Other Ninety. Defaults to dry-run.")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true", help="apply the displayed changes")
    action.add_argument("--rollback", type=Path, metavar="MANIFEST", help="restore a prior apply")
    parser.add_argument("--overlay", type=Path, help="external private overlay directory")
    parser.add_argument("--claude-dir", type=Path, help="Claude config target")
    parser.add_argument("--pi-dir", type=Path, help="Pi agent config target")
    parser.add_argument("--pi-root", type=Path, help="Pi root target for web-search.json")
    parser.add_argument("--state-dir", type=Path, help="backup and manifest directory")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.rollback:
        rollback(args.rollback.expanduser().resolve())
        return 0

    repo = Path(__file__).resolve().parents[1]
    claude_dir = (args.claude_dir or Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))).expanduser().absolute()
    pi_dir = (args.pi_dir or Path(os.environ.get("PI_CODING_AGENT_DIR", Path.home() / ".pi" / "agent"))).expanduser().absolute()
    pi_root = (args.pi_root or Path(os.environ.get("PI_ROOT_DIR", pi_dir.parent))).expanduser().absolute()
    state_dir = (args.state_dir or Path(os.environ.get("OTHER_NINETY_STATE_DIR", Path.home() / ".local" / "state" / "other-ninety"))).expanduser().absolute()

    operations = add_base_operations(repo, claude_dir, pi_dir, pi_root)
    if args.overlay:
        add_overlay_operations(operations, args.overlay.expanduser().resolve(), claude_dir, pi_dir, pi_root)

    print(f"Claude target: {claude_dir}")
    print(f"Pi target:     {pi_dir}")
    print(f"Pi root:       {pi_root}")
    print("Mode:          apply" if args.apply else "Mode:          dry-run (no writes)")
    for operation in operations:
        print(describe(operation))

    if not args.apply:
        print("No changes made. Re-run with --apply after reviewing this plan.")
        return 0

    manifest = apply(operations, state_dir, [claude_dir, pi_dir, pi_root])
    print(f"Rollback: {Path(__file__).resolve()} --rollback {manifest}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
