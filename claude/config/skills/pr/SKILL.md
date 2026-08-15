---
name: pr
description: Create a pull request with standard format, test verification, and ticket linking. Use when ready to submit changes for review.
---

# Create Pull Request

Streamline PR creation with consistent formatting.

## What It Does

1. Verifies branch is ready (changes committed, pushed)
2. Generates summary from commits
3. Links ticket if found in branch name
4. Creates PR with standard format
5. Returns PR URL

## Prerequisites

- Changes committed to a feature branch (not main)
- Branch pushed to remote
- `gh` CLI authenticated

## PR Format

```markdown
## Summary
- <bullet points summarizing changes>

## Test plan
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Manual testing completed

Closes #XXX (if ticket found)

---
Generated with [Claude Code](https://claude.com/claude-code)
```

## Usage

When the user invokes this skill:

1. **Check current state:**
   ```bash
   git status
   git branch --show-current
   git log main..HEAD --oneline
   ```

2. **Verify tests pass:**
   - Run `/typecheck`
   - Run relevant tests

3. **Extract ticket** from branch name:
   - Pattern: `XXX-123` or similar
   - Example branch: `feature/123-add-auth`

4. **Generate summary** from commit messages:
   - Group related commits
   - Focus on user-facing changes
   - Mention files/areas affected

5. **Create PR:**
   ```bash
   gh pr create \
     --title "feat: <description>" \
     --body "<formatted body>"
   ```

6. **Return PR URL** to user

## Example Prompts

- "Create a PR for my changes"
- "Open a pull request"
- "Submit this for review"
- "/pr"

## Branch Naming

For automatic ticket detection, use:
- `feature/123-description`
- `fix/456-bug-name`
- `issue-789/feature-name`

## Commit Message Prefixes

PRs should have titles matching commit conventions:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `chore:` - Maintenance
- `test:` - Test changes

## Tips

- Ensure all changes are committed before running
- Push branch to remote first if not already pushed
- Include specific test steps in the test plan
- Link related issues or PRs in the summary
- Keep PR scope focused - split large changes
