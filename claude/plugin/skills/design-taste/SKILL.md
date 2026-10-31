---
name: design-taste
description: Make UI work look decided rather than averaged. Read or write the project's design manifest, apply different rules to pages and app screens, seed new looks from outside the model, and judge the result with a blind screenshot critic. Use when building, restyling, or reviewing a page, landing page, app screen, or a component's look, or when a UI looks generic, templated, or AI-made.
---

# Design taste

Asked for a look, a model picks the average of its category. Each step below
replaces that default with a decision: the project's rules, material from the
subject, randomness from outside the model, and a judge who sees only the result.

## 1. Read the rules first

Read the project's `DESIGN.md`, or the file its `CLAUDE.md` names; it overrides
this skill. If there is none and the work is more than a one-off fix, propose
writing one that describes what the code does today: colours named from the
subject's world, each with a role and a rough share of the screen ("accent,
~5%"); the physical things the brand stands on, with each animation mapped to
one of them or marked functional; and house rules for its kind of work (step 2).

## 2. Page or app screen

A page is read and scrolled (landing, marketing, about). An app screen is worked
in (feed, dashboard, list, editor, settings). Most projects are mostly app screens.

- **App screens:** dense panels, small labels, repeated rows and quiet borders
  are normal. Out: decorative gradients and glows, icons in tinted squares,
  rainbow charts, invented numbers.
- **Pages:** also watch for the stock sequence (hero, logo strip, three icon
  cards, testimonial, pricing, call to action), label chips above headlines,
  cards inside cards, gradient text, equal weight everywhere, vague headlines.
- A choice the manifest records, such as retro chrome, is not a tell. Judge
  against the manifest before any generic list or third-party checker.

## 3. A new page or look

- **Inventory the subject:** 8–12 things that belong to it and no competitor
  (its name's meaning, place, numbers, constraints, rituals, materials, printed
  things). Take the idea from one of them.
- **Outline as claims:** one line per section, a claim and its proof. Delete
  any section without a claim.
- **Show the product as it is:** real screens, real moments in the app, data
  that adds up. No grey bars, lorem ipsum, or invented customers.
- **Add substance, not only restraint.** A page stripped of tells with nothing
  in their place reads as thin: larger type, whole fields of colour, real
  pictures, full content.

## 4. Concepts seeded from outside the model

When no manifest settles the look, make three concepts, not one. First write
4–6 axes (composition, type pairing, palette, density, motion), each with 4–8
options from the inventory and references, so a seed can't be steered after the
fact. Then seed each concept with `openssl rand -hex 6`: byte *i* modulo the
length of list *i* picks that axis's option. Record the picks and keep the seed
out of the design. Build all three on the same content, side by side; the user
picks. Don't pick for them, and don't average them.

## 5. Write the intent down

Add one comment per visual rule saying what it is for, not how it works ("strong
colours never touch"), so a later edit knows what it must not break. Give every
animation a `prefers-reduced-motion` fallback.

## 6. Blind critic

Before calling visual work done, take screenshots at 390 and 1440 wide (the
`shots` skill where installed, else Playwright). Give a fresh-context subagent,
no weaker than the builder, only the screenshots, the manifest's house rules,
and any reference images: no diff, builder notes, or statement of intent. It
scores 1–10 on the rubric and names the three worst problems, each tied to a
place on a screenshot. Fix them, re-shoot, and ask a new critic. Stop at 9 or
after three rounds, reporting each round's score and changes; if the score
stalls for two rounds, stop and show the user, because the brief or rubric is wrong.

Rubric: follows the house rules; one clear focus per screen; weight matches
importance; nothing looks like a default nobody chose; reads at phone width;
content is real and complete. The score is evidence, not the user's verdict.
