---
name: ticket
description: Create tickets for bugs, features, and tasks. Use when reporting bugs, requesting features, creating implementation tasks, or documenting work items.
---

# Create Tickets

Create and manage tickets for project work.

## Prerequisites

- Linear MCP server connected and authenticated (run `/mcp` to auth)
- Or: GitHub Issues configured

## Ticket Types

### Bug Report
For issues that need fixing:
- Clear title describing the problem
- Steps to reproduce
- Expected vs actual behavior
- Severity/priority

### Feature Request
For new functionality:
- User story format (As a... I want... So that...)
- Acceptance criteria
- Priority and scope

### Task
For implementation work:
- Clear deliverable
- Technical approach (optional)
- Dependencies

## Instructions

1. **Identify ticket type** (bug, feature, task)
2. **Write clear title** - concise but descriptive
3. **Add description** with relevant details
4. **Set priority** (Urgent, High, Medium, Low, No Priority)
5. **Add labels** if applicable

## Priority Guidelines

| Priority | Use When |
|----------|----------|
| Urgent | Blocking production, critical bug |
| High | Important feature, significant bug |
| Medium | Standard work items |
| Low | Nice-to-have, minor improvements |

## Example Prompts

- "Create a bug ticket for users getting logged out"
- "Make a feature ticket for adding dark mode"
- "Create a task to implement search functionality"
- "File a bug: form validation not working"

## Template: Bug Report

```
**Steps to Reproduce:**
1.
2.
3.

**Expected:**

**Actual:**

**Environment:** Browser, viewport size, etc.
```

## Template: Feature Request

```
**User Story:**
As a [user type], I want [feature] so that [benefit].

**Acceptance Criteria:**
- [ ]
- [ ]
- [ ]
```
