---
title: "ADR-0024: Promote --dk-diagram-* to the Default catalog and the brand layer, retire the orphan"
description: The diagram tokens move from an orphan brand asset into the Default catalog and the brand tokens.css, so both vanilla and branded sites theme diagrams in both modes.
doc_status: active
updated: 2026-08-25
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - plans/features/diagrams
  - adr/0023-diagram-render-and-metadata-seam
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - architecture/theming
---

# ADR-0024: Promote `--dk-diagram-*` to the Default catalog and the brand layer, retire the orphan

## Status

Accepted. Paired with [ADR-0023](./0023-diagram-render-and-metadata-seam.md) (the render
owner that consumes these tokens). Extends the theme layer (ADR-0008/0011).

## Context

M2 shipped the Spec Kitty brand's diagram colours as
`src/themes/spec-kitty/assets/diagram-tokens.css` — six `--dk-diagram-*` custom properties
(node fill/border/text, edge, subgraph-title, cluster) — but it is an **orphan**: imported
nowhere, **dark-valued only**, and **not** in the Default catalog (`DEFAULT_BASE` in
`src/lib/theme.ts` / `src/styles/theme.css`) nor in the brand token layer
(`src/themes/spec-kitty/tokens.css`).

ADR-0023's render owner reads `--dk-diagram-*` off `:root` into Mermaid's `themeVariables`.
So the tokens must actually be **in scope** on every rendered page, in both modes, on a
vanilla site *and* the branded example — otherwise a diagram renders unthemed. Promoting
only to the Default catalog would leave the **branded** example/deck rendering the neutral
default (the brand's yellow/blue motif lives only in the orphan), failing the very
demonstrator meant to prove brand theming (SC-004). And the orphan being a second, unwired
copy is a source-of-truth hazard.

## Decision

1. **Promote `--dk-diagram-*` into the Default catalog, with light-mode values.** Add the
   token set to `DEFAULT_BASE`/`DEFAULT_DARK` (`theme.ts`), to `theme.css`'s `:root` and
   `:root[data-theme='dark']`, and to `emitTokenSheet`'s mode-varying set — the four
   catalog call-sites — inventing **light-mode** values (legible node fill/text/edge for a
   light background) alongside the existing dark values. A vanilla site is now diagram-themed
   in both modes.
2. **Wire the brand motif into the brand token layer.** Move the Spec Kitty diagram values
   into `src/themes/spec-kitty/tokens.css` (the brand's `:root` / `:root[data-theme='dark']`
   blocks) so they flow through `resolveTheme` into the emitted brand sheet **and** the
   deck's existing `brandTokensHref` link — the branded example and the deck render the
   brand motif with no new wiring.
3. **Retire the orphan.** Delete `src/themes/spec-kitty/assets/diagram-tokens.css` once its
   values live in `tokens.css` — one source of truth for the brand's diagram colours.
4. **The token → Mermaid `themeVariables` map is fixed** (consumed by ADR-0023's render
   owner): `node-fill` → `primaryColor`/`mainBkg`/`edgeLabelBackground`; `node-border` →
   `primaryBorderColor`/`nodeBorder`/`clusterBorder`; `node-text` → `primaryTextColor`/
   `nodeTextColor`; `edge` → `lineColor`; `subgraph-title` → `titleColor`; `cluster-fill` →
   `clusterBkg`.
5. **Contrast is proven where authored.** A vitest computes the WCAG ratio of the promoted
   `--dk-diagram-*` pairs (node text on node fill; edge / subgraph title against cluster
   fill) and asserts AA (size-aware) in **both** modes — at foundation, not two groups later
   in the Playwright lane (axe does not evaluate SVG contrast).

## Consequences

### Positive

- Diagrams are themed by construction on any site, both modes; the branded example proves
  the brand motif; one source of truth for the brand's diagram colours.
- The deck inherits the tokens through the link it already emits — no deck-specific token
  work (ADR-0023 D4).

### Negative

- Inventing legible light-mode diagram values is a small design task; the contrast vitest
  is the guard.
- Four catalog call-sites plus the brand layer must stay in sync (the existing token
  discipline; the CSS-signature/catalog build assertion is updated alongside).

### Risks

- A wrong light value only shows as a contrast failure; the foundation vitest (Decision 5)
  catches it where it is introduced rather than in the a11y lane.

## Alternatives considered

### Promote only to the Default catalog

Rejected. It leaves the branded example/deck rendering neutral-default diagrams, failing
SC-004 on the demonstrator that is supposed to prove brand theming.

### Keep the orphan and import it globally

Rejected. It keeps a second source of truth for the brand's diagram colours and doesn't
give a vanilla site any diagram tokens.

## References

- [ADR-0023](./0023-diagram-render-and-metadata-seam.md),
  [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0008](./0008-swappable-theme-layer.md).
- `src/lib/theme.ts` (`DEFAULT_BASE`/`emitTokenSheet`), `src/styles/theme.css`,
  `src/themes/spec-kitty/tokens.css`, `src/themes/spec-kitty/assets/diagram-tokens.css`
  (retired).
