---
title: Diagrams render as clean figures, and component CSS survives branding
description: "Closes #59/#60/#68 — Mermaid diagrams no longer render as boxed code-cards, captions are styled, and branded sites ship styled callouts and diagrams on docs and decks."
doc_status: active
updated: 2026-09-04
type: Changelog
kind: Changelog
tags: [diagrams, theming, accessibility, css]
related:
  - adr/0036-diagram-figure-ownership
  - adr/0023-diagram-render-and-metadata-seam
  - adr/0022-reveal-integration-and-token-theme
---

# 2026-09-04 — Diagrams render as clean figures, and component CSS survives branding

**Diagrams look right now, and branded sites are no longer missing styling.**
Every Mermaid diagram on docs pages and decks renders as a plain, legible
figure with a styled caption — not boxed inside a scrollable, monospace
code-card. Sites that apply a brand theme now also receive styled callouts
and diagram figures, on both in-frame docs pages and out-of-frame slide
decks — previously they shipped unstyled.

## What changed

- **Diagrams no longer render inside a code-card box (#59).** Before: every
  Mermaid figure on every diagram page was wrapped in a stray outer `<pre>`,
  so it displayed inside a scrollable, monospace-bordered code-card, its
  caption did not wrap normally, and the wrapper was a spurious keyboard tab
  stop. After: the diagram markup is retyped at the source so the pipeline
  emits one clean `<pre class="mermaid">` element — the figure renders as a
  plain, non-boxed block, its caption in normal wrapping prose, with no extra
  tab stop. All 6 diagrams across the 3 affected pages are fixed; real code
  blocks are unaffected and keep their existing code-card styling.

- **Diagram captions are now styled (#60).** Before: the figure caption
  markup existed but the stylesheet it depended on was never written, so
  captions rendered at the browser's plain default text everywhere. After: a
  new stylesheet styles the caption as legible, wrapping, muted, non-monospace
  text, matching the rest of the site's typography — on both the docs shell
  and the deck shell.

- **Branded sites now ship styled callouts and diagram figures (#68).**
  Before: a site with an active brand theme silently lost its global
  component styling — a branded docs page that rendered a Markua callout (or,
  going forward, a diagram figure) showed unstyled default markup, because
  brand theming replaces the base stylesheet outright rather than layering
  onto it. After: component styling for callouts and diagrams now lives in
  its own dedicated stylesheet that survives brand theming, and is linked
  directly from the deck layout — so both branded docs pages and slide decks
  now render fully styled callouts and diagrams.

## For contributors

- **`pnpm clean` added.** Astro's content-layer cache lives under
  `example/node_modules/.astro`, which `rm -rf example/.astro example/dist` does
  not reach — a stale entry can serve pre-change diagram HTML locally and fake a
  "still broken" result. Run `pnpm clean` for a true rebuild. CI is unaffected
  (that cache is never shared across jobs).

## Why it matters

Readers no longer see diagrams that look broken or unfinished, and operators
who apply a brand theme no longer lose component styling they never touched.
The three previously-shipped defects were symptoms of one gap: no layer of
the diagram pipeline stated who owned the figure's markup versus its
presentation. [ADR-0036](../adr/0036-diagram-figure-ownership.md) makes that
contract explicit going forward. No runtime dependency was added, upgraded, or
removed; three build-time packages already present transitively were pinned as
explicit devDependencies for a new test (no new resolution or download).
