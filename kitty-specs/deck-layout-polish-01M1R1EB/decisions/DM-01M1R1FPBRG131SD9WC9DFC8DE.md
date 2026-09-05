# Decision Moment `01M1R1FPBRG131SD9WC9DFC8DE`

- **Mission:** `deck-layout-polish-01M1R1EB`
- **Origin flow:** `specify`
- **Slot key:** `specify.deck.contrast-fix`
- **Input key:** `deck_contrast_fix`
- **Status:** `resolved`
- **Created:** `2026-09-05T05:43:26.328067+00:00`
- **Resolved:** `2026-09-05T05:49:41.818832+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

For #65, how should the demo background slide be made legible against the deck's (always-light) text?

## Options

- Use a light brand surface token as the demo background (theme-consistent, legible)
- Keep a dark background but pair a hardcoded light foreground on that slide
- Add a real dark-mode mechanism to the deck (larger scope)

## Final answer

Add a real theme mechanism to the out-of-frame deck (follow prefers-color-scheme, reusing the existing dark --dk-* catalog) WITHOUT regressing in-frame Starlight theming or the a11y gates; AND change showcase-deck.md's hardcoded data-background-color=#101828 to a theme-flipping brand surface token so the demo slide is legible in BOTH light and dark. Both parts are required: dark-mode alone leaves the navy hardcode failing for light-preference viewers.

## Rationale

_(none)_

## Change log

- `2026-09-05T05:43:26.328067+00:00` — opened
- `2026-09-05T05:49:41.818832+00:00` — resolved (final_answer="Add a real theme mechanism to the out-of-frame deck (follow prefers-color-scheme, reusing the existing dark --dk-* catalog) WITHOUT regressing in-frame Starlight theming or the a11y gates; AND change showcase-deck.md's hardcoded data-background-color=#101828 to a theme-flipping brand surface token so the demo slide is legible in BOTH light and dark. Both parts are required: dark-mode alone leaves the navy hardcode failing for light-preference viewers.")
