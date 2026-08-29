# Decision Moment `01M14N6A5NPZW8ZYGCT8JVVYWD`

- **Mission:** `reveal-deck-remediation-01M14N38`
- **Origin flow:** `specify`
- **Slot key:** `specify.verification.regression-rigor`
- **Input key:** `verification_regression_rigor`
- **Status:** `resolved`
- **Created:** `2026-08-28T17:03:01.813231+00:00`
- **Resolved:** `2026-08-28T17:24:55.786193+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How should the deck rendering fixes (#12/#15) be verified and locked against regression?

## Options

- Automated regression coverage on deck route + hub (extend Playwright deck.interaction spec + a11y visual baselines)
- Manual visual acceptance on the built example only
- Automated DOM/behavior assertions but no new visual baselines

## Final answer

Add automated Playwright DOM/behavior assertions to lock the fixes (deck footer present; no front-matter description leaking onto the title slide; exactly one <svg> per diagram; a slide-2+ diagram renders to non-zero-box SVG after slidechanged), but do NOT regenerate or add visual/a11y baselines. Visual/CSS correctness is judged by manual review on the built example. Keeps the a11y baseline set stable.

## Rationale

_(none)_

## Change log

- `2026-08-28T17:03:01.813231+00:00` — opened
- `2026-08-28T17:24:55.786193+00:00` — resolved (final_answer="Add automated Playwright DOM/behavior assertions to lock the fixes (deck footer present; no front-matter description leaking onto the title slide; exactly one <svg> per diagram; a slide-2+ diagram renders to non-zero-box SVG after slidechanged), but do NOT regenerate or add visual/a11y baselines. Visual/CSS correctness is judged by manual review on the built example. Keeps the a11y baseline set stable.")
