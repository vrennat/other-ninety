# Dev servers

A port says nothing about whose code it serves, and a server from another worktree answers just as a correct one would. Results from the wrong server look real.

- Before trusting a localhost server you did not start, run `~/.claude/skills/devport/devport whose <port>` from your checkout. Use the server only on exit 0.
- If that script is missing, compare the listener's folder to your checkout: `lsof -a -d cwd -p "$(lsof -ti tcp:<port> -sTCP:LISTEN)" -Fn`.
- Start your own server with `~/.claude/skills/devport/devport run -- <command with {port}>`, or the repository's own per-checkout port. Don't take a fixed port or reuse a server that is already running.
- A server another session holds is theirs: don't test against it and don't stop it.
