import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

DEVPORT = Path(__file__).resolve().parent.parent / "claude" / "config" / "skills" / "devport" / "devport"
SERVER = [sys.executable, "-m", "http.server", "{port}", "--bind", "127.0.0.1"]


def devport(*args: str, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run([str(DEVPORT), *args], cwd=cwd, capture_output=True, text=True, timeout=30)


def make_repo(path: Path) -> Path:
    path.mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    return path.resolve()


def wait_for_port(port: int, seconds: float = 15) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        with socket.socket() as client:
            if client.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.1)
    raise AssertionError(f"nothing listened on {port}")


def wait_for_exit(port: int, seconds: float = 10) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        with socket.socket() as client:
            if client.connect_ex(("127.0.0.1", port)) != 0:
                return
        time.sleep(0.1)
    raise AssertionError(f"{port} is still listening")


class PortDerivationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()

    def test_port_is_stable_in_range_and_differs_by_checkout_and_name(self) -> None:
        first = make_repo(self.root / "first")
        second = make_repo(self.root / "second")
        port = int(devport(cwd=first).stdout)
        self.assertEqual(port, int(devport(cwd=first).stdout))
        self.assertTrue(21000 <= port < 29000)
        self.assertNotEqual(port, int(devport(cwd=second).stdout))
        self.assertNotEqual(port, int(devport("--name", "worker", cwd=first).stdout))

    def test_subfolder_shares_the_checkout_port(self) -> None:
        repo = make_repo(self.root / "repo")
        (repo / "sub").mkdir()
        self.assertEqual(devport(cwd=repo).stdout, devport(cwd=repo / "sub").stdout)

    def test_matches_the_published_hash(self) -> None:
        # Repository helpers copy this hash, so this value must not change on its own.
        code = (
            "import importlib.machinery as m, importlib.util as u;"
            f"l=m.SourceFileLoader('devport',{str(DEVPORT)!r});"
            "s=u.spec_from_loader('devport',l);d=u.module_from_spec(s);l.exec_module(d);"
            "print(d.port_for('/Users/example/project','dev'))"
        )
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        self.assertEqual(result.stdout.strip(), "27194", result.stderr)


class ServerTests(unittest.TestCase):
    def setUp(self) -> None:
        if not shutil.which("lsof"):
            self.skipTest("needs lsof")
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.repo = make_repo(self.root / "repo")
        self.other = make_repo(self.root / "other")
        self.port = int(devport(cwd=self.repo).stdout)
        self.children: list[subprocess.Popen] = []
        self.addCleanup(self.stop_children)

    def stop_children(self) -> None:
        for child in self.children:
            if child.poll() is None:
                child.terminate()
                child.wait(10)

    def start(self, cwd: Path) -> subprocess.Popen:
        child = subprocess.Popen(
            [str(DEVPORT), "run", "--", *SERVER],
            cwd=cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.children.append(child)
        wait_for_port(int(devport(cwd=cwd).stdout))
        return child

    def test_whose_tells_this_checkout_from_another(self) -> None:
        self.assertEqual(devport("whose", str(self.port), cwd=self.repo).returncode, 2)
        self.start(self.repo)
        self.assertEqual(devport("whose", str(self.port), cwd=self.repo).returncode, 0)
        other = devport("whose", str(self.port), cwd=self.other)
        self.assertEqual(other.returncode, 1)
        self.assertIn(str(self.repo), other.stdout)

    def test_whose_tells_a_worktree_nested_inside_a_checkout_from_its_parent(self) -> None:
        subprocess.run(
            ["git", "-C", str(self.repo), "-c", "user.name=t", "-c", "user.email=t",
             "commit", "-q", "--allow-empty", "-m", "init"],
            check=True,
        )
        nested = self.repo / ".claude" / "worktrees" / "nested"
        subprocess.run(["git", "-C", str(self.repo), "worktree", "add", "-q", str(nested)], check=True)
        nested = nested.resolve()
        self.start(nested)
        port = int(devport(cwd=nested).stdout)
        self.assertEqual(devport("whose", str(port), cwd=nested).returncode, 0)
        self.assertEqual(devport("whose", str(port), cwd=self.repo).returncode, 1)

    def test_run_refuses_a_held_port_instead_of_reusing_it(self) -> None:
        self.start(self.repo)
        second = devport("run", "--", *SERVER, cwd=self.repo)
        self.assertEqual(second.returncode, 3)
        self.assertIn("refusing to reuse", second.stderr)

    def test_run_exports_the_port_and_returns_the_exit_code(self) -> None:
        result = devport(
            "run", "--", sys.executable, "-c",
            "import os,sys; print(os.environ['PORT'], '{port}'); sys.exit(7)",
            cwd=self.repo,
        )
        self.assertEqual(result.returncode, 7)
        self.assertEqual(result.stdout.split(), [str(self.port), str(self.port)])

    def test_stopping_run_stops_the_whole_server_group(self) -> None:
        # The shell stays in front of the server, as package-manager scripts do.
        child = subprocess.Popen(
            [str(DEVPORT), "run", "--", "sh", "-c",
             f"{sys.executable} -m http.server {{port}} --bind 127.0.0.1; true"],
            cwd=self.repo,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.children.append(child)
        wait_for_port(self.port)
        child.send_signal(signal.SIGTERM)
        self.assertEqual(child.wait(15), 128 + signal.SIGTERM)
        wait_for_exit(self.port)

    def test_stopping_run_kills_a_server_that_ignores_sigterm(self) -> None:
        ignores_term = (
            "import os,signal,socket,time;"
            "signal.signal(signal.SIGTERM,signal.SIG_IGN);"
            "s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);"
            "s.bind(('127.0.0.1',int(os.environ['PORT'])));s.listen();time.sleep(120)"
        )
        child = subprocess.Popen(
            [str(DEVPORT), "run", "--", sys.executable, "-c", ignores_term],
            cwd=self.repo,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.children.append(child)
        wait_for_port(self.port)
        child.send_signal(signal.SIGTERM)
        self.assertEqual(child.wait(15), 128 + signal.SIGTERM)
        wait_for_exit(self.port)

    def test_ls_lists_the_server_and_gc_reports_a_deleted_checkout_without_stopping_it(self) -> None:
        doomed = make_repo(self.root / "doomed")
        port = int(devport(cwd=doomed).stdout)
        self.start(doomed)
        self.assertIn(str(port), devport("ls", cwd=self.other).stdout)

        moved = self.root / ".ccd-trash~doomed"
        doomed.rename(moved)
        report = devport("gc", cwd=self.other)
        self.assertIn(str(port), report.stdout)
        self.assertIn("Report only", report.stdout)
        with socket.socket() as client:
            self.assertEqual(client.connect_ex(("127.0.0.1", port)), 0)


if __name__ == "__main__":
    unittest.main()
