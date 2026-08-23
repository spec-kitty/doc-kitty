---
work_package_id: WP02
title: Chrome substrate + sitemap exclusion
dependencies:
- WP01
requirement_refs:
- C-007
- FR-011
- FR-015
- FR-017
- FR-023
- FR-025
planning_base_branch: feat/metadata-model-and-chrome
merge_target_branch: feat/metadata-model-and-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-model-and-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-model-and-chrome unless the human explicitly redirects the landing branch.
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
- T017
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/Head.astro
- src/components/PageTitle.astro
- src/components/MarkdownContent.astro
- src/components/Footer.astro
- src/layouts/Default.astro
- src/layouts/kind-layouts.ts
execution_mode: code_change
owned_files:
- src/components/Head.astro
- src/components/PageTitle.astro
- src/components/MarkdownContent.astro
- src/components/Footer.astro
- src/layouts/Default.astro
- src/layouts/kind-layouts.ts
- src/styles/theme.css
- src/lib/config.ts
- src/package.json
- example/astro.config.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its
initialization, boundaries, directives, and tactics. Then read this WP,
[../spec.md](../spec.md), [../plan.md](../plan.md),
[../contracts/chrome-and-build-assertions.contract.md](../contracts/chrome-and-build-assertions.contract.md),
`docs/architecture/theming.md`, and `docs/adr/0013-m1-chrome-substrate-single-layer.md`.

## Objective

Stand up the ADR-0013 **single-layer** slot surface the chrome renders on: the
four Starlight carrier overrides, the static `kind → layout` map with a `Default`
layout, the complete neutral `--dk-*` token catalog + `--sl-*` bridge, the toolkit
component export, and the sitemap draft-exclusion filter. No brand theme, no
3-layer merge, no virtual manifest (that is M2 — C-002).

Depends on WP01: custom frontmatter reaches `entry.data` only via the WP01 schema.

## Subtasks

### T011 — The four carriers

- Create `src/components/` carriers: `Head.astro`, `PageTitle.astro`,
  `MarkdownContent.astro`, `Footer.astro`. Each reads page state from
  `Astro.locals.starlightRoute` (Starlight ≥0.30), **never** `Astro.props` (C-004).
- In M1 the carriers are thin: `Footer` and `Head` pass through Starlight's
  default plus doc-kitty's own slot host points (hero/band added in WP03; Head
  share tags in WP03). Define the `dk:` slot host structure now (empty slots that
  WP03 fills) so WP03 only adds slot bodies.

### T012 — Static `kind → layout` map + `Default` layout

- Create `src/layouts/Default.astro` (prose passthrough) and
  `src/layouts/kind-layouts.ts` with an **empty** map and
  `resolveLayout(kind) = map[kind] ?? Default`. **Do NOT reference `Hub.astro`
  here** — it does not exist until WP04, and 6 `kind: Hub` pages are already live
  after WP01's migration, so a `() => import('./Hub.astro')` entry would fail
  Vite/Rollup resolution and turn WP02's build **red** (violating C-010). In M1
  the map ships empty so **every** kind resolves to `Default`; WP04 registers the
  `Hub` key (a recorded out-of-map edit to this file).
- Resolve the layout in the `MarkdownContent` carrier at a **single** import site
  (ADR-0013 extension point — M2 swaps this for the merged manifest here).
- Keep content inside Starlight's searchable region (NFR-004).

### T013 — The complete neutral `--dk-*` catalog + bridge

- Expand `src/styles/theme.css` from the current 3 vars to the **complete** neutral
  Default catalog from `theming.md` (surfaces, text, accent low/-/high + accent-text,
  state info/success/warning/danger/neutral each with a paired `-bg` tint, type
  families + scale + leading + weights + caps tracking, spacing ramp, radius,
  elevation, layout widths).
- Add the bridge: assign each `--dk-*` into its `--sl-*` counterpart (per the
  theming.md bridge column). Redeclare only the mode-varying colour tokens under
  the dark selector.
- Pick neutral values that clear WCAG AA for every state text/`-bg` pair and the
  status-pill pairs (this is the by-construction basis WP04's AA check relies on).

### T014 — Wire the components map + token sheet

- In `src/lib/config.ts` `defineDocKittyIntegrations`: pass Starlight a
  `components` map pointing at the four carriers (resolved from the toolkit's new
  export). Keep the signature `(options)` — no `theme` param in M1 (ADR-0013).
- Ensure the token stylesheet is in `customCss` **before** any override sheet
  (tokens-before-overrides cascade, C-007).

### T015 — Toolkit component export (packaging seam)

- `src/package.json`: add `exports` entries `./components/*`, `./layouts/*`,
  `./assets/*` (keep `./styles/*`), and add the new dirs to `files[]` so they
  publish. Confirm `example/astro.config.mjs` resolves the carriers from the
  `workspace:*` dependency (Astro/Vite resolves `.astro` from a workspace dep).

### T016 — Sitemap draft-exclusion (+ tighten the assertion)

- Add a `filter` to the `@astrojs/sitemap` integration (in `defineDocKittyIntegrations`
  or `example/astro.config.mjs`) that drops the URL of any `doc_status: draft`
  page. Compute the draft URL set from the docs collection.
- **Recorded out-of-map edit** to `src/scripts/assert-build-artifacts.mjs` (owned
  by WP01): tighten the sitemap check to assert the draft URL is absent and the loc
  count matches the published set. Rationale: the filter and its assertion must land
  together to stay green (C-010). Note this one-line rationale in your handoff.

### T017 — Verify the substrate in the built example

- `pnpm --filter example build`; confirm the emitted config/HTML shows the four
  carriers in the components map, the full `--dk-*` catalog + bridge in the CSS,
  the draft absent from the sitemap, and every page still rendering via `Default`.

## Branch Strategy

Base/merge: `feat/metadata-model-and-chrome`. Depends on WP01 (schema fields).
Work in your lane's worktree from `lanes.json`.

## Definition of Done

- `pnpm --filter example build` + `pnpm assert:artifacts` green; draft absent from
  the sitemap; count still 12.
- `pnpm --filter example typecheck`, `pnpm lint`, `pnpm --filter @commondocs-kitty/toolkit test` green.
- The components map points at the four carriers; each carrier **references
  `Astro.locals.starlightRoute`** (positive grep) and **none reference `Astro.props`**.
- The emitted CSS declares the full `--dk-*` catalog + the `--sl-*` bridge,
  positioned before overrides. WP05 asserts **each token name** from the enumerated
  theming.md set is present (completeness, not just presence) — build the catalog to
  that list.
- The `kind → layout` map is empty (Default-only) and builds green with the 6
  live `Hub` pages resolving to `Default`.
- No brand/theme param introduced (C-002 preserved).

## Risks & reviewer guidance

- **Astro/Vite `.astro` resolution from a workspace dep** — verify the example
  build actually loads the toolkit carriers (not a silent fallback to Starlight's).
- **Cascade order** — reviewer confirms tokens load before override sheets, else M2
  brand layering breaks later.
- **starlightRoute** — reviewer greps carriers for `Astro.props` (should be none).
- **Out-of-map edit** to assert-build-artifacts.mjs is expected here — confirm it is
  only the sitemap assertion and is recorded.
