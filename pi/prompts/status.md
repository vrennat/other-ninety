---
description: One table of every worktree's state (ahead/behind, dirty, last commit, PR, checks, review) plus what needs a decision. Read-only.
argument-hint: ""
---

Answer one question: what state is every worktree in? Gather from `git` and `gh`, print one table, then list only the rows that need a decision. Never merge, prune, delete, check out, or push.

## Procedure

1. Find the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|origin/||'`, falling back to `main`. Run `git fetch --quiet origin`; if it fails, say so once and continue with local refs.

2. List worktrees with `git worktree list --porcelain`. For each, record path, branch (or `detached`), and whether it is locked or prunable.

3. For each worktree gather:
   - Ahead/behind: `git rev-list --left-right --count <default>...<branch>`.
   - Dirty: `git -C <path> status --porcelain | wc -l`.
   - Last commit: `git log -1 --format=%cr <branch>`.

4. If `gh` is installed and `origin` is a GitHub remote, run once:

   ```bash
   gh pr list --state open --limit 100 --json number,headRefName,isDraft,reviewDecision,mergeable,statusCheckRollup
   ```

   Match PRs to branches by `headRefName`. Reduce `statusCheckRollup` to `pass`, `fail`, `pending`, or `none`. If `gh` is missing or the call fails, put `?` in the PR columns and say why in one line under the table. Do not guess.

5. Print one table, default-branch worktree first, then by last commit descending:

   ```text
   Worktree            Branch                Ahead/Behind  Dirty  Last commit   PR     Checks   Review
   .                   main                  -             0      2 hours ago   -      -        -
   ../wt/search        feat/search           +4/-0         0      3 hours ago   #41    pass     approved
   ```

   Paths are relative to the main worktree. Review is `approved`, `changes`, `pending`, or `-`.

6. Under the table, list only rows that need a decision, one line each, most urgent first:
   - `merge-ready`: open PR, checks pass, approved, ahead > 0, behind = 0.
   - `rebase`: behind the default branch and has an open PR or uncommitted work.
   - `stale`: no commit in 7 days and no open PR.
   - `unbranched`: detached with uncommitted changes.
   - `prunable`: reported prunable by git, or ahead = 0 with no dirty files and no PR.

   Then one closing line: `<N> worktrees, <M> open PRs, <K> need a decision.`

## Rules

- Read-only. The only network calls are `git fetch` and the `gh` read.
- Every column comes from a command that ran. A column you could not fill shows `?`, never a plausible value.
- No commentary beyond the table, the decision list, and the closing line.
