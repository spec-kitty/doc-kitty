---
title: "ADR-0022: reveal.js integration — pinned 6.0.1, core+Notes, browser-only init, --dk-* token theme"
description: How doc-kitty vendors and initializes reveal.js for the deck route, and how the deck is themed by mapping --dk-* tokens onto reveal's --r-* variables scoped to .reveal.
doc_status: active
updated: 2026-08-24
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0012-slide-decks-static-reveal-from-markdown
  - adr/0021-deck-routing-seam-out-of-frame-override
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - architecture/slide-decks
---

# ADR-0022: reveal.js integration — pinned 6.0.1, core+Notes, browser-only init, `--dk-*` token theme

## Status

Accepted. Specifies the reveal integration and theming left open by
[ADR-0012](./0012-slide-decks-static-reveal-from-markdown.md) ("self-contained
reveal.js... bundled at build" and "themed through `--dk-*` tokens"), and resolves the
`architecture/slide-decks.md` Open Questions on the reveal version pin and the token
mapping. Paired with [ADR-0021](./0021-deck-routing-seam-out-of-frame-override.md) (the
route this integration renders into).

## Context

ADR-0012 decided reveal is a self-hosted dependency bundled at build (never a CDN) that
**enhances** server-rendered slide DOM. It left unspecified: which reveal version and
plugins, how reveal is initialized without breaking the static SSG build, and the exact
`--dk-*` → reveal-variable mapping surface. reveal touches `document`/`window` at import,
and its core stylesheet reflows the viewport (`html, body { height:100%; overflow:hidden }`),
so both the JS init and the CSS need deliberate confinement.

## Decision

1. **Pin `reveal.js@6.0.1` as a self-hosted npm dependency.** v6 is Vite-native: ESM
   `.mjs` build, `exports`-resolved bare specifiers, CSS at `reveal.js/reveal.css`
   (no `dist/` prefix), and **bundled TypeScript types** — so `@types/reveal.js` is
   **not** added (and is removed if a tool pulls it in; it would shadow the real types).
   Vite bundles reveal into hashed assets — CSP-clean, offline, no CDN.
2. **Plugin set is core + Notes only.** The **Notes** plugin activates speaker view and
   the `<aside class="notes">` asides. The **Markdown** plugin is never used (ADR-0012
   Option A — slides are pre-rendered at build). The **Highlight** plugin is excluded:
   Astro/Shiki already highlights code at build into static `<pre>`; reveal's highlight
   would double-process for no gain. Math/Zoom/Search/multiplex are deferred.
3. **reveal is initialized from a browser-only dynamic import (SSR-safe).** On the
   `prerender = true` deck route, reveal is imported and initialized **only** inside a
   client `<script>` (`import('.../reveal-init.client.ts')`), never at the top level of
   server-rendered `.astro` code — a top-level `import Reveal` pulls a DOM-dependent
   module into the SSG Node run and crashes `astro build`. reveal enhances the existing
   `.reveal > .slides > section` DOM; it never produces the slides. Because directive
   attributes are baked into the static HTML before any JS runs, the build is immune to
   reveal's Vite/Rolldown directive-ordering hazard (reveal issue #3883).
4. **The deck is themed by a `--dk-*` → `--r-*` mapping declared at `:root`.** reveal 6
   exposes its theme as `--r-*` custom properties; the doc-kitty reveal theme is a thin
   sheet expressing `--r-*` as `var(--dk-*)` (background/text/heading/link colors,
   body/heading fonts, sizing incl. the existing `--dk-width-deck`). The mapping is
   declared at **`:root`**, not `.reveal`: reveal paints `--r-background-color` on
   `document.body` (an ancestor of `.reveal`), so a `.reveal`-scoped map would never
   reach the viewport background. The out-of-frame route also receives no global token
   injection, so the deck layout links the resolved `--dk-*` catalog itself (base +
   brand) ahead of the map. The same file works for every brand (incl. Spec Kitty dark)
   with no per-deck CSS. A per-file `deck:` frontmatter theme override is **deferred**.
5. **reveal's CSS is confined to the deck route.** reveal's **core** stylesheet and the
   token-mapping sheet are imported **only** by the deck layout — never a global style,
   never hoisted into a shared chunk a documentation page links. Because the map is
   declared at `:root` (Decision 4), **route-import isolation is the sole guard** that
   keeps it (and reveal's viewport-hijacking core sheet) off doc pages — there is no
   selector-scope safety net, so the import must never be made global. A build assertion
   over `example/dist` enforces this: each sheet appears in exactly one emitted asset,
   linked on the deck page and on no sampled doc page (reveal's core sheet identified by
   a known signature). The deck theme's own *look* rules stay `.reveal`-scoped.
6. **Print/PDF is a bundled, query-gated import.** reveal's print stylesheet is imported
   as a bundled asset gated on `?print-pdf` (not reveal's path-based loader, which cannot
   resolve under Vite); the linear fallback is the printable baseline.

## Consequences

### Positive

- One pinned dependency line; the reveal engine, theme, and version live in exactly one
  place. Decks inherit the active brand for free through the token catalog.
- SSR-safety and CSS isolation are explicit contracts with build assertions, not hopes.

### Negative

- The `--dk-*` → `--r-*` mapping is a maintenance surface on a reveal major upgrade (the
  `--r-*` names could change). Mitigated by keeping the mapping a single small sheet.

### Risks

- **Upgrade drift.** A reveal upgrade may move export paths (v6 already moved CSS off
  `dist/`) or rename `--r-*` variables. Any upgrade requires a **smoke check of the deck
  route and the token mapping**, plus the a11y and print paths; the version stays pinned
  until that check passes.

## Alternatives considered

### Option A: reveal's client-side Markdown plugin

Rejected (ADR-0012 Option A). Runtime parsing yields empty initial HTML — worse a11y,
SEO, no-JS, and print — and is the anti-pattern the discovery run flagged.

### Option B: A full reveal theme fork (SCSS) instead of a token-mapping sheet

Rejected. reveal 6's `--r-*` variables make a thin mapping sufficient; forking a theme
multiplies the upgrade maintenance surface for no gain.

### Option C: reveal's Highlight plugin for code

Rejected. Astro/Shiki already produces static, highlighted `<pre>` at build; adding
reveal's highlight double-processes and ships highlight.js + a CSS theme unnecessarily.

## References

- [ADR-0012](./0012-slide-decks-static-reveal-from-markdown.md),
  [ADR-0021](./0021-deck-routing-seam-out-of-frame-override.md),
  [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md).
- [Slide decks](../architecture/slide-decks.md).
- reveal.js 6.0.1 (npm), reveal upgrade notes (v6 breaking changes), reveal issue #3883
  (Vite/Rolldown directive-ordering, avoided by build-time pre-render).
