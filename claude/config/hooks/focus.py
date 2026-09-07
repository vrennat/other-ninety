#!/usr/bin/env python3
"""Focus hook: warn-only break nudges, quiet hours, and away-notifications.

Registered twice in settings.json: on UserPromptSubmit and on Notification.
It never blocks. It keeps one small state file per host so every session on
the machine shares a streak:

  ~/.local/state/other-ninety/focus.json   streak start, last prompt, per-session times
  ~/.local/state/other-ninety/focus.log    one line per nudge or notification (the
                                           positive control: grep it to prove a
                                           channel fired)

UserPromptSubmit: the streak is the time since the last gap of 10 minutes or
more between prompts. At 50 minutes, and every 25 minutes after, the hook
returns a `systemMessage` (shown to the user), a desktop notification when
the host has a GUI session, and a one-line `additionalContext` asking Claude
to open its reply with a break suggestion. Between 23:00 and 06:00 local time
it adds a quiet-hours line the same way, at most once per 30 minutes. The
statusline reads the same file to show the streak.

Notification: on idle_prompt, agent_needs_input, permission_prompt, or
agent_completed, when the session's last prompt was 10 minutes or more ago,
the hook forwards the notification: an executable at ~/.config/other-ninety/notify
(given `title body` as arguments) when present, else terminal-notifier (clickable,
activates the launching app) when installed, else osascript.
Model-initiated pushes happened twice in two weeks; this path is deterministic.

Automation is exempt: O90_FOCUS=off, an Agent SDK entrypoint (sdk-*), or a
`claude -p` run without --sdk-url (Remote Control sessions keep --sdk-url and
count as interactive). Fails soft: any error prints nothing and exits 0.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

IDLE_RESET_MIN = 10
NUDGE_AT_MIN = 50
NUDGE_EVERY_MIN = 25
QUIET_START_HOUR = 23
QUIET_END_HOUR = 6
QUIET_NUDGE_EVERY_MIN = 30
AWAY_MIN = 10
NOTIFY_TYPES = {"idle_prompt", "agent_needs_input", "permission_prompt", "agent_completed"}

STATE_DIR = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state") / "other-ninety"
STATE_FILE = STATE_DIR / "focus.json"
LOG_FILE = STATE_DIR / "focus.log"
DEFAULT_BUNDLE = "com.anthropic.claudefordesktop"
CUSTOM_NOTIFY = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "other-ninety" / "notify"


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=1, sort_keys=True))
    os.replace(tmp, STATE_FILE)


def log(kind: str, text: str) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a") as fh:
            fh.write(f"{stamp} {kind} {text}\n")
    except Exception:
        pass


def run(cmd: list[str], timeout: float = 5) -> str:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""


def is_automation() -> bool:
    if os.environ.get("O90_FOCUS", "").lower() in {"off", "0", "false"}:
        return True
    if os.environ.get("CLAUDE_CODE_ENTRYPOINT", "").startswith("sdk"):
        return True
    pid = os.environ.get("CLAUDE_PID") or str(os.getppid())
    cmd = run(["ps", "-o", "command=", "-p", pid])
    args = cmd.split()
    if ("-p" in args or "--print" in args) and "--sdk-url" not in args:
        return True
    return False


def gui_session() -> bool:
    return sys.platform == "darwin" and run(["launchctl", "managername"]) == "Aqua"


def notify(title: str, body: str) -> str:
    """Deliver title/body on the best available channel; return the channel name."""
    log("notify", f"[{title}] {body}")
    if CUSTOM_NOTIFY.is_file() and os.access(CUSTOM_NOTIFY, os.X_OK):
        try:
            subprocess.run([str(CUSTOM_NOTIFY), title, body], capture_output=True, timeout=15)
            return "custom"
        except Exception:
            pass
    if gui_session():
        notifier = shutil.which("terminal-notifier")
        if notifier:
            # A click activates the app that launched this session (the desktop
            # app or the terminal); osascript notifications cannot be clicked.
            bundle = os.environ.get("__CFBundleIdentifier") or DEFAULT_BUNDLE
            run([notifier, "-title", title, "-message", body, "-activate", bundle,
                 "-group", "other-ninety-focus"], timeout=10)
            return "terminal-notifier"
        safe_body = body.replace('"', "'")
        safe_title = title.replace('"', "'")
        run(["osascript", "-e", f'display notification "{safe_body}" with title "{safe_title}"'])
        return "osascript"
    return "log"


def terminal_sequence(title: str, body: str) -> str:
    clean = lambda s: s.replace(";", ",").replace("\x07", "").replace("\x1b", "")
    return f"\x1b]777;notify;{clean(title)};{clean(body)}\x07"


def quiet_now(now: float) -> bool:
    hour = datetime.fromtimestamp(now).hour
    return hour >= QUIET_START_HOUR or hour < QUIET_END_HOUR


def on_prompt(payload: dict, state: dict, now: float) -> dict:
    sid = payload.get("session_id") or "unknown"
    # Idle is measured from the later of the last prompt and the last reply, so a
    # long agent turn does not count as the user stepping away.
    last = max(float(state.get("last_prompt") or 0), float(state.get("last_reply") or 0))
    if now - last > IDLE_RESET_MIN * 60:
        state["streak_start"] = now
        state["nudged_at"] = 0
    state["last_prompt"] = now
    sessions = state.setdefault("sessions", {})
    sessions[sid] = now
    for old, ts in list(sessions.items()):
        if now - float(ts) > 86400:
            del sessions[old]

    streak_min = int((now - float(state.get("streak_start") or now)) / 60)
    messages: list[str] = []
    context: list[str] = []
    sequence = ""

    if streak_min >= NUDGE_AT_MIN and now - float(state.get("nudged_at") or 0) >= NUDGE_EVERY_MIN * 60:
        state["nudged_at"] = now
        text = (
            f"Focus streak {streak_min} min. Background work keeps running while you step away; "
            f"a {IDLE_RESET_MIN}-minute gap resets the counter."
        )
        messages.append(text)
        log("nudge", f"streak={streak_min} session={sid}")
        notify("Break?", text)
        sequence = terminal_sequence("Break?", text)
        context.append(
            f"The user has been prompting for {streak_min} minutes without a {IDLE_RESET_MIN}-minute break. "
            "Open your reply with one plain line suggesting a break and naming what keeps running in the "
            "background. Do not change the work itself."
        )

    if quiet_now(now):
        if now - float(state.get("quiet_nudged_at") or 0) >= QUIET_NUDGE_EVERY_MIN * 60:
            state["quiet_nudged_at"] = now
            text = (
                f"Quiet hours ({QUIET_START_HOUR:02d}:00-{QUIET_END_HOUR:02d}:00). "
                "A plan written now and run in the morning costs no sleep."
            )
            messages.append(text)
            log("quiet", f"session={sid}")
        context.append(
            f"It is quiet hours ({QUIET_START_HOUR:02d}:00-{QUIET_END_HOUR:02d}:00 local). "
            "If this request could run unattended from a written brief, say so in one line at the top, "
            "then proceed as asked."
        )

    out: dict = {}
    if messages:
        out["systemMessage"] = "\n".join(messages)
    if sequence:
        out["terminalSequence"] = sequence
    if context:
        out["hookSpecificOutput"] = {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": " ".join(context),
        }
    return out


def on_stop(payload: dict, state: dict, now: float) -> dict:
    state["last_reply"] = now
    return {}


def on_notification(payload: dict, state: dict, now: float) -> dict:
    kind = payload.get("notification_type") or ""
    if kind not in NOTIFY_TYPES:
        return {}
    sid = payload.get("session_id") or "unknown"
    sessions = state.get("sessions") or {}
    last = float(sessions.get(sid) or state.get("last_prompt") or 0)
    away_min = int((now - last) / 60)
    if away_min < AWAY_MIN:
        return {}
    notified = state.setdefault("notified", {})
    if now - float(notified.get(sid) or 0) < AWAY_MIN * 60:
        return {}
    notified[sid] = now
    for old, ts in list(notified.items()):
        if now - float(ts) > 86400:
            del notified[old]
    where = os.path.basename(payload.get("cwd") or "") or "claude"
    title = payload.get("title") or "Claude Code"
    body = f"{payload.get('message') or kind} ({where}, {away_min} min since your last prompt)"
    channel = notify(title, body)
    log("away", f"type={kind} session={sid} away={away_min} channel={channel}")
    return {"terminalSequence": terminal_sequence(title, body)}


def main() -> int:
    payload = json.load(sys.stdin)
    event = payload.get("hook_event_name") or ""
    if is_automation():
        return 0
    now = time.time()
    state = load_state()
    if event == "UserPromptSubmit":
        out = on_prompt(payload, state, now)
    elif event == "Notification":
        out = on_notification(payload, state, now)
    elif event == "Stop":
        out = on_stop(payload, state, now)
    else:
        return 0
    save_state(state)
    if out:
        print(json.dumps(out))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
