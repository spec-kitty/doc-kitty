# Contract — Deck colour-scheme theme + legible demo slide (#65)

Observable behavior (mechanism-agnostic; satisfied by research D-01…D-03).

## C-DECK-THEME-1 — Deck follows colour scheme
- **Given** the out-of-frame deck route (`presentations/*`),
- **When** the viewer's `prefers-color-scheme` is `dark`,
- **Then** the deck renders with the dark `--dk-*` palette (dark background, light text);
  **and when** it is `light` (or unset), the deck renders with the light palette.
- **Isolation**: the mechanism lives only in the deck-linked sheet(s). An in-frame
  documentation page's theming (Starlight Light/Dark/Auto) is byte-unchanged — verified by
  the a11y gate staying green and an in-frame page rendering identically to `main` under a
  fixed chrome theme.

## C-DECK-THEME-2 — Single-source dark palette (parity guard)
- The deck's `@media (prefers-color-scheme: dark)` `--dk-color-*` values are identical to
  `theme.css`'s `:root[data-theme='dark']` `--dk-color-*` values.
- **Test**: `src/tests/deck-theme-parity.test.ts` parses both and fails on any diff.

## C-DECK-THEME-3 — Demo slide legible in both schemes
- **Given** the showcase deck's demo background slide,
- **Then** its body text, heading, and fragment list achieve ≥ 4.5:1 contrast against the
  rendered slide background in BOTH light and dark viewer preferences.
- **And** the slide still demonstrates a real slide background directive (a non-default
  background is visibly applied).
- **And** `showcase-deck.md` contains no raw `#101828` (or any raw hex) in a
  `data-background-color` directive — asserted by the parity test's source scan.
- **Verification**: AFTER pixel pass captures the demo slide in `colorScheme: 'light'` and
  `'dark'`; both legible (contrast reasoned from the token pair + visually confirmed).
