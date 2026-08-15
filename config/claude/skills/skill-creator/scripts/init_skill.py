#!/usr/bin/env python3
"""
Skill Initializer - Creates a new skill from template

Usage:
    init_skill.py <skill-name> --path <path>

Examples:
    init_skill.py my-new-skill --path ~/.claude/skills
    init_skill.py my-api-helper --path ~/projects/skills
"""

import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {skill_name}
description: [TODO: Complete explanation of what the skill does and when to use it. Include specific scenarios, file types, or tasks that trigger it.]
---

# {skill_title}

## Overview

[TODO: 1-2 sentences explaining what this skill enables]

## [TODO: Main Section]

[TODO: Add content. Common structures:

**Workflow-Based** (sequential processes):
## Workflow Decision Tree -> ## Step 1 -> ## Step 2...

**Task-Based** (tool collections):
## Quick Start -> ## Task Category 1 -> ## Task Category 2...

**Reference/Guidelines** (standards):
## Guidelines -> ## Specifications -> ## Usage...

**Capabilities-Based** (integrated systems):
## Core Capabilities -> ### 1. Feature -> ### 2. Feature...

Delete this guidance section when done.]

## Resources

### scripts/
Executable code for specific operations. Scripts may be executed without loading into context.

### references/
Documentation loaded into context as needed (API docs, schemas, guides).

### assets/
Files used in output but not loaded into context (templates, images, fonts).

**Delete any unneeded directories.**
"""

EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
Example helper script for {skill_name}
Replace with actual implementation or delete if not needed.
"""

def main():
    print("Example script for {skill_name}")
    # TODO: Add actual script logic

if __name__ == "__main__":
    main()
'''

EXAMPLE_REFERENCE = """# Reference Documentation for {skill_title}

Replace with actual reference content or delete if not needed.

## When Reference Docs Are Useful

- Comprehensive API documentation
- Detailed workflow guides
- Complex multi-step processes
- Content too lengthy for main SKILL.md
"""

EXAMPLE_ASSET = """# Example Asset File

This placeholder represents where asset files would be stored.
Replace with actual asset files (templates, images, fonts, etc.) or delete if not needed.

Common asset types: .pptx, .docx, .png, .jpg, .svg, .ttf, .woff2, project directories
"""


def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case."""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name, path):
    """Initialize a new skill directory with template SKILL.md."""
    skill_dir = Path(path).expanduser().resolve() / skill_name

    if skill_dir.exists():
        print(f"Error: Skill directory already exists: {skill_dir}")
        return None

    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"Created skill directory: {skill_dir}")
    except Exception as e:
        print(f"Error creating directory: {e}")
        return None

    # Create SKILL.md
    skill_title = title_case_skill_name(skill_name)
    skill_content = SKILL_TEMPLATE.format(skill_name=skill_name, skill_title=skill_title)

    skill_md_path = skill_dir / 'SKILL.md'
    try:
        skill_md_path.write_text(skill_content)
        print("Created SKILL.md")
    except Exception as e:
        print(f"Error creating SKILL.md: {e}")
        return None

    # Create resource directories with examples
    try:
        scripts_dir = skill_dir / 'scripts'
        scripts_dir.mkdir(exist_ok=True)
        example_script = scripts_dir / 'example.py'
        example_script.write_text(EXAMPLE_SCRIPT.format(skill_name=skill_name))
        example_script.chmod(0o755)
        print("Created scripts/example.py")

        references_dir = skill_dir / 'references'
        references_dir.mkdir(exist_ok=True)
        example_reference = references_dir / 'api_reference.md'
        example_reference.write_text(EXAMPLE_REFERENCE.format(skill_title=skill_title))
        print("Created references/api_reference.md")

        assets_dir = skill_dir / 'assets'
        assets_dir.mkdir(exist_ok=True)
        example_asset = assets_dir / 'example_asset.txt'
        example_asset.write_text(EXAMPLE_ASSET)
        print("Created assets/example_asset.txt")
    except Exception as e:
        print(f"Error creating resource directories: {e}")
        return None

    print(f"\nSkill '{skill_name}' initialized at {skill_dir}")
    print("\nNext steps:")
    print("1. Edit SKILL.md to complete TODOs and update the description")
    print("2. Customize or delete example files in scripts/, references/, assets/")
    print("3. Run package_skill.py when ready to distribute")

    return skill_dir


def main():
    if len(sys.argv) < 4 or sys.argv[2] != '--path':
        print("Usage: init_skill.py <skill-name> --path <path>")
        print("\nSkill name requirements:")
        print("  - Hyphen-case (e.g., 'data-analyzer')")
        print("  - Lowercase letters, digits, and hyphens only")
        print("  - Max 64 characters")
        print("\nExamples:")
        print("  init_skill.py my-new-skill --path ~/.claude/skills")
        print("  init_skill.py api-helper --path ~/projects/skills")
        sys.exit(1)

    skill_name = sys.argv[1]
    path = sys.argv[3]

    print(f"Initializing skill: {skill_name}")
    print(f"Location: {path}\n")

    result = init_skill(skill_name, path)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
