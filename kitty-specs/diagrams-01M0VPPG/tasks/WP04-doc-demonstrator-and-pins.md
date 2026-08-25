---
work_package_id: WP04
title: Doc demonstrator + build/chrome assertions + count re-pin
dependencies:
- WP03
requirement_refs:
- FR-008
- FR-010
- FR-012
- NFR-003
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T014
- T015
- T016
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: example/docs/architecture/
create_intent:
- example/docs/architecture/diagram-demonstrator.md
execution_mode: code_change
owned_files:
- example/docs/architecture/diagram-demonstrator.md
- src/scripts/assert-build-artifacts.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../quickstart.md](../quickstart.md),
[../contracts/render-token-and-assertions.md](../contracts/render-token-and-assertions.md),
and `docs/adr/0023-diagram-render-and-metadata-seam.md`.

## Objective

Publish the **example demonstrator page** showing the full metadata surface, and add the
**build/chrome assertions** that prove the static HTML carries the figure, the injected
accessibility statements, and the no-JS source+caption — plus re-pin the index/sitemap counts
for the new page. a11y stays green because the demonstrator is **not yet scanned** (WP06 adds
it to AXE_PAGES). Runs **parallel to WP05**.

## Subtasks

### T014 — Demonstrator page (`example/docs/architecture/diagram-demonstrator.md`)
- A `docs`-collection page with **two** diagrams, deliberately spanning **two distinct
  guaranteed types** (squad F6-coverage — so a non-flowchart renders end-to-end, and the a11y
  lane confirms Mermaid emits `<title>`/`<desc>` for more than one type):
  1. an **all-fields** diagram (`%% title`, `%% description`, `%% attribution`, `%% source`)
     as a **flowchart**;
  2. a **title-absent** diagram (only `%% description`) as a **sequence** (or class) —
     proving the accTitle→description name fallback end-to-end **on a non-flowchart type**.
- Prose framing per [quickstart.md](../quickstart.md): what the fields do, the reserved
  `%%{ }%%` caveat, the no-JS behaviour. Keep it a real demonstrator page authors can copy.

### T015 — Build/chrome assertions (`src/scripts/assert-build-artifacts.mjs`)
- Extend the built-HTML assertions (see contract BD-1/BD-2/BD-4):
  - **BD-1**: the demonstrator emits `<figure class="dk-diagram">` + `<pre class="mermaid">`
    with the injected `accTitle`/`accDescr` **in the source**;
  - **BD-2 no-JS (squad F8 — assert real content, not just `<pre>` presence)**: the built HTML
    contains the **actual diagram source tokens** (e.g. the diagram-type keyword `flowchart`/
    `sequenceDiagram` **and** a concrete node/actor label from the page) **and** the
    `<figcaption>` description text, **in document order** — proving the raw source + caption
    survive without the client render (meaning preserved);
  - **Positive browser-free proof (squad F7 / NFR-004)**: assert the static `dist` HTML for the
    demonstrator contains **no rendered `<svg>` inside `figure.dk-diagram`** — an SVG in the
    static file would prove a build-time render ran, i.e. the build was **not** browser-free.
    This is the cleanest proof of the client-side-only premise; pair it with BD-2.
  - **BD-4 pinned + no CDN**: assert the pinned `astro-mermaid@2.1.0` / `mermaid@11.17.1` are
    the resolved versions and no external/CDN diagram request is emitted (manifest/lockfile diff
    or built-asset scan — whichever this script already uses for the no-CDN check).

### T016 — Re-pin the counts
- Bump `EXPECTED_INDEX_ENTRY_COUNT` / `EXPECTED_SITEMAP_URL_COUNT` **18 → 19** for the **one**
  new published demonstrator route.
- **No cross-WP coordination needed (squad F5-sizing / F-A-deps):** the showcase deck WP05
  edits is an **already-published** route (already inside the current 18) — WP05 adds a diagram
  to it, **not** a new URL. So WP04 owns the **sole +1**; WP05 changes no count. (If, and only
  if, the build surfaces an unexpected count, reconcile against the actual `dist` sitemap.)

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **Depends on WP03**.
Runs **parallel to WP05**. Implement with `spec-kitty agent action implement WP04 --agent claude`.

## Definition of Done

- Demonstrator published with an all-fields diagram + a title-absent (description-only) diagram.
- Build/chrome assertions green: figure + injected statements present; no-JS source+caption in
  order; pinned versions, no CDN.
- Counts re-pinned; build-example passes.
- `ci-ok` green — the demonstrator is **not** in AXE_PAGES yet (WP06 scans it), so a11y is
  unaffected here.

## Risks / Reviewer guidance

- **Count** — the demonstrator is the only newly published route (18 → 19); WP05 edits an
  existing deck route and adds none, so there is no number to negotiate with WP05.
- **No-JS assertion** — this is the FR-008 degradation guarantee; verify the *raw source* (not
  a rendered SVG) plus the caption are in the built HTML.
- **Guaranteed types** — keep the demonstrator on flowchart/sequence/class; an exotic type is
  out of the v1 a11y guarantee.
