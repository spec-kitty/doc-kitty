# Decision Moment `01M1R1VZWVEM0Y1CTXQXXE66Q0`

- **Mission:** `deck-layout-polish-01M1R1EB`
- **Origin flow:** `specify`
- **Slot key:** `specify.deck.style-separation`
- **Input key:** `deck_style_separation`
- **Status:** `resolved`
- **Created:** `2026-09-05T05:50:09.307652+00:00`
- **Resolved:** `2026-09-05T05:50:12.233377+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Should deck styling/theme be creatable and selectable separately from the docsite (Starlight) chrome?

## Options

- Yes: deck theme lives in the route-isolated deck sheet, independent of shared chrome tokens
- No: fold deck theming into the shared global token layer

## Final answer

Yes. The out-of-frame deck's theme/style mechanism (including its prefers-color-scheme dark-mode) is implemented in the route-isolated deck sheet(s) that only DeckLayout links — NOT in the shared global theme.css/chrome layer. In-frame Starlight chrome theming is untouched, and a consumer can create/select deck styles independently of docsite chrome. This is a first-class design constraint for the #65 deck-theme work.

## Rationale

_(none)_

## Change log

- `2026-09-05T05:50:09.307652+00:00` — opened
- `2026-09-05T05:50:12.233377+00:00` — resolved (final_answer="Yes. The out-of-frame deck's theme/style mechanism (including its prefers-color-scheme dark-mode) is implemented in the route-isolated deck sheet(s) that only DeckLayout links — NOT in the shared global theme.css/chrome layer. In-frame Starlight chrome theming is untouched, and a consumer can create/select deck styles independently of docsite chrome. This is a first-class design constraint for the #65 deck-theme work.")
