---
work_package_id: WP03
title: Metadata slots — hero, band, share
dependencies:
- WP02
requirement_refs:
- FR-012
- FR-013
- FR-014
- NFR-001
- NFR-003
planning_base_branch: feat/metadata-model-and-chrome
merge_target_branch: feat/metadata-model-and-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-model-and-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-model-and-chrome unless the human explicitly redirects the landing branch.
subtasks:
- T018
- T019
- T020
- T021
- T022
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/components/slots/
create_intent:
- src/components/slots/
- src/assets/
execution_mode: code_change
owned_files:
- src/components/slots/**
- src/assets/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply it, then read
this WP, [../spec.md](../spec.md) (US2, FR-012/013/014), `docs/architecture/metadata-model.md`
(images section), and `docs/architecture/theming.md` (metadata-band, Head slots).

## Objective

Render the two purely-metadata-derived slots and the head share metadata on the
WP02 carriers: `dk:page-hero`, `dk:metadata-band`, and the `Head` OG/Twitter/
canonical tags with the `social_thumb → hero_image.src → site-default` chain. No
audience/related/external blocks (those are M3 — C-003).

## Subtasks

### T018 — `dk:page-hero` slot

- In the `PageTitle` carrier's `dk:page-hero` slot (above `<h1>`): when
  `entry.data.hero_image` is set, render an `<img>` through Astro's optimized image
  pipeline (colocated asset or known assets path) with the **required** `alt`. When
  absent, render nothing.
- The emitted `src` must be an Astro-processed asset (hashed `/_astro/…` or a
  `srcset`) — the by-observable signal for NFR-003.

### T019 — `dk:metadata-band` slot

- In the `PageTitle` carrier's `dk:metadata-band` slot (below `<h1>`, published
  pages): render a text-labelled `doc_status` pill (a visible text label such as
  "draft" / "active", **never colour-only** — NFR-001), the `updated` date (mono,
  muted), and the `description`. Style with `--dk-*` tokens only (C-007).

### T020 — `Head` share metadata + fallback chain

- In the `Head` carrier: emit `og:title`, `og:description`, `og:image`,
  `og:image:alt`, `twitter:card=summary_large_image`, `twitter:image`, and a
  canonical URL from `title`/`description`/images.
- Image resolution: `social_thumb` → `hero_image.src` → the shipped site-default
  asset (T021). `social_thumb` may be a bare string or `{src,alt}`; `social_thumb`
  must resolve to a stable absolute URL for crawlers (NFR-003). The resolved
  `og:image`/`twitter:image` must differ per branch (three fixtures — see DoD).

### T021 — Ship the static site-default social asset

- Add a neutral default social image under `src/assets/` (exported via the WP02
  `./assets/*` export) and have the `Head` carrier consume it as the terminal
  fallback. Rationale: the M2 `theme.assets.socialImage` path does not exist yet;
  M1 needs a real default (research D-alphonso finding).

### T022 — Re-tag demonstrators for all three share branches; verify

- Provide a **real fixture for each of the three fallback branches** (no example
  page sets `social_thumb` today, so the 3-branch assertion is otherwise
  un-satisfiable):
  - **hero branch**: add `hero_image {src, alt}` to
    `example/docs/architecture/overview.md` and colocate a small asset.
  - **social_thumb branch**: add a `social_thumb` to one other existing page
    (e.g. `example/docs/guides/getting-started.md`).
  - **site-default branch**: any page with neither (most pages) exercises it.
  - **Do not add a new page** (count stays 12, C-009). Both pages are owned by
    WP01 (`example/docs/**`), so these are small **recorded out-of-map edits** (one
    frontmatter field each + the hero asset).
- Build; confirm the hero `<img>` (hashed src + alt), the metadata band with the
  text-labelled status, and that the resolved `og:image`/`twitter:image` are **three
  distinct values** across the three pages.

## Branch Strategy

Base/merge: `feat/metadata-model-and-chrome`. Depends on WP02 (carriers + tokens).
Work in your lane's worktree.

## Definition of Done

- Built example: metadata band with text-labelled status on published pages; an
  optimized hero `<img>` with alt on the demonstrator; complete head share tags
  with correct per-branch image resolution.
- Count still 12; `pnpm --filter example build` + `pnpm assert:artifacts` green;
  typecheck/lint/test green.
- Note: the **binding machine assertions** for the band/hero/share tags are authored
  in WP05 (T027) over `example/dist`; at WP03's own boundary these are verified by
  build + visual inspection, and WP05 is the gate that fails on a stub.

## Risks & reviewer guidance

- **Colour-only status** is an AA failure — reviewer confirms a visible text label.
- **Per-branch image** — reviewer checks all three fallback branches actually
  differ in the emitted `og:image`.
- **New file** would break the count — reviewer confirms the demonstrator re-tags
  an existing page.
