---
work_package_id: WP02
title: Manifest transport and layout-resolution swap
dependencies:
- WP01
requirement_refs:
- FR-003
- FR-005
- FR-007
- FR-008
- FR-018
- NFR-002
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
- T009
- T010
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: node-norris
role: implementer
authoritative_surface: src/lib/
create_intent:
- src/lib/manifest.ts
execution_mode: code_change
owned_files:
- src/lib/manifest.ts
- src/lib/config.ts
- src/layouts/kind-layouts.ts
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile:

```
/ad-hoc-profile-load node-norris
```

You are **node-norris**, the server-side/Node.js + build-integration implementer. This
WP builds an Astro integration and a Vite virtual module — build-time codegen, not
browser code. Spike the risky mechanism first, keep the render-time contract
synchronous, and preserve the M1 seams verbatim.

## Objective

Replace the M1 static `kind → layout` module with the **merged virtual manifest** at
the single `MarkdownContent` import site, and wire `defineDocKittyIntegrations({ theme })`
to resolve + emit the theme (using WP01) while keeping the three ADR-0013 seams intact.
This is the MVP-core WP: after it lands, the no-theme example must still build green.

## Context

Settled design: ADR-0013 "Extension points M2 must preserve" (seam 1: the single
layout import site; seam 2: CSS-after-tokens cascade; seam 3: components map = four
carriers) and **ADR-0015** (layouts resolve at the single site; slots resolve
per-carrier — WP03; the components map stays the four carriers; the brand header rides
native config — WP04). research.md Decision 1 fixes the transport mechanism:
integration-generated virtual module → **synchronous** `resolveLayout`.

M1 seams to extend, not rewrite:
- `src/layouts/kind-layouts.ts` — the static `kindLayouts` map + `resolveLayout(kind)`.
- `src/components/MarkdownContent.astro` — imports `resolveLayout` (line ~24) and calls
  `const Layout = resolveLayout(kind)` (line ~32). **This carrier body must not
  change** — WP02 keeps `resolveLayout`'s exact synchronous signature.
- `src/lib/config.ts` — today `customCss: ['@commondocs-kitty/toolkit/styles/theme.css']`
  (token sheet first) and `components: carriers` (the four).

## Subtasks

### T006 — Build spike (do this FIRST)

**Purpose**: De-risk the one unproven mechanism (spec C-006) before touching the
carrier seam.

**Steps**:
1. In a throwaway spike (or a guarded branch of `manifest.ts`), prove an Astro
   integration registered at `astro:config:setup` can inject a `virtual:` module whose
   generated source statically imports a `.astro` layout by path and exports a
   **synchronous** `resolveLayout(kind)` returning the component.
2. Confirm it builds on the pinned `astro@5.18.2` / `@astrojs/starlight@0.32.6`
   (do not bump either — C-002).
3. If synchronous resolution is not achievable this way, STOP and surface a new ADR
   (C-009) rather than switching to an async/dynamic-import mechanism.

**Files**: `src/lib/manifest.ts` (spike, then real impl).

**Validation**: a spike page renders a layout resolved through the virtual module with
no `await` at the call site.

**Edge cases**: consumer themes may point `layouts` at out-of-tree `.astro` paths —
the codegen must emit a static import for each resolved path (not an `import.meta.glob`
that only sees in-tree files).

### T007 — manifest.ts: the integration + virtual module

**Purpose**: Transport the merged theme's `layouts` + `slots` to the carriers.

**Steps**:
1. Create `src/lib/manifest.ts` exporting an Astro integration factory that takes the
   resolved theme (from WP01's `resolveTheme`).
2. At `astro:config:setup`, codegen `virtual:doc-kitty/manifest` whose source:
   - statically `import`s each `kind → path` layout and each `dkSlot → path` component
     from the merged theme;
   - exports `resolveLayout(kind: string | undefined): LayoutComponent` (map lookup,
     `Default` fallback) and `slotComponents: Partial<Record<DkSlotName, Component>>`.
3. Register the virtual module via a Vite plugin (`resolveId`/`load`) inside the
   integration. No runtime dynamic `import(path)`.

**Files**: `src/lib/manifest.ts` (new).

**Validation**: `virtual:doc-kitty/manifest` resolves at build; `resolveLayout` is
synchronous; unknown kind → `Default`.

**Edge cases**: no theme → the generated manifest equals the M1 static module (Hub
registered, everything else Default), no slot overrides.

### T008 — kind-layouts.ts backed by the manifest

**Purpose**: Swap the static module for the manifest **at the same import site**,
preserving the signature so `MarkdownContent.astro` is byte-unchanged (seam 1 /
ADR-0015 decision 1).

**Steps**:
1. Change `src/layouts/kind-layouts.ts` so `resolveLayout(kind)` delegates to the
   manifest's `resolveLayout`, keeping the exact type `(kind: string | undefined) => LayoutComponent`.
2. Keep `Default` as the fallback and `Hub` registered in the no-theme case (parity
   with M1 WP04).
3. Do **not** edit `src/components/MarkdownContent.astro` — verify its import line and
   `const Layout = resolveLayout(kind)` call still compile unchanged.

**Files**: `src/layouts/kind-layouts.ts`.

**Validation**: `git diff src/components/MarkdownContent.astro` is empty; the Hub page
still renders `dk-hub__list`.

**Edge cases**: the validator still only warns on unknown kinds (ADR-0009) — resolution
never throws.

### T009 — config.ts: the { theme } parameter and wiring

**Purpose**: Accept the theme, emit the token sheet, register the manifest integration,
and preserve seams 2 and 3.

**Steps**:
1. Extend `DocKittyOptions` / the `defineDocKittyIntegrations` signature to accept an
   optional `theme?: DocKittyTheme` (backward-compatible — the M1 `(options)` call with
   no theme is unchanged).
2. Call `resolveTheme(theme)` + `emitTokenSheet` (WP01). With a theme, add the emitted
   sheet + brand/consumer `customCss` **after** the base token sheet (seam 2). With no
   theme, keep the single static `customCss` entry (byte-compat, NFR-002).
3. Register the manifest integration (T007) in the returned integrations array.
4. Keep `components: carriers` — exactly the four carriers (seam 3). Forward theme
   `assets` to Starlight `logo`/`favicon`/`title` (native config; no components-map
   expansion — ADR-0015 decision 5). Do NOT register Header/SiteTitle overrides
   (FR-018).

**Files**: `src/lib/config.ts`.

**Validation**: with no theme, `customCss` deep-equals the M1 single entry; with a
theme, brand CSS follows the token sheet; `components` has exactly four keys.

**Edge cases**: the `...overrides` escape hatch must not let a caller add a fifth
component override silently — document that the components map is fixed.

### T010 — Verify no-theme build stays green

**Purpose**: Prove WP02 lands without regressing M1, before the example is rebranded
(WP07).

**Steps**:
1. Build the (still-unthemed) example: `pnpm build`.
2. Run `pnpm assert:artifacts example/dist` — every M1 chrome/build assertion and the
   pinned agent-index count (12) must pass.
3. Confirm the Hub page renders through the manifest (default layer) identically to M1.

**Files**: none (verification); record the result in the WP history.

**Validation**: `assert:artifacts` exits 0; agent index count = 12; sitemap URL count
= 12; `dk-hub__list` present.

**Edge cases**: if the manifest changes the emitted CSS filename/order for the no-theme
case, the token-catalog check could shift — keep no-theme emission byte-identical.

## Branch Strategy

Planning branch: `feat/component-system-and-theme`; final merge target the same branch
(then `origin/main` via the mission PR). This WP depends on **WP01**, so it branches
from WP01's lane per `lanes.json`; do not create branches by hand.

## Definition of Done

- `src/lib/manifest.ts` provides the integration + `virtual:doc-kitty/manifest` with a
  synchronous `resolveLayout` and `slotComponents` (build spike proven, T006).
- `src/layouts/kind-layouts.ts` is manifest-backed with the unchanged signature; `git
  diff src/components/MarkdownContent.astro` is empty.
- `src/lib/config.ts` accepts `{ theme }`, appends brand/consumer CSS after the token
  sheet, keeps `components` at exactly four carriers, forwards assets to native config.
- No-theme `pnpm build` + `pnpm assert:artifacts example/dist` green (count 12);
  Hub renders through the manifest.
- No change outside `owned_files`.

## Risks

- **Async leakage** (seams F1/F2): a dynamic-import mechanism would force the carrier
  to `await`, breaking seam 1. The spike (T006) gates this; keep resolution synchronous.
- **Components-map creep**: forwarding assets must use native `logo`/`title`, never a
  Header override (ADR-0015 decision 4).
- **Cascade order**: brand CSS must follow the token sheet, or brand layering loses.

## Reviewer Guidance

- Verify `MarkdownContent.astro` is byte-unchanged (the seam-1 proof).
- Verify `components` has exactly four keys after `defineDocKittyIntegrations`, with and
  without a theme (WP08 adds the automated invariant).
- Verify the no-theme `customCss` is the single static entry (byte-compat).
- Confirm no runtime dynamic import of a path string anywhere in `manifest.ts`.
- Confirm the build spike is documented (mechanism + that it holds on 5.18.2/0.32.6).
