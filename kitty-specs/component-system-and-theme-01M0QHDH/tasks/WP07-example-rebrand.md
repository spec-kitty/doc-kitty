---
work_package_id: WP07
title: Example rebrand to the Spec Kitty theme
dependencies:
- WP02
- WP04
- WP05
- WP06
requirement_refs:
- FR-014
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
- T032
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: node-norris
role: implementer
authoritative_surface: example/
create_intent: []
execution_mode: code_change
owned_files:
- example/astro.config.mjs
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your implementing profile:

```
/ad-hoc-profile-load node-norris
```

Adopt Norris's identity and boundaries (Node/build-config discipline, minimal-diff
integration). Then read this prompt, `spec.md`, and `plan.md`.

## Objective

Rebrand the live example site to the Spec Kitty theme by selecting the theme — and
nothing else. This WP is the end-to-end proof of the no-fork promise (SC-001, FR-014):
the only change needed to rebrand is passing `theme:` to
`defineDocKittyIntegrations`. The M1 structural gates must stay green under the brand.

## Context

- The example currently calls `defineDocKittyIntegrations(options)` with no theme
  (neutral Default). WP02 made the entry point accept `{ theme }`; WP04 shipped the
  `specKittyTheme`.
- The M1 build-artifact and chrome assertions bind to **theme-agnostic** markers (token
  *names*, the `--dk-*→--sl-*` bridge assignments, the four carriers, the metadata band
  structure, the hero `<img>`, the three share-image derivations, the Hub Pagefind
  cards, `.dk-hub__card` ≥24px + dk `:focus-visible`, the agent-index count 12), so a
  correct brand build keeps them green.
- The deployed GitHub Pages site builds from the example, so after this WP the live site
  serves the Spec Kitty brand (dogfood + the DoD's "rebrand the live example").
- **The first themed build happens here**; the manifest codegen (WP02) statically imports
  EVERY brand-referenced path — the footer organism (WP05) and `Persona.astro` (WP06) —
  so those files must exist before this WP builds. Hence the WP05/WP06 dependencies.

## Subtasks

### T030 — Select the brand theme

**Purpose**: The single-line rebrand.

**Steps**:
1. In `example/astro.config.mjs`, import the brand theme:
   `import { specKittyTheme } from '@commondocs-kitty/toolkit/themes/spec-kitty';`
   (use the export path WP04 established).
2. Pass it: `defineDocKittyIntegrations({ ...existing options, theme: specKittyTheme })`.
3. Change nothing else in the config — no CSS copied, no component overridden by hand.

**Files**: `example/astro.config.mjs`.

**Validation**: `pnpm build` succeeds; the brand `--dk-*` values and assets appear in
`example/dist`; the header shows the logo + wordmark.

**Edge cases**: the theme export path must match WP04; if the brand ships fonts via
`assets.fonts`, confirm they load (self-hosted `@font-face` + Google Fonts) with a real
fallback stack.

### T031 — Verify M1 gates stay green under the brand

**Purpose**: Prove backward-compatible structural chrome under a theme (NFR-002 half).

**Steps**:
1. Run `pnpm assert:artifacts example/dist` — every M1 chrome + build assertion must pass
   on the branded build.
2. Confirm the token-catalog completeness check passes (brand overrides a subset; the
   emitted sheet still declares every `--dk-*` name because un-overridden tokens inherit
   from Default).
3. Confirm the agent-index count is still 12 and the three share-image demonstrators
   still resolve to three distinct values (the brand does not change example content).

**Files**: none (verification).

**Validation**: `pnpm assert:artifacts example/dist` exits 0 on the branded build.

**Edge cases**: if any M1 assertion depends on a Default-only value (it should not —
they bind to names/structure), record it for WP08 to strengthen to a non-fakeable
theme-agnostic marker rather than weakening it.

### T032 — No-fork proof

**Purpose**: Demonstrate SC-001 (zero files copied out of the toolkit).

**Steps**:
1. Confirm `git status` shows the rebrand touched only `example/astro.config.mjs` (plus
   any genuinely example-owned asset the site chooses to override via config, which is
   the consumer layer, not a fork).
2. Confirm no toolkit source (`src/**`) was copied into `example/`.

**Files**: none (verification).

**Validation**: the diff for the rebrand is the config change only; no `src/**` copy in
`example/`.

**Edge cases**: a per-site logo swap belongs in a consumer-layer theme override, not a
copied file — if the example demonstrates that, it stays in config.

## Branch Strategy

Planning artifacts were generated on `feat/component-system-and-theme`; the final merge
target is `feat/component-system-and-theme` (landing into `origin/main` via the mission
PR). This WP runs in its lane's execution worktree from `lanes.json`. Depends on WP02
(theme param), WP04 (the brand theme), WP05 (footer organism) and WP06 (Persona.astro) —
implement after all four are green, because the first themed build statically imports the
brand-referenced footer and Persona paths.

## Definition of Done

- `example/astro.config.mjs` selects `specKittyTheme` and nothing else changes to
  rebrand.
- `pnpm build` produces a branded `example/dist`; the header renders logo + wordmark.
- `pnpm assert:artifacts example/dist` is green (all M1 chrome + build gates, count 12).
- No toolkit file is copied into `example/` (no-fork proof recorded).
- The first themed build succeeds because every brand-referenced path exists: the manifest
  codegen (WP02) statically imports the footer organism (WP05) and `Persona.astro` (WP06),
  so this WP depends on WP05 and WP06 as well as WP02/WP04.

## Risks

- **Content drift**: changing example content would break the pinned counts and
  share-image demonstrators. Mitigation: this WP touches config only.
- **Font/asset loading under CSP/Pages**: verify self-hosted fonts + Google Fonts load
  with fallbacks.

## Reviewer Guidance

Verify the rebrand diff is the config change only; confirm `assert:artifacts` is green on
the branded build; confirm the live/deployed example is branded; confirm no `src/**` copy
landed in `example/`.
