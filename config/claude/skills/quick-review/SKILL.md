---
name: quick-review
description: Review PR feedback from automated reviewers (Gemini, etc.), perform own code review, fix issues by severity, and surface nits to user. Use when a PR has review comments to address.
---

# Quick Review

Triage and fix PR review feedback efficiently. Combines automated reviewer feedback with your own assessment.

## Workflow

### 1. Gather feedback

```bash
# Find PR for current branch
gh pr list --head $(git branch --show-current)

# Get review comments (top-level)
gh pr view <NUMBER> --json comments,reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'

# Get inline review comments (the important ones)
gh api repos/{owner}/{repo}/pulls/<NUMBER>/comments --jq '.[] | {path: .path, line: .line, body: .body, author: .user.login}'
```

### 2. Read all affected files

Read every file that has review comments before making any changes. Also read surrounding files to understand context.

### 3. Classify and prioritize

Assign each comment a severity:

| Severity | Action | Examples |
|----------|--------|---------|
| **Critical** | Fix immediately | Security holes, data loss, crashes |
| **High** | Fix immediately | Type mismatches, broken logic, schema inconsistencies |
| **Medium** | Fix immediately | Memory inefficiency, non-atomic operations, hardcoded env values, missing error handling |
| **Low** | Fix immediately | Dead code, naming issues, unnecessary queries |
| **Nit** | Ask user | Style preferences, env var vs code tradeoffs, naming opinions |

### 4. Do your own review

Don't just fix what the automated reviewer found. Read the full diff and look for:

- Issues the automated reviewer missed
- `console.log` in production code
- Missing validation at system boundaries
- Hardcoded values that should be configurable
- Non-atomic operations on shared state
- Inefficient patterns (N+1 queries, buffering large files, fetching all rows when an aggregate suffices)

### 5. Fix all non-nit issues

Apply fixes across all affected files. Then run typecheck to verify.

### 6. Report to user

Present a table of what you fixed, then list remaining nits/style choices as questions for the user to decide. Keep it concise.

## Key principles

- Fix everything medium and above without asking
- Group nits together and ask once at the end
- Always run typecheck after changes
- Don't blindly follow every automated suggestion -- use judgment (e.g., a hardcoded admin email list for a two-person team is fine)
- When a suggestion improves correctness (schema mismatch, atomicity), always apply it
- When a suggestion is purely stylistic or the tradeoff is debatable, surface it as a nit
