---
name: design-ctx
description: Generate and maintain a DESIGN.md manifest from your codebase -- a design source of truth for AI-assisted development. Use when starting a new project, adding UI features, or refreshing the design manifest after changes.
---

# Design Context Generator

Scan the codebase and generate/update a `DESIGN.md` manifest that serves as the design source of truth for AI-assisted development.

## When to Use

- **`/design-ctx init`** -- First time setup. Scan the project, generate DESIGN.md, wire into CLAUDE.md.
- **`/design-ctx sync`** -- Re-scan and update. Preserves manual sections (philosophy, route descriptions), refreshes auto-detected sections (tokens, components, routes).
- **`/design-ctx diff`** -- Show what changed since the last DESIGN.md was generated. No file changes.

## Init Workflow

1. **Detect the project stack.** Read `package.json` to identify:
   - Framework (SvelteKit, Next.js, Nuxt, Svelte, React, Vue, Astro)
   - CSS approach (Tailwind, CSS custom properties, Emotion, styled-components, vanilla)
   - Component library (shadcn-svelte, shadcn, Mantine, Chakra, DaisyUI)
   - TypeScript (check for `tsconfig.json`)

2. **Scan design tokens.** Read CSS files for `:root` / `:global(:root)` blocks. Extract CSS custom properties. Check these files in order (use first match):
   - `src/app.css`, `src/global.css`, `src/styles/globals.css`, `src/styles/tokens.css`
   - `app/globals.css`, `src/routes/+layout.svelte`, `src/lib/styles/tokens.css`

   **Categorize tokens** by name prefix/pattern:
   | Priority | Pattern | Category |
   |----------|---------|----------|
   | 1 | `--z-*` | z-index |
   | 2 | `*glass*` | surfaces |
   | 3 | `*color*`, `*background*` (not `--z-*`) | colors |
   | 4 | `*font*`, `*heading*`, `*line-height*`, `*letter-spacing*` | typography |
   | 5 | `*shadow*`, `*elevation*` | shadows |
   | 6 | `*border*`, `*radius*`, `*rounded*` | borders |
   | 7 | `*spacing*`, `*gap*`, `*padding*`, `*margin*` | spacing |
   | 8 | `*breakpoint*`, `*screen*` | breakpoints |
   | 9 | `*safe-area*`, `*inset*` | layout |
   | 10 | `*gradient*`, `*surface*`, `*bg-*` | surfaces |
   | 11 | `*transition*`, `*duration*`, `*ease*`, `*animation*` | motion |
   | -- | everything else | other |

3. **Scan components.** Walk the component directory tree (check `src/lib/components`, `src/components`, `components`, `app/components`). For each `.svelte`, `.tsx`, `.jsx`, `.vue` file:
   - Record name, path, and domain (inferred from parent directory name)
   - Skip test files, stories, and index barrel files
   - Group by domain directory, sort alphabetically

4. **Scan routes.** Walk the file-based routing directory:
   - SvelteKit: `src/routes/` (look for `+page.svelte`)
   - Next.js: `app/` or `pages/` (look for `page.tsx`)
   - Convert `[param]` to `:param`, strip SvelteKit group folders `(group)`
   - **Read each page file** (first 30-50 lines) to write a one-line description

5. **Scan layout.** Read the root layout file for:
   - Navigation patterns (top nav, sidebar, bottom nav)
   - Breakpoints from `@media` queries
   - Max-width constraints
   - PWA status (manifest.json, service worker references)

6. **Generate `DESIGN.md`.** Use the template structure below. Write the file.

7. **Add `.design-ctx.snapshot.json` to `.gitignore`** if not already there.

8. **Add DESIGN.md reference to CLAUDE.md** if one exists. Add a row to the architecture table or a line in the project overview pointing to DESIGN.md.

9. **Save snapshot.** Write scan results to `.design-ctx.snapshot.json` for future diffing.

10. **Prompt the user** to review and fill in the Design Philosophy section if you didn't have enough context to write it yourself. If the project has an existing README, about page, or clear visual identity, write a draft philosophy.

## Sync Workflow

1. Run the same scan as init.
2. Read existing DESIGN.md and identify manual sections (Design Philosophy, route descriptions that aren't placeholders, Figma notes).
3. Compare current scan against `.design-ctx.snapshot.json` to identify changes.
4. Regenerate auto-detected sections (tokens, components, routes list) while preserving manual content.
5. Update snapshot.
6. Report what changed.

## Diff Workflow

1. Run the scan.
2. Compare against `.design-ctx.snapshot.json`.
3. Report added/removed tokens, components, and routes.
4. Do not modify any files.

## DESIGN.md Template

```markdown
# {Project Name} Design Manifest

> This file is the design source of truth for AI-assisted development.
> When generating or modifying UI, read this file first.

---

## Design Philosophy

{2-5 sentences about the app's visual identity, vibe, and core design principles.}

---

## Technical Constraints

| Constraint | Value |
|---|---|
| Framework | {framework} |
| Language | {TypeScript or JavaScript} |
| Styling | {css approach} |
| Component Library | {if any} |
| Tokens | CSS custom properties in `{source file}` |

---

## Design Tokens

Found **{N} tokens** across {N} categories.
Always use these tokens -- never hardcode values.

### {Category}

- `--token-name` -- `value`

---

## Layout & Navigation

Layout defined in `{layout file}`.

**Navigation pattern:** {top / sidebar / bottom / combination}

### Routes

| Route | Description |
|---|---|
| `/path` | {one-line description} |

---

## Components

**{N} components** organized by domain.

- **{Domain}** -- `Component1`, `Component2`, ...

---

## Maintaining This Document

When new design decisions are made:

1. Update this file, not Figma
2. Add decisions under the appropriate section
3. Run `/design-ctx sync` to refresh auto-detected sections
4. Keep descriptions intent-focused, not pixel-focused
```

## Key Principles

- **The codebase is the design system.** DESIGN.md reflects reality, not aspirations.
- **Intent over pixels.** Capture "what tokens exist" and "what components exist," not "buttons have 12px padding."
- **Manual sections are sacred.** Never overwrite Design Philosophy, route descriptions, or Figma notes during sync.
- **Low maintenance.** Auto-detected sections update with sync. Manual sections are write-once.

## Example Prompts

- "Set up design-ctx for this project"
- "Generate a DESIGN.md"
- "Refresh the design manifest"
- "What's changed in the design system since last scan?"
- "Update DESIGN.md with new tokens and components"
