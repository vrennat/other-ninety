---
name: devport
description: Run a dev server on a port of its own per checkout, check whose server holds a port, and list or report leftover servers. Use when starting a dev server, when testing against one you did not start, when a port is taken, or before reading results from a localhost URL in a repository with several worktrees.
license: MIT
---

# devport

A port says nothing about whose code it serves. `devport` derives a port from the checkout's path, so worktrees don't compete, and asks the operating system who holds a port, so it keeps no state to go stale.

Run it from inside the checkout. The script is next to this file: `~/.claude/skills/devport/devport`.

| Command | What it does |
|---|---|
| `devport` | Print this checkout's port |
| `devport run -- <command>` | Run a server on that port; it stops when `devport` exits |
| `devport whose <port>` | Show who holds a port. Exit 0: only this checkout. Exit 1: anything else. Exit 2: nothing listens |
| `devport ls` | List dev servers with port, age and checkout |
| `devport gc` | Report servers whose checkout was deleted. Stops nothing |

`run` puts the port in `{port}` in the command and in `$PORT`, and refuses a port that is already held rather than reuse it:

```bash
devport run -- bunx vite --host 127.0.0.1 --port {port} --strictPort
```

`--name <server>` gives a checkout that runs several servers a separate port for each, as in `devport --name worker` and `devport run --name worker -- ...`.

Use `127.0.0.1` in URLs and `--strictPort` where the server has it. `localhost` can reach a different server than the one you started, because `::1` and `127.0.0.1` can hold the same port without an error. Without `--strictPort`, Vite moves to the next free port without failing.

A port another session holds is theirs: don't test against it and don't stop it. `gc` only reports, because a server's age doesn't show that nobody is using it.
