# Quickstart: Verifying the reveal-deck remediation

How a maintainer confirms the #12/#15 fixes locally and in CI. Behaviour/DOM
verification only — no visual/a11y snapshot baselines are added or regenerated
(C-001). Node 22+, pnpm 11; commands run from the repo root.

> Local env hazard: if `pnpm` gates fail on a root-owned / half-materialized
> `node_modules`, that is the known environment issue — CI (the
> `mcr.microsoft.com/playwright:v1.62.1-noble` container) is the authoritative
> verifier. Verify source edits by reading them and `node --check` where relevant.

---

## 1. Build the example site

```
pnpm build            # pnpm --filter example build → example/dist
pnpm assert:artifacts # asserts the generated build artifacts
```

Confirm the deck route is emitted at `example/dist/<deck-slug>/index.html`
(byte-identical slug to the collection entry — the out-of-frame route shadows
Starlight for `/presentations/*` only).

## 2. Preview and eyeball a deck (US1 — #12)

```
pnpm preview          # serves example/dist
```

Open the showcase deck route. Verify by eye:

- **Theme applied (FR-001)**: branded colours/typography, not the raw unstyled
  reveal fallback; no persistent unstyled flash.
- **No stray description (FR-002)**: the title slide shows its `title` heading (and
  hero image / authored intro), and the front-matter `description` sentence does
  NOT appear as slide body text. Confirm it IS still in the page source as
  `<meta name="description">` (View Source / DevTools `<head>`).
- **Footer present (FR-003)**: `.dk-deck-footer` is visible at the bottom of the
  frame on the title slide and stays visible as you navigate.

## 3. Verify slide-scoped diagrams (US2 — #15)

In the same preview, on the deck that has a diagram on a **non-first** slide
(the FR-004 example target added to `example/docs/presentations/showcase-deck.md`):

- Navigate to that slide (arrow/space, or the labelled nav buttons). The diagram
  renders to a visible, correctly-sized figure — not a blank or zero-height box
  (NFR-001).
- Navigate away and back: the diagram is still there and there is exactly ONE
  `<svg>` for it (DevTools: the `pre.mermaid` node contains a single `<svg>`) —
  no duplicate, no blank re-render (FR-005).
- Toggle light/dark: the diagram re-renders in the new palette, still one `<svg>`.
- Open the deck with `?print-pdf`: every slide is laid out at once and every
  diagram is rendered (so an exported PDF is complete).
- Open a diagram-free deck (e.g. the draft preview) and confirm in DevTools →
  Network that no Mermaid chunk is requested (NFR-002 footprint guard).

## 4. Verify the hub guidance (US3 — #12 QOL)

Open the presentations hub (`/presentations/`). Confirm the instructional banner:

- states what the web-hosted decks are for (FR-006);
- has a "How to use" section covering vertical-slide navigation, reveal hotkeys
  (`Esc` overview, `S` speaker notes, `F` fullscreen, arrows/space), and PDF export
  via the browser print dialog including enabling "Background graphics" (FR-007);
- each deck still lists its `?print-pdf` export link (unchanged).

## 5. Run the automated gates

```
pnpm test             # Vitest unit tests — includes the updated deck-split.test.ts (FR-002)
pnpm test:a11y        # Playwright a11y + deck interaction lane
```

The deck interaction spec (`tests/a11y/deck.interaction.spec.ts`) now asserts the
FR-002/FR-003/FR-004/FR-005 behaviour (see `contracts/`). The existing axe lane
(`axe.spec.ts`) and the reduced-motion / keyboard / no-JS checks must stay green
(NFR-004, SC-005). No snapshot baselines are updated.

To run just the deck interaction spec:

```
pnpm exec playwright test tests/a11y/deck.interaction.spec.ts
```

## 6. Done-when (maps to Success Criteria)

- [ ] SC-001 — every example-deck slide renders themed with a visible footer.
- [ ] SC-002 — the title slide shows 0 stray metadata lines; `description` is
      metadata only.
- [ ] SC-003 — every diagram renders to a correctly-sized figure regardless of
      slide position; a slide-2+ diagram is no longer blank; exactly one `<svg>`
      each.
- [ ] SC-004 — the hub documents vertical navigation, overview/speaker hotkeys,
      and PDF export.
- [ ] SC-005 — unit tests, a11y lane, and deck interaction spec are green,
      including the new FR-002/003/004/005 assertions.
