---
name: wizard
description: "Generate an interactive bash wizard that walks a human through steps only they can do: provisioning, credentials and CI secrets, an unfamiliar third-party dashboard, a one-off migration or cutover. Steps the agent can run itself stay with the agent."
disable-model-invocation: true
license: MIT
metadata:
  source: https://github.com/mattpocock/skills (wizard, template.sh vendored verbatim)
---

# wizard

A wizard is a bash script that walks a human through a manual procedure that is tedious to do by hand and tedious to re-explain to an agent every time. It opens each URL, says what to click and copy, captures the values, writes them where they belong (`.env`, GitHub secrets), confirms at every stage, and shows how many stages are left.

The UX is already solved by `template.sh`: stage-by-stage progress, confirmation gates, cross-platform URL opening, hidden secret entry, idempotent `.env` upserts, `gh secret` and `gh variable` writes, and a closing summary. The job here is scoping the procedure and authoring its stages. The library above the `STAGES` marker is identical in every wizard; leave it untouched.

A wizard is ephemeral by default: built for one run, saved under the session scratchpad or `scripts/`, deleted when the job is done. Commit it only when the user wants a repeatable setup path in the repo.

## Procedure

1. **Scope the procedure.** Read the repo before asking: `.env*`, README, compose files, framework config, and `.github/workflows/*` (every `secrets.*` and `vars.*` reference is a value the wizard must produce). For a migration, read the current state, the target state, and the irreversible actions between them. Show the user the ordered stages and the values each produces; they may add, drop, or reorder. Done when every captured value has a source, a destination (`.env`, a GitHub secret, both, or none), and a secrecy flag.

2. **Map each stage.** Write the exact path a stranger could follow: URL, clicks, where the value appears, which variable it fills. Where the current UI or command is unknown, say so and check the docs or ask; every step in the script is one that exists.

3. **Author it.** Copy `template.sh` to the target path. Replace the example stage with one `stage` per step in dependency order, using `stage`, `say`/`step`, `open_url`, `ask`/`ask_secret`, `write_env`, `set_secret`/`set_var`, `pause`/`confirm`. Set `TOTAL_STAGES`. Open the URL before asking for its value, `ask_secret` for anything secret, `write_env` every persisted value, `set_secret` only what CI reads, and `confirm` before any irreversible action. One focused task per stage, since each stage clears the screen.

4. **Verify and hand off.** `bash -n <script>`, `shellcheck` if present, `chmod +x`. The script opens browsers and blocks on a human, so trace it statically: every value from step 1 is captured and lands where step 1 said, and every `set_secret` name matches a `secrets.*` reference in CI. Tell the user how to run it; a repeatable one gets committed and linked from the README.
