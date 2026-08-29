# Contract: Deck chrome and metadata (#12)

Behavioural contract for the deck's title-slide metadata, footer chrome, and theme
application. Assertion targets for the FR-008 behaviour tests in
`tests/a11y/deck.interaction.spec.ts` (plus the FR-002 unit assertion in
`src/tests/deck-split.test.ts`). Covers FR-001, FR-002, FR-003, NFR-003, SC-001,
SC-002.

Surfaces: `src/lib/remark/deck-split.internal.ts` (`titleChildren`),
`src/layouts/DeckLayout.astro` (footer element + head link order),
`src/styles/dk-reveal-theme.css` (theme look rules + footer styling).

---

## C1 — Title-slide metadata suppression (FR-002 / SC-002)

**Inputs**: a published deck whose front-matter carries a non-empty `description`.

**Guaranteed behaviour**:
- The front-matter `description` value appears in the document `<head>` as
  `<meta name="description" content="…">`.
- The `description` value does NOT appear as visible text in ANY slide `<section>`
  body — in particular not on the synthesized title slide.
- The title slide still renders its `title` `<h1>` (and `hero_image` / authored
  pre-`##` content). ADR-0012 FR-003 ("always emit a titled slide") stays
  satisfied.

**Invariant**: the description is page metadata only. The suppression is at the
transform (`titleChildren` no longer synthesizes a description paragraph), so the
description is also absent from the no-JS SSR body and from the Pagefind-indexed
`.slides` region.

**Assertions**:
- Unit (`deck-split.test.ts`): `splitDeck` on a deck with a `description` produces a
  title slide whose children do NOT include a paragraph equal to the description.
- Playwright: on the live deck, the `description` string is present in
  `head meta[name="description"]` and absent from `.slides` text content.

## C2 — Footer / bottom-banner chrome (FR-003 / SC-001)

**Inputs**: any slide of a published deck.

**Guaranteed behaviour**:
- A `<footer class="dk-deck-footer">` element exists (sibling of `main.reveal`), is
  rendered, and has a non-zero bounding box.
- It is positioned at the bottom of the frame and remains visible on every slide
  (it is outside `.slides`, so it is not re-rendered per slide and does not enter
  reveal's slide DOM).
- It does not overlap or displace the existing `nav.dk-deck-controls` (fixed
  bottom-right).

**Invariant**: a single `contentinfo` landmark; it does not disturb the accessible
slide-name logic or the transform's `<section>` output the axe spec asserts
(NFR-004).

**Assertions (strengthened — finding C5, non-fakeable)**:
- Playwright: `.dk-deck-footer` `toBeVisible()` (not merely present) AND has a
  non-empty `textContent` that CONTAINS `entry.data.title` (an empty/hidden footer
  must FAIL) AND its top edge is near the frame bottom (geometry) AND it stays
  visible after navigating to slide 2+.

## C3 — Deck theme applied (FR-001 / SC-001 / NFR-003)

**Inputs**: the deck route loads and reveal enhances it.

**Guaranteed behaviour**:
- The reveal reset/core sheets, the base `--dk-*` catalog (`theme.css`), the brand
  token layer, and `dk-reveal-theme.css` are linked in the deck `<head>` in that
  load-bearing order, and take effect (branded background/colours/typography, not
  reveal's raw `#000/#fff` fallback).
- The theme look rules are developed enough that the example deck is presentable:
  the hero image is constrained to the stage, slide content is spaced/legible, and
  the footer band is styled.

**Invariant (NFR-003)**: every reveal/deck stylesheet is linked only from the deck
document (route-scoped `?url` assets); 0 reveal core-CSS rules leak onto non-deck
documentation pages.

**Assertions (FR-001 promoted into the FR-008 locked set — finding C6; computed
style, NO screenshots, respects C-001)**. Each resolved token is read from `:root`
in the SAME `page.evaluate` and compared to the observed value — never a weak
"≠ #000":
- viewport `backgroundColor` EQUALS the resolved `--dk-color-bg`;
- the active-slide heading `color` EQUALS the resolved text-strong token
  (`--dk-color-text-strong`);
- `.reveal` `font-family` CONTAINS the brand sans (`--dk-font-sans`);
- `.dk-deck-footer` background resolves to a brand surface token
  (e.g. `--dk-color-surface-1`);
- the title-slide `img` height is ≤ the reveal stage height (the R4 "hero
  overflow" gap).
- The non-leak invariant (NFR-003) is covered by the existing route-scoping design
  and the BA-4 chrome asserts on non-deck pages; this mission adds no global
  stylesheet and puts deck look-rules ONLY in `dk-reveal-theme.css`, never
  `theme.css` (finding E1).

**R4 re-confirmation caveat (finding C6)**: `deck.interaction.spec.ts:237-239`
comments that the deck is "currently unthemed (transparent viewport, UA-default
text)". If that is STILL true with `dk-reveal-theme.css` linked, the root cause is
token-map NON-RESOLUTION (the `--dk-*→--r-*` map not seeing its inputs), not merely
"underdeveloped look rules" — a different fix. Empirically confirm which it is
against the built deck BEFORE writing FR-001 assertions, so the computed-style
targets reflect the real mechanism.

No visual/a11y snapshot baseline is added or regenerated (C-001).
