---
title: "ADR-0040: Build-time diagram render (Mermaid + PlantUML), dual-mode"
description: Pre-render Mermaid and PlantUML to static, themed, accessible SVG at build, with a client-render fallback and a CSS-variable theming rewrite.
doc_status: active
updated: 2026-09-07
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0023-diagram-render-and-metadata-seam
  - adr/0024-diagram-token-promotion-and-brand-wiring
  - architecture/diagrams
---

# ADR-0040: Build-time diagram render (Mermaid + PlantUML), dual-mode

## Status

**Accepted** — 2026-09-07. Delivered by the diagram-build-render mission
(issue #13), the deferred follow-up to the M5 client-side Mermaid slice
([ADR-0023](0023-diagram-render-and-metadata-seam.md)).

## Context

M5 shipped Mermaid rendered **client-side**: the browser downloads the Mermaid
runtime and renders each `pre.mermaid` at page load (ADR-0023). That keeps the
build infra-light but ships a diagram runtime to every reader, needs JavaScript,
and cannot render PlantUML (which has no browser renderer). #13 asked to move the
render to **build time** for **both** engines — static, self-contained,
theme-aware, accessible SVG, no diagram runtime at read time — while keeping the
`%%`/`'` metadata design, the six `--dk-diagram-*` tokens, and the accessible
`<figure>` treatment ADR-0023/0024 established.

Two constraints shaped the design. Adopters build in varied environments, some
without a headless browser; and the existing diagram gates encode the *client*
invariant (browser-free HTML, a Mermaid runtime chunk that ships).

## Decision

1. **Dual-mode.** A resolved, gate-observable flag (`DK_DIAGRAM_BUILD_RENDER`,
   else auto-detect a resolvable Playwright Chromium) selects **build** or
   **client** render per build. Build mode pre-renders; when Chromium is
   unavailable the build falls back to the unchanged client path, so `pnpm build`
   never hard-fails for lack of a browser. Client-mode Mermaid output stays
   byte-identical to pre-#13.
2. **Mermaid** build-renders via `@beoe/rehype-mermaid` (Playwright/Chromium);
   **PlantUML** via `astro-plantuml` against a **self-hosted** server — never
   `plantuml.com`, which would upload diagram source off-site (the resolver
   throws on any such URL). Both are exact-pinned golden-file deps.
3. **Theme without JavaScript — a CSS-variable rewrite.** Each engine is handed
   the six token colours as distinct **sentinels** (Mermaid `themeVariables`,
   PlantUML `skinparam`); a rehype pass rewrites every sentinel in the emitted
   SVG to `var(--dk-diagram-*)`. A `[data-theme]` toggle then re-themes the static
   SVG by pure CSS, with no re-render and no script.
4. **Accessibility preserved.** The `%%`/`'` metadata injects the accessible name
   into the SVG (`<title>`/`<desc>`), and the shared `diagram-figure` wraps the
   SVG in the same `<figure role="group" aria-labelledby>` + `<figcaption>` as the
   client path.
5. **Gates are mode-aware, never weakened.** Each diagram gate branches on the
   resolved mode: build asserts an inline `<svg>` with the accessible name,
   `var(--dk-diagram-*)` fills, no un-themed chromatic hex, and no runtime chunk;
   client keeps the pre-#13 assertions.
6. **CI + deploy** build-render both engines (Chromium in the shared build
   composite; a self-hosted PlantUML `services:` container), with a disk cache so
   an unchanged diagram never relaunches the engines.

## Consequences

### Positive

- Readers get JS-light, offline-safe, SEO-friendly, CSP-clean diagrams; no
  diagram runtime ships in build mode. PlantUML is supported for the first time.
- The theme toggle stays pure-CSS on a static SVG, so the six-token contract and
  its contrast guarantees carry over unchanged.

### Negative

- Build mode needs a headless browser (Mermaid) and a PlantUML server; CI/deploy
  gained that infra. Adopters without them get the client fallback (Mermaid) and
  a plain code fence (PlantUML, which is build-only).
- Three pinned render dependencies were added.

### Risks

- Engine SVG bytes are golden; an engine bump is a deliberate, pinned regen (the
  cache key includes the lockfile so a bump cannot serve a stale cache).
- A build render error fails the build loudly rather than emitting a broken figure.

## Alternatives considered

### Build-only (drop the client render)

Smaller surface and exactly #13's headline, but forces every adopter build to
have Chromium. Rejected for dual-mode, which keeps the toolkit adoptable on
constrained build envs.

### `@beoe` selector-based dark mode (emit both palettes)

Doubles the SVG bytes and breaks the single-token-source contract. Rejected in
favour of the CSS-variable rewrite, which preserves the exact `--dk-diagram-*`
contract.

## References

- Issue #13; ADR-0023 (client render + metadata seam); ADR-0024 (token promotion).
- `src/lib/config.ts` (mode seam, sentinel table, rewrite, engine wiring),
  `src/lib/diagram/beoe-cache.ts`, `src/lib/remark/plantuml-meta.*`,
  `src/lib/rehype/diagram-figure.ts`.
