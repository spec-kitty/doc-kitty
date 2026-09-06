# Decision Moment `01M1V8ZYHJYYVGY438PB166WAX`

- **Mission:** `glossary-a11y-followups-01M1V8Y9`
- **Origin flow:** `specify`
- **Slot key:** `specify.a11y.term-affordance-mechanism`
- **Input key:** `term_affordance_mechanism`
- **Status:** `resolved`
- **Created:** `2026-09-06T11:52:22.322990+00:00`
- **Resolved:** `2026-09-06T12:04:26.211633+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How should a glossary term link be made distinguishable from an ordinary link for assistive technology (SSR/no-JS, single shared builder)?

## Options

- aria-label composed from link text (attribute; no textContent pollution)
- visually-hidden text child (span.dk-visually-hidden)
- aria-roledescription on the anchor
- Other

## Final answer

aria-label composed from the link's visible text + ', glossary term' — an attribute on the shared builder, so both emitters stay byte-identical and the textContent-based links-used re-derive is untouched; SSR/no-JS-safe.

## Rationale

_(none)_

## Change log

- `2026-09-06T11:52:22.322990+00:00` — opened
- `2026-09-06T12:04:26.211633+00:00` — resolved (final_answer="aria-label composed from the link's visible text + ', glossary term' — an attribute on the shared builder, so both emitters stay byte-identical and the textContent-based links-used re-derive is untouched; SSR/no-JS-safe.")
