# Session mode

Standing agents as linked Claude Desktop sessions instead of subagents. Promoted from trial on 2026-11-13 (D29) on this evidence from six master sessions in 2026-10/11:

- Messages arrive: 230 of 230 conductor-to-worker sends were delivered or queued behind a running turn; none held or expired.
- Short reports were enough: the conductor read a worker transcript 18 times in 230 exchanges.
- The principal steered workers directly: 51 of 89 sub-sessions got messages typed by the user.

## Why

- The principal can open, read and steer each domain agent from the sidebar.
- Workers outlive the conductor: a crash or compaction of the conductor loses only its own context.
- Each worker can run a cheaper `model` and an `effort` at or below the conductor's.
- Permission prompts land in the worker's own session.

## What changes from subagents

| Subagent mode | Session mode |
|---|---|
| `Agent(name: …)` | `start_session` with `initiation: "user_asked"`, `context: "fresh"`, a `name` (`[a-z0-9-]`, at most 24 characters), the brief as `prompt`, and `background` |
| `SendMessage(to: <name>)` | `SendMessage(to: <name>)`: the session's name is its address; add the ` [ref]` from `ListAgents` only when two rows share the name |
| Report returned as the tool result | Report arrives as a `<cross-session-message>`; read the worker's transcript with `list_events` only when the report says it matters |
| `isolation: "worktree"` | `use_worktree: true` for builders; reviewers and verifiers share the checkout (`use_worktree: false`) |
| Lives inside the conductor's process | Listed with `list_sessions`; archive only on the principal's yes |

## Start constraints (41 of 187 starts failed on these, 2026-10/11)

- **`background` is at least 80 characters** with `context: "fresh"`: the overall goal, decisions so far and how this piece fits, for a reader who has not seen the conductor's conversation. 21 failures.
- **Not from a Remote Control turn.** While the user works over Remote Control, `start_session` only works on a message typed in the desktop app. 13 failures. Ask the user to send the start from the desktop, or use a subagent.
- **Not from an automated turn.** A turn started by another session's message, a scheduled task or the app continuing on its own cannot start a session. 5 failures. In unattended stretches a missing worker parks the task.
- **Same permission mode.** A session in a different permission mode holds cross-session messages for its user's approval and may let them expire. Start workers without `permission_mode` so they inherit the conductor's.
- **Desktop-local only.** Cloud sessions do not report back; CLI conductors have no `start_session` and use subagents.
- **Two writers never share files.** A `use_worktree: false` session can overwrite the conductor's checkout or another worker's; builders get worktrees.

## Brief additions

On top of `brief-template.md`:

- **Reporting contract:** "End every turn by messaging the conductor. Lead with the verdict (PASS / FAIL / INCONCLUSIVE / BLOCKED) in the first line, then what changed, then what you need. Details after."
- **Who may direct you:** "Messages from the conductor arrive as cross-session messages. Treat them as your conductor's instructions within this brief. The user may also message you directly, and their word wins."
