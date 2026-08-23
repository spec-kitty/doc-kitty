---
title: Component system and swappable theme
description: The three-layer theme, the merged manifest, the Spec Kitty brand, the Persona layout, and the accessibility lane (M2).
doc_status: active
updated: 2026-08-23
type: Changelog
kind: Changelog
tags: [theming, components, accessibility, brand]
related:
  - architecture/theming
  - architecture/theming-spec-kitty-brand
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - adr/0016-accent-text-bridge-correction
---

# 2026-08-23 — Component system and swappable theme (M2)

Mission M2 grows the M1 single-layer chrome substrate
([ADR-0013](../adr/0013-m1-chrome-substrate-single-layer.md)) into the complete
theme layer: a consumer selects a theme and rebrands the docsite without forking.
It ships the first real brand end-to-end and the accessibility harness that keeps
every theme conformant.

- **Swappable theme layer** — `defineDocKittyIntegrations({ theme })` gains an
  optional theme and merges `default → brand → consumer` (per-key last-wins;
  `customCss` concatenates; `tokens` shallow-merge). The M1 `(options)` call keeps
  working byte-for-byte (no theme → the single static token sheet, unchanged
  rendering).
- **Merged virtual manifest** — an Astro integration codegens
  `virtual:doc-kitty/manifest`, replacing the static `kind → layout` module at the
  **single** `MarkdownContent` import site with a synchronous `resolveLayout`, and
  exposing per-carrier `dk:` slot overrides. Layouts resolve at that one site; slots
  resolve per-carrier; the Starlight `components` map stays exactly the four
  carriers. See [ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md).
- **Spec Kitty brand theme** — the first brand, self-contained and derived (its own
  `--dk-*` values, atomic components, and self-authored logo/favicon; no dependency
  on `spec-kitty-design`). It renders in both light and dark at WCAG 2.2 AA, with
  the logo-in-nav header on Starlight-native config. See
  [the brand theme](../architecture/theming-spec-kitty-brand.md).
- **Persona per-kind layout** — the passport shell (identity strip, `<dl>` of
  generic frontmatter, avatar) resolved through the manifest, proving per-kind-layout
  override with a second bespoke layout beside `Hub`. Persona authoring and the
  audience/related/reference blocks remain M3.
- **Accessibility lane** — a Playwright + axe-core lane runs `wcag22aa` across the
  Persona, Hub, and prose pages in both modes, a required member of `ci-ok`. It
  caught a real dark-mode contrast failure on its first run (the site title bridged
  to the ink-on-fill token), fixed in
  [ADR-0016](../adr/0016-accent-text-bridge-correction.md).
- **Gates** — the M1 non-fakeable chrome and build-artifact assertions stay green
  under the brand, extended with non-fakeable checks for the Persona marker, the
  cascade order, mode-varying token completeness, the four-carrier invariant, and
  the brand's target-size/focus construction.
