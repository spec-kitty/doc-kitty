---
work_package_id: WP04
title: Persona (stakeholder profile) layout polish — single identity, one h1, no broken hero
dependencies: []
requirement_refs:
- FR-009
- FR-010
- FR-011
- NFR-006
planning_base_branch: feat/deck-layout-polish
merge_target_branch: feat/deck-layout-polish
branch_strategy: Planning artifacts for this mission were generated on feat/deck-layout-polish. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/deck-layout-polish unless the human explicitly redirects the landing branch.
subtasks:
- T011
- T012
- T013
history:
- created by /spec-kitty.tasks (scope addition 2026-09-05)
agent_profile: frontend-freddy
authoritative_surface: src/layouts/Persona.astro
create_intent: []
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/components/PageTitle.astro
- src/layouts/Persona.astro
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_024 (gate at the shared carrier precisely, keep other kinds byte-identical), a11y-first (single h1).

## Objective

Polish the `kind: Persona` (stakeholder profile) layout so a persona page reads as ONE
coherent identity — the passport card — instead of today's broken full-bleed hero + a
Starlight `<h1>` + a metadata band + a passport that repeats the name/avatar/fields (three
identity renders, two `<h1>`s). Read `../spec.md` (US4, FR-009/010/011, NFR-006, C-008),
`../plan.md` (IC-05, D-08), `../research.md`. Work in the lane worktree only.

## Critical context (verified on main 7531919, pixel-confirmed both themes)

- `src/components/PageTitle.astro` is doc-kitty's Starlight PageTitle override. For EVERY
  page it renders `dk:page-hero` (the `hero_image` blown up — on a persona it is a giant
  black avatar disc), then Starlight's default `<h1>` (`<Default {...route}/>`), then
  `dk:metadata-band` (doc_status pill + updated + description).
- `src/layouts/Persona.astro` renders the `.dk-passport` card: a yellow strip, a small
  avatar (same `hero_image`), `<h1 class="dk-passport__name">{title}</h1>`, and a `<dl>` of
  fields (role/goals/responsibilities + status/updated/type/authors/tags), then `<slot/>`.
- Result: giant hero + article H1 + band ABOVE, passport (name + avatar + fields) BELOW →
  triple identity, TWO `<h1>`s, duplicated status/updated/type. The layout's own header
  comment states the passport is meant to BE the identity.
- `kind` is read in MarkdownContent via `route.entry.data.kind`; PageTitle currently does
  NOT read `kind` — add it to the narrow cast.
- Starlight's default PageTitle renders `<h1 id="_top" …>` — `id="_top"` is the skip-link /
  back-to-top target. If you suppress the default h1, the passport h1 MUST carry `id="_top"`.

## Subtasks

### T011 — Gate PageTitle on `kind === 'Persona'`
- In `PageTitle.astro`, read `kind` from `entry.data` (extend the narrow cast). When
  `kind === 'Persona'`, render NOTHING from this carrier — no `dk:page-hero`, no
  `<Default {...route}/>` (Starlight h1), no `dk:metadata-band`. The passport (Persona.astro)
  becomes the sole header.
- For EVERY other kind, the output must be BYTE-IDENTICAL to current main (gate precisely;
  keep the existing element/whitespace shape — mirror the dormancy discipline used in
  MarkdownContent.astro). Prefer a single early branch that returns the persona-empty case
  vs. the existing markup unchanged.
- **Files**: `src/components/PageTitle.astro`.
- **Validation**: a Default/Hub/Presentation page's header HTML is unchanged (diff the built
  HTML vs main); a Persona page emits no page-hero/band/default-h1 from this carrier.

### T012 — Passport is the sole identity header (single h1 + skip target)
- In `Persona.astro`, give the passport `<h1 class="dk-passport__name" id="_top">` so it is
  the page's single `<h1>` AND the skip-link/back-to-top target that Starlight's title
  normally provides.
- Keep the `.dk-passport` marker, the avatar (small, in the card), and ALL field rows — do
  NOT remove the WP08 branded-build proof (C-008). The status/updated/type/etc. now live
  ONLY in the passport (the band is suppressed), which is the intended single source.
- Optionally ensure the passport sits at the top of the content flow so it reads as the page
  header (it already renders first in the layout; confirm placement once PageTitle is gated).
- Do not change the avatar asset or the fixture pages.
- **Files**: `src/layouts/Persona.astro`.
- **Validation**: exactly one `<h1>` on a persona page, and it carries `id="_top"`.

### T013 — Verify single-h1, non-regression, proof preserved
- Build and confirm on the example persona page (`context/audience/example-persona/`):
  1. `grep -c '<h1' example/dist/context/audience/example-persona/index.html` returns 1.
  2. `id="_top"` is present on that h1.
  3. `.dk-passport` and the field labels (Role/Goals/…) are present.
  4. No `dk-page-hero` image and no `dk-metadata-band` render on the persona page.
- Confirm a non-Persona page (e.g. `guides/markua-showcase/`) header is byte-unchanged vs
  main (diff the header region).
- If an existing test asserts persona/PageTitle structure, update it to match the new
  contract (stay within owned files; if a shared test needs changing, flag the orchestrator).
- **Files**: verification only (no new owned files).
- **Validation**: `pnpm build` + `pnpm test:a11y` green; single-h1 confirmed.

## Branch Strategy

Planning branch: `feat/deck-layout-polish`. Final merge target: `feat/deck-layout-polish`.
Independent lane (no dependency). Work only inside your lane worktree. Do not merge/push to
`main`.

## Definition of Done
- T011–T013 complete; `spec-kitty agent tasks mark-status T011 T012 T013 --status done`.
- `pnpm build` + `pnpm typecheck` + `pnpm test:a11y` green.
- Persona page: one identity card, one `<h1 id="_top">`, no giant hero, no band, no dup
  metadata; `.dk-passport` + fields preserved. Non-Persona headers byte-unchanged.

## Risks / reviewer guidance
- **Reviewer (opus)**: verify the `kind` gate is strict (diff a non-Persona page's built
  header vs main — must be identical); verify exactly one `<h1>` with `id="_top"` on the
  persona page; verify `.dk-passport` + all field rows survive (C-008); verify both themes in
  the pixel pass show a single clean identity card and no broken hero.
