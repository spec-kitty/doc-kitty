# Decision Moment `01M59CQM76Q0NJ3F3GM1S8BYAN`

- **Mission:** `gherkin-authoring-aids-01M59A5E`
- **Origin flow:** `plan`
- **Slot key:** `plan.layout.results-summary-placement`
- **Input key:** `card_results_summary`
- **Status:** `resolved`
- **Created:** `2026-10-19T06:14:11.431021+00:00`
- **Resolved:** `2026-10-19T06:26:34.146252+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

The ADR-0055 overlay already renders a results summary near the top of each generated page body. Should the Specification card also show one?

## Options

- Keep it in the body only
- Move it into the card
- Show in both
- Other

## Final answer

Body only (operator, 2026-10-19): the card shows tags and source link; the ADR-0055 results summary stays in the body where the overlay places it. FR-014 and US3 scenario 2 amended.

## Rationale

_(none)_

## Change log

- `2026-10-19T06:14:11.431021+00:00` — opened
- `2026-10-19T06:26:34.146252+00:00` — resolved (final_answer="Body only (operator, 2026-10-19): the card shows tags and source link; the ADR-0055 results summary stays in the body where the overlay places it. FR-014 and US3 scenario 2 amended.")
