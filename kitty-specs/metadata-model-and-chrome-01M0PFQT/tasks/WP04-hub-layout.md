---
work_package_id: WP04
title: Hub layout + search coverage
dependencies:
- WP02
requirement_refs:
- FR-016
- NFR-001
- NFR-004
planning_base_branch: feat/metadata-model-and-chrome
merge_target_branch: feat/metadata-model-and-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-model-and-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-model-and-chrome unless the human explicitly redirects the landing branch.
subtasks:
- T023
- T024
- T025
- T026
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/layouts/
create_intent:
- src/layouts/Hub.astro
- src/styles/hub.css
execution_mode: code_change
owned_files:
- src/layouts/Hub.astro
- src/styles/hub.css
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply it, then read
this WP, [../spec.md](../spec.md) (FR-016, NFR-004, US2 AC4), and
`docs/architecture/theming.md` (Hub list, per-kind layouts, version notes on
Pagefind coverage).

## Objective

Ship the one bespoke in-frame per-kind layout — `Hub` — proving that `kind` drives
layout while the Starlight frame (sidebar, TOC, search, pagination) stays intact.
Keep its content inside Starlight's searchable region so Pagefind coverage does not
regress.

## Subtasks

### T023 — `Hub.astro` layout + register it in the map

- Create `src/layouts/Hub.astro` (WP-owned). Then **register the `Hub` key** in
  `src/layouts/kind-layouts.ts` — that file is owned by WP02 and ships empty
  (Default-only), so this is a **recorded out-of-map edit**: add
  `Hub: () => import('./Hub.astro')` so the 6 live `kind: Hub` pages (already tagged
  by WP01) resolve to this layout. Note the one-line rationale in your handoff.
- Render, in-frame: a lead paragraph (the page body's intro), then a named
  `<nav>` (accessible name) wrapping a list of described links to the section's
  child pages — each item the related-card pattern: title in
  `--dk-color-text-accent`, the target's own `description` in `--dk-color-text-muted`,
  optional kind tag. Card-wide clickable targets ≥24px.
- M1 **inlines** the card pattern here; M3 may extract a shared primitive (do not
  build the shared component now — DIRECTIVE_024).
- Derive child pages from the section (same first path segment); use the collection
  data already available to the carrier.

### T024 — Confirm the Hub demonstrator

- WP01's migration already sets `example/docs/context/README.md` to `kind: Hub`
  (section READMEs → Hub). Confirm it; if the lead paragraph or child links need a
  small content nudge, that page is WP01-owned (`example/docs/**`) so treat it as a
  small **recorded out-of-map edit**. **Do not add a page** (count stays 12, C-009).
  Its child pages (`context/product`, `context/domain`) must render as described links.

### T025 — AA by construction

- Add `src/styles/hub.css` (or fold into the Hub component) declaring
  `min-height`/`min-width: ≥24px` on the card link targets and a `:focus-visible`
  ring using the `--dk-shadow-focus` token; use only AA `--dk-*` token pairs. This
  is the by-construction basis for NFR-001 (no Playwright in M1).

### T026 — Assert search coverage

- Build; confirm the Hub page's lead/link text appears in the built
  `dist/pagefind/` fragment index (NFR-004). Record the assertion approach for WP05
  to encode into `assert-build-artifacts.mjs`.

## Branch Strategy

Base/merge: `feat/metadata-model-and-chrome`. Depends on WP02. Work in your lane's
worktree. WP04 and WP03 both depend on WP02 but touch disjoint files (layouts vs
slots), so they may proceed independently.

## Definition of Done

- A `kind: Hub` page renders a described-link list in-frame with the sidebar
  present, ≥24px targets, `:focus-visible` ring.
- The Hub page's body text is present in the built pagefind index.
- Count still 12; build + assert:artifacts + typecheck + lint + test green.

## Risks & reviewer guidance

- **Search regression** is the headline risk — reviewer confirms Hub text in the
  pagefind index, not just that the page renders.
- **Sidebar lost** — reviewer confirms the Hub renders in-frame (not `splash`),
  sidebar present.
- **Premature extraction** — reviewer confirms the card is inlined, not pulled into
  a shared M3 component.
