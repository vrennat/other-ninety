import json
import os
from datetime import datetime, timezone
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parent.parent
HOOKS = ROOT / "claude" / "config" / "hooks"


class HookTests(unittest.TestCase):
    def run_hook(self, name, payload, config, *, cwd=None, extra_env=None):
        env = {**os.environ, "CLAUDE_CONFIG_DIR": str(config), **(extra_env or {})}
        return subprocess.run(
            [str(HOOKS / name)], input=json.dumps(payload), text=True,
            capture_output=True, env=env, cwd=cwd,
        )

    def write_session(self, config, pid, session_id, cwd):
        sessions = config / "sessions"
        sessions.mkdir(exist_ok=True)
        (sessions / f"{session_id}.json").write_text(json.dumps(
            {"pid": pid, "sessionId": session_id, "cwd": str(cwd), "name": f"name-{session_id}",
             "procStart": "Tue Sep  1 18:00:00 2026"}
        ))

    def test_session_start_lists_live_sessions_in_same_repo_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "config"
            config.mkdir()
            repo = root / "repo"
            repo.mkdir()
            subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True)
            subprocess.run(["git", "-c", "user.email=tester", "-c", "user.name=t",
                            "commit", "-q", "--allow-empty", "-m", "init"], cwd=repo, check=True)
            worktree = root / "wt"
            subprocess.run(["git", "worktree", "add", "-q", str(worktree), "-b", "feature"], cwd=repo, check=True)
            elsewhere = root / "elsewhere"
            elsewhere.mkdir()
            dead = subprocess.Popen(["true"])
            dead.wait()
            live = os.getpid()
            self.write_session(config, live, "current", repo)
            self.write_session(config, live, "same-repo-worktree", worktree)
            self.write_session(config, live, "other-repo", elsewhere)
            self.write_session(config, dead.pid, "dead-same-repo", repo)
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": "SessionStart", "session_id": "current", "cwd": str(repo)},
                config,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"| name-same-repo-worktree | pid {live} | {worktree}", result.stdout)
            self.assertNotIn("name-current", result.stdout)
            self.assertNotIn("name-other-repo", result.stdout)
            self.assertNotIn("name-dead-same-repo", result.stdout)
            self.assertEqual(result.stdout.count(f"| pid {live} |"), 1, result.stdout)
            self.assertNotIn(f"| pid {dead.pid} |", result.stdout)

    def test_session_start_outside_a_repository_warns_and_lists_no_sessions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "config"
            config.mkdir()
            plain = root / "plain"
            plain.mkdir()
            self.write_session(config, os.getpid(), "current", plain)
            self.write_session(config, os.getpid(), "same-directory", plain)
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": "SessionStart", "session_id": "current", "cwd": str(plain)},
                config,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"started in {plain}, which is not a git repository", result.stdout)
            self.assertIn(f"{config}/projects/", result.stdout)
            self.assertNotIn("name-same-directory", result.stdout)
            self.assertEqual(result.stdout.count("\n"), 1, result.stdout)

    def test_session_start_without_registry_only_warns(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": "SessionStart", "session_id": "current", "cwd": directory},
                Path(directory),
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("not a git repository", result.stdout)
            self.assertNotIn("| pid ", result.stdout)

    def test_null_session_id_is_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            result = self.run_hook(
                "session-intent.py",
                {"hook_event_name": None, "session_id": None, "cwd": None},
                config,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")

    def test_shell_env_appends_zsh_options_and_path_to_the_env_file(self):
        # Positive control 2026-10-10: without this hook the Bash tool's zsh
        # rejects `echo === ok ===` (EQUALS) and aborts on an unmatched glob
        # (NOMATCH); /usr/sbin tools are missing from one snapshot type.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env_file = root / "env.sh"
            env_file.write_text("export EXISTING=1\n")
            result = self.run_hook("shell-env.sh", {"hook_event_name": "SessionStart"}, root,
                                   extra_env={"CLAUDE_ENV_FILE": str(env_file)})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "")
            text = env_file.read_text()
            self.assertTrue(text.startswith("export EXISTING=1\n"), "must append, not overwrite")
            self.assertIn("setopt NO_NOMATCH NO_EQUALS", text)
            self.assertIn("/usr/sbin:/sbin", text)
            zsh = subprocess.run(["zsh", "-fc", f"source {env_file}; echo === ok ===; ls nothere* 2>&1; command -v lsof"],
                                 text=True, capture_output=True)
            self.assertIn("=== ok ===", zsh.stdout)
            self.assertNotIn("no matches found", zsh.stdout + zsh.stderr)
            self.assertIn("lsof", zsh.stdout)

    def test_shell_env_is_silent_without_an_env_file(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {k: v for k, v in os.environ.items() if k != "CLAUDE_ENV_FILE"}
            result = subprocess.run([str(HOOKS / "shell-env.sh")], input="{}", text=True,
                                    capture_output=True, env=env, cwd=directory)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_force_push_main_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            for command in (
                "git push --force origin main",
                "git push --force-with-lease origin main",
                "git push --force-with-lease=main:expected origin main",
                "git push origin +main",
                "git push origin +HEAD:refs/heads/main",
                "git push -f origin HEAD:refs/heads/main",
                "git -C /some/repo push --force origin main",
                "cd /some/worktree && git push -f origin HEAD:main",
                "git push origin 'HEAD:main' --force",
                "git push origin feature && git push --force origin main",
            ):
                with self.subTest(command=command):
                    result = self.run_hook(
                        "pre-push-guard.sh",
                        {"tool_name": "Bash", "tool_input": {"command": command}},
                        Path(directory),
                    )
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertIn("forced push to main", result.stderr)

    def test_force_push_without_a_refspec_blocks_and_names_the_fix(self):
        with tempfile.TemporaryDirectory() as directory:
            for command in (
                "git push -f",
                "git push --force",
                "git push --force-with-lease origin",
                "git push --force-with-lease=feature:abc",
                "cd /some/worktree && git push --force-with-lease",
            ):
                with self.subTest(command=command):
                    result = self.run_hook(
                        "pre-push-guard.sh",
                        {"tool_name": "Bash", "tool_input": {"command": command}},
                        Path(directory),
                    )
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertIn("git push --force-with-lease origin <branch>", result.stderr)

    def test_force_push_to_another_branch_allows_from_any_directory(self):
        # 2026-10-09 audit: five force-with-lease pushes to claude/* branches were
        # blocked because the guard read the branch from the main checkout's cwd.
        with tempfile.TemporaryDirectory() as directory:
            for command in (
                "git push --force-with-lease origin feature",
                "cd /some/worktree && git push --force-with-lease origin claude/x",
                "W=/some/worktree; cd $W && git push -f origin feature",
                "git -C /some/worktree push --force origin HEAD:refs/heads/feature",
                "git push --force-with-lease=main:abc origin feature",
                "git push origin +feature",
                "git push -u --force-with-lease origin feature",
            ):
                with self.subTest(command=command):
                    result = self.run_hook(
                        "pre-push-guard.sh",
                        {"tool_name": "Bash", "tool_input": {"command": command}},
                        Path(directory),
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_deleting_main_blocks_but_other_deletes_allow(self):
        with tempfile.TemporaryDirectory() as directory:
            for command, code in (
                ("git push origin --delete main", 2),
                ("git push origin -d main", 2),
                ("git push origin :main", 2),
                ("git push origin :refs/heads/main", 2),
                ("git push origin --delete feature", 0),
                ("git push origin :feature", 0),
                ("git push origin --delete claude/old-branch", 0),
            ):
                with self.subTest(command=command):
                    result = self.run_hook(
                        "pre-push-guard.sh",
                        {"tool_name": "Bash", "tool_input": {"command": command}},
                        Path(directory),
                    )
                    self.assertEqual(result.returncode, code, result.stderr)
                    if code == 2:
                        self.assertIn("deleting main", result.stderr)

    def test_plain_pushes_allow_without_running_git(self):
        # Non-fast-forward pushes are git's job to reject; the guard must not
        # fetch or inspect a repository (2026-10-10, H2). A git that always fails
        # proves the hook never calls it.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); config = root / "config"; config.mkdir()
            fake_bin = root / "bin"; fake_bin.mkdir()
            git = fake_bin / "git"
            git.write_text("#!/bin/sh\necho 'guard ran git' >&2\nexit 99\n")
            git.chmod(0o755)
            for command in (
                "git push origin main",
                "git push -u origin feature",
                "git -C /some/repo push origin main",
                "cd /some/repo && git push",
                "git push origin main && echo done",
                "git push --set-upstream origin integration/batch-2026-10-02",
            ):
                with self.subTest(command=command):
                    result = self.run_hook(
                        "pre-push-guard.sh",
                        {"tool_name": "Bash", "tool_input": {"command": command, "cwd": None}},
                        config, cwd=root,
                        extra_env={"PATH": f"{fake_bin}:{os.environ['PATH']}"},
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertNotIn("guard ran git", result.stderr)

    def test_non_bash_payload_allows(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_hook("pre-push-guard.sh", {"tool_name": "Read"}, Path(directory))
            self.assertEqual(result.returncode, 0)

    def push_guard(self, directory, command):
        return self.run_hook(
            "pre-push-guard.sh",
            {"tool_name": "Bash", "tool_input": {"command": command}},
            Path(directory),
        )

    def test_ssh_wrapped_force_push_to_main_blocks(self):
        # An ssh'd push reaches the same remote; only the clone differs, and
        # the hook no longer reads any clone.
        with tempfile.TemporaryDirectory() as directory:
            for command in (
                "ssh tundra 'git -C ~/Developer/x push --force origin main'",
                'ssh badlands "cd r && git push -f origin main"',
            ):
                with self.subTest(command=command):
                    self.assertEqual(self.push_guard(directory, command).returncode, 2)
            result = self.push_guard(directory, 'ssh tundra "git push -f origin feature"')
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_force_push_to_main_blocks_in_every_shell_shape(self):
        with tempfile.TemporaryDirectory() as directory:
            for command in (
                "# ship it\ngit push --force-with-lease origin main",
                "cd /x\ngit push --force origin main",
                "git push origin main \\\n  --force",
                "git push -f origin main;",
                "(cd /x && git push -f origin main)",
                "git push -f origin main&&echo ok",
                "git push -f origin main&",
                "git -c core.sshCommand=ssh push -f origin main",
                "git --no-pager push -f origin main",
                "/usr/bin/git push -f origin main",
                "\\git push -f origin main",
                'bash -c "git push -f origin main"',
                "echo $(git push -f origin main)",
                "git push -uf origin main",
                "git push -fu origin main",
                "git push -f origin HEAD:master",
                "git push -o ci.skip -f origin main",
            ):
                with self.subTest(command=command):
                    result = self.push_guard(directory, command)
                    self.assertEqual(result.returncode, 2, result.stderr)

    def test_force_push_with_an_unwritten_destination_blocks(self):
        # The hook never asks git which branch is checked out, so HEAD, @, a
        # variable, a stray 2>&1, or --mirror cannot be cleared.
        with tempfile.TemporaryDirectory() as directory:
            for command in (
                "git push --force origin HEAD",
                "git push -f origin @",
                'git push -f origin "$branch"',
                "git push --force-with-lease origin 2>&1 | tail -5",
                "git push --mirror origin",
                "git push origin :master",
            ):
                with self.subTest(command=command):
                    self.assertEqual(self.push_guard(directory, command).returncode, 2)
            for command in (
                "git push --force-with-lease origin HEAD:refs/heads/feature 2>&1 | tail -5",
                "git push -u origin HEAD",
                "git push origin feature > /tmp/push.log 2>&1",
            ):
                with self.subTest(command=command):
                    result = self.push_guard(directory, command)
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_webfetch_guard_blocks_reddit_and_archive_only(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            for url, code in (("https://www.reddit.com/r/x/", 2), ("https://old.reddit.com/r/x", 2),
                              ("https://web.archive.org/web/2024/https://a.b", 2), ("https://example.com/reddit.com", 0)):
                result = self.run_hook("webfetch-guard.sh", {"tool_name": "WebFetch", "tool_input": {"url": url}}, config)
                self.assertEqual(result.returncode, code, (url, result.stderr))
            result = self.run_hook("webfetch-guard.sh", {"tool_name": "Bash", "tool_input": {"command": "curl reddit.com"}}, config)
            self.assertEqual(result.returncode, 0)

    def test_pii_egress_guard_asks_before_sending_the_owner_address(self):
        owner = "owner" + "@" + "example.test"
        noreply = "1+o" + "@" + "users.noreply.github.com"
        env = {"PII_EGRESS_EMAILS": owner}
        cases = (
            ("Bash", {"command": f'curl -H "User-Agent: X/1 ({owner})" https://en.wikipedia.org'}, True),
            ("Bash", {"command": f"grep -r {owner} ~/.claude/projects"}, False),
            ("WebFetch", {"url": f"https://a.test/?contact={owner}"}, True),
            ("Edit", {"new_string": f"const UA = 'T/0.1 ({owner})'"}, True),
            ("Write", {"content": f"UA = 'T/0.1 ({noreply})'"}, True),
            ("Write", {"content": f"author: {owner}"}, False),
            ("Bash", {"command": "curl https://en.wikipedia.org"}, False),
            ("WebFetch", {"url": "https://a.test/?c=owner%40example.test"}, True),
            ("Write", {"content": f'"User-Agent":\n  "bot ({owner})"'}, True),
            ("Write", {"content": f"local Lua = '{owner}'"}, False),
            ("Bash", {"command": ["not", "a", "string"], "x": owner}, False),
            ("Edit", {"edits": [owner]}, False),
        )
        with tempfile.TemporaryDirectory() as directory:
            for tool, tool_input, asks in cases:
                result = self.run_hook("pii-egress-guard.py", {"tool_name": tool, "tool_input": tool_input},
                                       Path(directory), extra_env=env)
                self.assertEqual(result.returncode, 0, result.stderr)
                decision = json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"] if result.stdout else None
                self.assertEqual(decision, "ask" if asks else None, (tool, tool_input))
            result = subprocess.run([str(HOOKS / "pii-egress-guard.py")], input="not json @", text=True,
                                    capture_output=True)
            self.assertEqual(result.returncode, 0)

    def write_transcript(self, path, records):
        path.write_text("".join(json.dumps(record) + "\n" for record in records))

    def tool_search_result(self, *names):
        return {"type": "user", "message": {"role": "user", "content": [{
            "type": "tool_result", "tool_use_id": "t",
            "content": [{"type": "tool_reference", "tool_name": name} for name in names],
        }]}}

    def compact_boundary(self, *names):
        return {"type": "system", "subtype": "compact_boundary",
                "compactMetadata": {"trigger": "auto", "preCompactDiscoveredTools": list(names)}}

    def test_compact_tools_names_the_latest_boundary_set_plus_later_loads(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            transcript = root / "session.jsonl"
            self.write_transcript(transcript, [
                self.tool_search_result("Dropped"),
                self.compact_boundary("Monitor", "TaskStop"),
                {"type": "user", "message": {"role": "user", "content": "keep going"}},
                self.tool_search_result("mcp__claude_ai_Linear__get_issue"),
            ])
            result = self.run_hook(
                "compact-tools.py",
                {"hook_event_name": "SessionStart", "source": "compact", "transcript_path": str(transcript)},
                root,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("without ToolSearch: Monitor, TaskStop, mcp__claude_ai_Linear__get_issue.", result.stdout)
            self.assertNotIn("Dropped", result.stdout)
            self.assertIn("InputValidationError", result.stdout)

    def test_compact_tools_is_silent_without_loaded_tools_or_outside_compaction(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            empty = root / "empty.jsonl"
            self.write_transcript(empty, [self.compact_boundary()])
            loaded = root / "loaded.jsonl"
            self.write_transcript(loaded, [self.tool_search_result("Monitor")])
            for payload in (
                {"source": "compact", "transcript_path": str(empty)},
                {"source": "startup", "transcript_path": str(loaded)},
                {"source": "compact", "transcript_path": str(root / "missing.jsonl")},
                {"source": "compact"},
            ):
                with self.subTest(payload=payload):
                    result = self.run_hook("compact-tools.py", {"hook_event_name": "SessionStart", **payload}, root)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
