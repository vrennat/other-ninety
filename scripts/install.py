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


CODEX_PLUGIN_SKILLS = (
    "clean-writing",
    "onboarding",
    "plan-hunter",
    "systematic-debugging",
    "verification-before-completion",
)


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


def lexical_path(path: Path) -> Path:
    """Return an absolute normalized path without resolving symlinks."""
    return Path(os.path.abspath(path))


def symlink_points_to_source(target: Path, source: Path) -> bool:
    """Match installer-owned links even when their destination is now dangling.

    Older installs linked through the repository's top-level ``skills`` path.
    The Codex plugin uses the canonical plugin skill path. Both spellings belong
    to this checkout; resolving the final destination alone cannot recognize a
    dangling legacy link safely.
    """
    if not target.is_symlink():
        return False
    link = Path(os.readlink(target))
    destination = link if link.is_absolute() else target.parent / link
    expected = {lexical_path(source), source.resolve(strict=False)}
    return lexical_path(destination) in expected


COMPONENTS = ("pi", "claude", "codex", "cursor")


def add_pi_operations(repo: Path, pi_dir: Path, pi_root: Path, bin_dir: Path) -> list[Operation]:
    operations: list[Operation] = []
    pi = repo / "pi"

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
    pi_skills = {source.name: source for source in (pi / "skills").glob("*")}
    shared_skills = {source.name: source for source in (repo / "skills").glob("*")}
    for name, source in sorted({**shared_skills, **pi_skills}.items()):
        operations.append(Operation("link", source, pi_dir / "skills" / source.name))
    operations.append(Operation("link", repo / "bin" / "o90-pi", bin_dir / "o90-pi"))

    return operations


def add_claude_operations(repo: Path, claude_dir: Path) -> list[Operation]:
    operations: list[Operation] = []
    claude = repo / "claude" / "config"

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

    return operations


def add_codex_operations(
    repo: Path, codex_dir: Path, agents_dir: Path, *, plugin_ready: bool
) -> list[Operation]:
    operations = [Operation("link", repo / "codex" / "AGENTS.md", codex_dir / "AGENTS.md")]
    for source in sorted((repo / "codex" / "agents").glob("*.toml")):
        operations.append(Operation("link", source, codex_dir / "agents" / source.name))
    if plugin_ready:
        for name in CODEX_PLUGIN_SKILLS:
            operations.append(
                Operation(
                    "remove-owned-link",
                    repo / "skills" / name,
                    agents_dir / "skills" / name,
                )
            )
    return operations


def add_cursor_operations(repo: Path, cursor_projects: list[Path]) -> list[Operation]:
    operations: list[Operation] = []
    rule = repo / "cursor" / "rules" / "o90.mdc"
    for project in cursor_projects:
        operations.append(Operation("copy-replace", rule, project / ".cursor" / "rules" / "o90.mdc"))
        for agent in sorted((repo / "cursor" / "agents").glob("*.md")):
            operations.append(Operation("link", agent, project / ".cursor" / "agents" / agent.name))
        for skill in sorted((repo / "skills").glob("*")):
            operations.append(Operation("link", skill, project / ".cursor" / "skills" / skill.name))
    return operations


def add_pi_integration_operations(
    repo: Path, components: set[str], agents_dir: Path, cursor_projects: list[Path]
) -> list[Operation]:
    operations: list[Operation] = []
    skill = repo / "integrations" / "pi-worker"
    if "codex" in components:
        operations.append(Operation("link", skill, agents_dir / "skills" / "o90-pi-worker"))
    if "cursor" in components:
        for project in cursor_projects:
            operations.append(Operation("link", skill, project / ".cursor" / "skills" / "o90-pi-worker"))
    return operations


def add_overlay_operations(
    operations: list[Operation], overlay: Path, components: set[str], claude_dir: Path,
    pi_dir: Path, pi_root: Path
) -> None:
    if not overlay.is_dir():
        raise ValueError(f"overlay is not a directory: {overlay}")

    claude = overlay / "claude"
    if "claude" in components and claude.is_dir():
        for source in sorted(claude.iterdir()):
            if source.name == "skills" and source.is_dir():
                for skill in sorted(source.iterdir()):
                    operations.append(Operation("copy-replace", skill, claude_dir / "skills" / skill.name))
            elif source.name in {"settings.json", "keybindings.json"}:
                operations.append(Operation("copy-replace", source, claude_dir / source.name))
            else:
                operations.append(Operation("link", source, claude_dir / source.name))

    pi = overlay / "pi"
    if "pi" in components and pi.is_dir():
        for source in sorted(pi.iterdir()):
            if source.name == "skills" and source.is_dir():
                for skill in sorted(source.iterdir()):
                    operations.append(Operation("link", skill, pi_dir / "skills" / skill.name))
            elif source.name in {"settings.json", "mcp.json"}:
                operations.append(Operation("copy-replace", source, pi_dir / source.name))
            else:
                operations.append(Operation("link", source, pi_dir / source.name))

    pi_root_overlay = overlay / "pi-root"
    if "pi" in components and pi_root_overlay.is_dir():
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
        if operation.action not in {"link", "copy-if-missing", "copy-replace", "remove-owned-link"}:
            raise ValueError(f"unknown install action: {operation.action}")
        if operation.action != "remove-owned-link" and not operation.source.exists():
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
            source = operation.source.resolve(strict=False)
            if operation.action == "remove-owned-link":
                if not symlink_points_to_source(target, operation.source):
                    print(f"keep            {target} (not an owned legacy link)")
                    continue
                backup(target, backup_dir, manifest, seen)
                save_manifest(manifest_path, manifest)
                remove(target)
                print(describe(operation))
                continue
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
    parser.add_argument(
        "--with", dest="components", action="append", choices=COMPONENTS, default=[],
        metavar="COMPONENT", help="select an exact component set (repeat for pi, claude, codex, cursor)",
    )
    parser.add_argument("--overlay", type=Path, help="external private overlay directory")
    parser.add_argument("--claude-dir", type=Path, help="Claude config target")
    parser.add_argument("--codex-dir", type=Path, help="Codex home target")
    parser.add_argument(
        "--agents-dir",
        type=Path,
        help="user agent config root for optional integrations and legacy Codex skill cleanup",
    )
    parser.add_argument(
        "--codex-plugin-ready",
        action="store_true",
        help="confirm the Codex plugin is installed before retiring checkout-owned legacy skill links",
    )
    parser.add_argument(
        "--cursor-project", type=Path, action="append", default=[],
        help="project that receives the o90 Cursor rule (repeatable; requires --with cursor)",
    )
    parser.add_argument("--pi-dir", type=Path, help="Pi agent config target")
    parser.add_argument("--pi-root", type=Path, help="Pi root target for web-search.json")
    parser.add_argument("--bin-dir", type=Path, help="target for the o90-pi leaf-worker command")
    parser.add_argument("--state-dir", type=Path, help="backup and manifest directory")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.rollback:
        rollback(args.rollback.expanduser().resolve())
        return 0

    repo = Path(__file__).resolve().parents[1]
    components = set(args.components) if args.components else {"pi"}
    if args.codex_plugin_ready and "codex" not in components:
        raise ValueError("--codex-plugin-ready requires --with codex")
    if "cursor" in components and not args.cursor_project:
        raise ValueError("--with cursor requires at least one --cursor-project")
    if args.cursor_project and "cursor" not in components:
        raise ValueError("--cursor-project requires --with cursor")

    claude_dir = (args.claude_dir or Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))).expanduser().absolute()
    codex_dir = (args.codex_dir or Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))).expanduser().absolute()
    agents_dir = (args.agents_dir or Path(os.environ.get("OTHER_NINETY_AGENTS_DIR", Path.home() / ".agents"))).expanduser().absolute()
    pi_dir = (args.pi_dir or Path(os.environ.get("PI_CODING_AGENT_DIR", Path.home() / ".pi" / "agent"))).expanduser().absolute()
    pi_root = (args.pi_root or Path(os.environ.get("PI_ROOT_DIR", pi_dir.parent))).expanduser().absolute()
    bin_dir = (args.bin_dir or Path(os.environ.get("OTHER_NINETY_BIN_DIR", Path.home() / ".local" / "bin"))).expanduser().absolute()
    cursor_projects = [project.expanduser().absolute() for project in args.cursor_project]
    for project in cursor_projects:
        if not project.is_dir():
            raise ValueError(f"cursor project is not a directory: {project}")
    state_dir = (args.state_dir or Path(os.environ.get("OTHER_NINETY_STATE_DIR", Path.home() / ".local" / "state" / "other-ninety"))).expanduser().absolute()

    operations: list[Operation] = []
    if "pi" in components:
        operations.extend(add_pi_operations(repo, pi_dir, pi_root, bin_dir))
    if "claude" in components:
        operations.extend(add_claude_operations(repo, claude_dir))
    if "codex" in components:
        operations.extend(
            add_codex_operations(
                repo,
                codex_dir,
                agents_dir,
                plugin_ready=args.codex_plugin_ready,
            )
        )
    if "cursor" in components:
        operations.extend(add_cursor_operations(repo, cursor_projects))
    if "pi" in components:
        operations.extend(add_pi_integration_operations(repo, components, agents_dir, cursor_projects))
    if args.overlay:
        add_overlay_operations(
            operations, args.overlay.expanduser().resolve(), components, claude_dir, pi_dir, pi_root
        )

    selected = [name for name in COMPONENTS if name in components]
    print(f"Components:    {', '.join(selected)}")
    if "pi" in components:
        print(f"Pi target:     {pi_dir}")
        print(f"Pi root:       {pi_root}")
        print(f"Command target: {bin_dir / 'o90-pi'}")
    if "claude" in components:
        print(f"Claude target: {claude_dir}")
    if "codex" in components:
        print(f"Codex target:  {codex_dir}")
        print(f"Agents target: {codex_dir / 'agents'}")
        if args.codex_plugin_ready:
            print(f"Legacy skills: retire owned links under {agents_dir / 'skills'}")
        elif "pi" in components:
            print(f"Skills target: {agents_dir / 'skills'} (Pi worker bridge only)")
    for project in cursor_projects:
        print(f"Cursor project: {project}")
    print("Mode:          apply" if args.apply else "Mode:          dry-run (no writes)")
    for operation in operations:
        print(describe(operation))

    if not args.apply:
        print("No changes made. Re-run with --apply after reviewing this plan.")
        return 0

    roots: list[Path] = []
    if "pi" in components:
        roots.extend((pi_dir, pi_root, bin_dir))
    if "claude" in components:
        roots.append(claude_dir)
    if "codex" in components:
        roots.append(codex_dir)
        roots.append(agents_dir)
    roots.extend(project / ".cursor" for project in cursor_projects)
    manifest = apply(operations, state_dir, roots)
    print(f"Rollback: {Path(__file__).resolve()} --rollback {manifest}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
