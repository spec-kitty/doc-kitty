---
work_package_id: WP04
title: Spec Kitty brand — tokens, assets, header
dependencies:
- WP01
- WP02
requirement_refs:
- FR-009
- FR-010
- FR-011
- NFR-001
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T015
- T016
- T017
- T018
- T019
- T020
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
role: implementer
authoritative_surface: src/themes/spec-kitty/
create_intent:
- src/themes/spec-kitty/index.ts
- src/themes/spec-kitty/tokens.css
- src/themes/spec-kitty/assets/
execution_mode: code_change
owned_files:
- src/themes/spec-kitty/index.ts
- src/themes/spec-kitty/tokens.css
- src/themes/spec-kitty/assets/**
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load your profile before anything else:

```
/ad-hoc-profile-load frontend-freddy
```

You are **frontend-freddy**. This WP is the brand's design-token + asset layer. Hard
constraint: the theme is **derived, not imported** — nothing may reference
`@spec-kitty/tokens`, the spec-kitty CDN, or the `spec-kitty-design` repo (C-005). The
brand sets `--dk-*` only, never `--sl-*` (the base sheet owns the bridge).

## Objective

Ship the Spec Kitty brand theme's own `--dk-*` values (both light and dark), its
self-contained assets (logo, favicon, fonts, diagram token values), and the native
`logo`/`title` header wiring — so selecting `specKittyTheme` rebrands the site and the
brand renders in both modes at WCAG 2.2 AA.

## Context

- **Settled design**: [theming-spec-kitty-brand.md](../../../docs/architecture/theming-spec-kitty-brand.md)
  is the transcribed token table and chrome spec (dark transcribed, light **derived** —
  the derived light column is the main review target). [theming.md](../../../docs/architecture/theming.md)
  §Layering, §"The token catalog", §Wiring. [ADR-0011](../../../docs/adr/0011-theme-slot-surface-and-per-kind-layouts.md)
  decision 5 (self-contained brand). [ADR-0015](../../../docs/adr/0015-m2-slot-resolution-and-components-map-seam.md)
  decision 5 (native header, no components-map change).
- **The surface you build on**: WP01 provides the `DocKittyTheme` type + `mergeTheme` +
  `emitTokenSheet`; WP02 provides `defineDocKittyIntegrations({ theme })` and the manifest.
  The base sheet `src/styles/theme.css` already carries the complete neutral Default
  `--dk-*` catalog + the `--dk-*→--sl-*` bridge — the brand **overrides a subset and
  inherits the rest** (spacing, widths, numeric type scale, leading, shadow geometry).
- **Brand structural fact**: dark-mode-first. The guide ships dark values; the light
  column is derived and AA-checked.

## Subtasks

### T015 — `spec-kitty/index.ts`: the theme definition

**Purpose**: Declare the brand as a `DocKittyTheme` that extends the shipped Default.

**Steps**:
1. Create `src/themes/spec-kitty/index.ts` exporting `specKittyTheme: DocKittyTheme`
   (type from WP01's `src/lib/theme.ts`).
2. Set: `name: 'spec-kitty'`; `extends` the default; `tokens` pointing at
   `./tokens.css`; `assets: { logo, favicon, fonts: [...] , socialImage }`;
   `slots: { 'dk:site-footer': '<brand footer from WP05>' }` (leave the value as the
   WP05 organism path or a placeholder the WP05 lane fills — keep the key);
   `layouts: { Persona: '../../layouts/Persona.astro' }` (the WP06 layout).
3. Keep the definition declarative — no logic; the merge (WP01) consumes it.

**Files**: `src/themes/spec-kitty/index.ts`.

**Validation**: `astro check` passes; importing `specKittyTheme` typechecks against
`DocKittyTheme`.

**Edge cases**: `layouts`/`slots` values reference files owned by WP05/WP06 — coordinate
so the paths resolve once those land (dependency order WP04 → WP05 → WP06).

### T016 — `tokens.css`: brand `--dk-*` overrides, both modes

**Purpose**: Transcribe the brand palette into `--dk-*`, overriding only the brand's
subset (colour, type families, radius, focus, caps tracking).

**Steps**:
1. Create `src/themes/spec-kitty/tokens.css` declaring the brand `--dk-*` values from
   the brand doc's token tables: surfaces, text, accent (the yellow signal), state +
   paired `-bg`, `--dk-font-display/-sans/-mono`, `--dk-radius-*`, `--dk-shadow-focus`,
   `--dk-tracking-caps`.
2. Set `--dk-*` ONLY. Never declare a `--sl-*` variable (the base sheet bridges).
3. Inherit (do not re-declare): `--dk-space-*`, `--dk-width-*`, the `--dk-text-*`
   numeric scale, `--dk-leading-*`, `--dk-shadow-sm/md/lg` geometry.

**Files**: `src/themes/spec-kitty/tokens.css`.

**Validation**: the emitted stylesheet (after WP07 wires the example) declares the brand
values; a grep of `tokens.css` finds zero `--sl-` declarations.

**Edge cases**: the accent-as-link-text hue must shift by mode (dark `#F5C518` vs light
deep gold `#806508`) — that is the one place the hue changes per mode (T017).

### T017 — Mode-varying tokens under the brand dark selector

**Purpose**: Ensure every mode-varying token applies in both modes (the completeness
check in WP08 enumerates them).

**Steps**:
1. Declare the brand's light values on the base `:root`/light scope and re-declare the
   **mode-varying colour subset** under the brand's dark selector (Starlight's
   `[data-theme='dark']`).
2. The mode-varying subset is the colour tokens: `--dk-color-bg`, `-bg-nav`,
   `-bg-sidebar`, `-surface-1/-2/-inset`, `-border`, `-border-strong`, `-text`,
   `-text-strong`, `-text-muted`, `-text-accent`, `-text-invert`, `-accent-low/-/-high`,
   `-accent-text`, and each state token + its `-bg`.
3. Non-colour tokens (type, spacing, radius, widths, shadow geometry) are declared once.

**Files**: `src/themes/spec-kitty/tokens.css`.

**Validation**: WP08's mode-varying completeness assertion (each listed token re-declared
under the dark selector) passes; the site renders correctly in both modes.

**Edge cases**: a token declared only once (light) would silently apply in dark too —
the completeness check catches an omitted dark re-declaration.

### T018 — Self-contained assets (logo, favicon, fonts, diagram values)

**Purpose**: Carry the brand's assets as doc-kitty's own copies — no external coupling.

**Steps**:
1. Add `src/themes/spec-kitty/assets/`: `logo.webp` + `logo.png` fallback, `favicon`,
   the diagram token values (yellow subgraph/node borders, blue edges, card-dark fills)
   as doc-kitty's own copy — not `sk-mermaid-theme.yaml`.
2. Fonts: self-host `@font-face` for Falling Sky / Swansea; load JetBrains Mono via
   Google Fonts. Declare them in the theme's `assets.fonts` (never `@spec-kitty/tokens`).
3. Verify (grep the whole build later) nothing references `@spec-kitty/*`, the CDN, or
   the `spec-kitty-design` repo.

**Files**: `src/themes/spec-kitty/assets/**`, font `@font-face` (in `tokens.css` or a
sibling css the theme's `customCss` lists).

**Validation**: `grep -r "@spec-kitty" dist/` finds nothing after WP07's build; the logo
`<img>` renders; fonts load.

**Edge cases**: license/availability of self-hosted fonts — carry the files in-repo.

### T019 — Native `logo`/`title` header + active-nav accent

**Purpose**: Render the brand's non-negotiable logo-in-nav header without expanding the
components map.

**Steps**:
1. Ensure the theme's `assets.logo` forwards to Starlight's native `logo` config (WP02
   does the forwarding in `defineDocKittyIntegrations`); the wordmark renders via the
   site `title` in `--dk-font-display` weight 800 (brand CSS).
2. Add active-nav yellow accent + display-font wordmark styling as brand CSS (part of
   the theme's `customCss` or `tokens.css` sibling) targeting Starlight's header markup
   — no `Header`/`SiteTitle` component override (ADR-0015 decision 5).

**Files**: `src/themes/spec-kitty/` css; `assets`.

**Validation**: the built header shows the logo `<img>` + the wordmark; the Starlight
`components` map still has exactly four keys (WP08 asserts).

**Edge cases**: do NOT register a `Header` override — that breaks seam 3.

### T020 — AA contrast self-check, both modes

**Purpose**: Prove the palette meets WCAG 2.2 AA before the axe lane (WP09) runs.

**Steps**:
1. Compute/verify contrast for: body text on bg (both modes), muted text, the
   yellow-fill + dark-ink CTA pairing, each state text-on-tint pair, the light link
   deep-gold `#806508`, and the focus ring (light deep-gold variant + offset).
2. Record the derived light-column values and their measured ratios in a comment block
   in `tokens.css` (the derived column is the main review target).

**Files**: `src/themes/spec-kitty/tokens.css` (comment block).

**Validation**: documented ratios meet AA (≥4.5:1 text, ≥3:1 non-text/large); WP09's
axe `wcag22aa` run later reports 0 serious/critical.

**Edge cases**: yellow-on-paper as link text is ~1.3:1 — must derive down to deep gold
in light mode (do not use `#F5C518` as light link text).

## Branch Strategy

Planning and merge branch: `feat/component-system-and-theme`. This WP branches from its
dependency lane (WP01/WP02) per `lanes.json`; completed work merges back into
`feat/component-system-and-theme` unless the human redirects it.

## Definition of Done

- `specKittyTheme` is a valid `DocKittyTheme` extending the default; `astro check` clean.
- `tokens.css` declares the brand `--dk-*` subset, both modes, with the mode-varying
  colour subset re-declared under the dark selector; zero `--sl-` declarations.
- Assets are self-contained; `grep -r "@spec-kitty" dist/` (post-WP07 build) is empty.
- The header renders the logo + wordmark via native config; components map stays four.
- The derived light-column contrast ratios are documented and meet AA.

## Risks

- Importing or referencing `spec-kitty-design`/`@spec-kitty/*` — forbidden (C-005).
- Declaring `--sl-*` in the brand sheet — the bridge owns `--sl-*` (WP08 asserts zero).
- Omitting a dark re-declaration for a mode-varying token — WP08 completeness catches it.
- Using yellow as light-mode link text — fails AA; derive to deep gold.

## Reviewer Guidance

Focus on the **derived light column** (the guide is dark-only): re-check each derived
value's contrast. Confirm no `@spec-kitty/*`/CDN reference, no `--sl-*` in the brand
sheet, and that the header uses native `logo`/`title` (no `Header` override). Verify the
mode-varying subset is fully re-declared under the dark selector.
