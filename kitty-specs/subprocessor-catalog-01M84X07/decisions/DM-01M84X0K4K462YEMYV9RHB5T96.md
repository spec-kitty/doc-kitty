# Decision Moment `01M84X0K4K462YEMYV9RHB5T96`

- **Mission:** `subprocessor-catalog-01M84X07`
- **Origin flow:** `specify`
- **Slot key:** `specify.scope.generated-page-sequencing`
- **Input key:** `generated_page_sequencing`
- **Status:** `open`
- **Created:** `2026-11-23T19:09:35.763740+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Issue #359 (generated-section contract) is still open. How should this mission handle the generated sub-processor list page? (1) Split it into a final WP that waits on #359 being accepted, while the catalog, validation, agent API, change feed, tom_classification link and docs ship independently. (2) Build it now following #359's drafted contract (generated: {by, at, source_digest} stamp plus a --check drift gate), clearly marked provisional in ADR-0085 and on the page.

## Options

- Split into a later WP gated on #359 (recommended)
- Build provisionally now against #359 draft
- Other

## Final answer

_(none)_

## Rationale

_(none)_

## Change log

- `2026-11-23T19:09:35.763740+00:00` - opened
