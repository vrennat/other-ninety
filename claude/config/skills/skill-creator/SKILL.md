---
name: skill-creator
description: Guide for creating effective skills. Use this skill when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.
---

# Skill Creator

## About Skills

Skills are modular packages that extend Claude's capabilities by providing specialized knowledge, workflows, and tools. They provide:
1. **Specialized workflows** - Multi-step procedures for specific domains
2. **Tool integrations** - Instructions for working with specific file formats or APIs
3. **Domain expertise** - Company-specific knowledge, schemas, business logic
4. **Bundled resources** - Scripts, references, and assets for complex tasks

## Core Principles

### Concise is Key
The context window is a public good. Claude is already smart - only add context Claude doesn't already have.

### Set Appropriate Degrees of Freedom
- **High freedom**: Text-based instructions when multiple approaches are valid
- **Medium freedom**: Pseudocode/scripts with parameters when a preferred pattern exists
- **Low freedom**: Specific scripts when operations are fragile or consistency is critical

## Skill Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/      - Executable code
    ├── references/   - Documentation loaded as needed
    └── assets/       - Files used in output (templates, etc.)
```

### Resource Types

- **scripts/**: Deterministic code for repeated tasks (e.g., `rotate_pdf.py`)
- **references/**: Documentation Claude reads while working (schemas, API docs, policies)
- **assets/**: Files used in output but not loaded into context (templates, images, fonts)

### Progressive Disclosure

Keep SKILL.md under 500 lines. Split content into references/ when approaching this limit.

## Skill Creation Process

### Step 1: Understand with Concrete Examples
- What functionality should the skill support?
- What would a user say to trigger this skill?
- Can you give examples of how this skill would be used?

### Step 2: Plan Reusable Contents
For each example, identify what scripts, references, and assets would help.

### Step 3: Initialize the Skill
```bash
~/.claude/skills/skill-creator/scripts/init_skill.py <skill-name> --path ~/.claude/skills
```

### Step 4: Edit the Skill
- Start with reusable resources (scripts/, references/, assets/)
- Test any scripts by actually running them
- Update SKILL.md with clear instructions

**Frontmatter Guidelines:**
- `name`: Hyphen-case identifier
- `description`: What the skill does AND when to use it (this triggers the skill)

### Step 5: Package the Skill
```bash
~/.claude/skills/skill-creator/scripts/package_skill.py <path/to/skill-folder> [output-dir]
```

### Step 6: Iterate
Use the skill on real tasks, notice struggles, update accordingly.

## Writing Guidelines

- Use imperative/infinitive form
- Include "when to use" information in the description frontmatter
- Keep SKILL.md lean; use references/ for detailed information
- Avoid deeply nested references - keep one level deep
- For files >100 lines, include a table of contents

## Do NOT Include

- README.md, INSTALLATION_GUIDE.md, CHANGELOG.md, etc.
- The skill should only contain information needed for Claude to do the job
