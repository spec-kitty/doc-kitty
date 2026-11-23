# Decision Moment `01M853NP2MPP7HNWKMX9K8Y2ST`

- **Mission:** `subprocessor-catalog-01M84X07`
- **Origin flow:** `specify`
- **Slot key:** `specify.entities.record-field-set`
- **Input key:** `record_field_set`
- **Status:** `open`
- **Created:** `2026-11-23T21:05:58.356510+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Record field set (⚖ counsel reviews it before it is called DPA-ready). Fields as in the issue: { id, name, address?, contact?, processing, location, responsibilities, since, until?, external_references?, tom_classification? }. external_references reuses the existing page shape (inline or {type: biblio, id}), and tom_classification reuses the page field shape from ADR-0080. Open point: how is  typed? (A) A non-empty list of ISO 3166-1 alpha-2 codes (e.g. [DE, US]) with an optional free-text location_note. Machine-checkable, useful later for transfer analysis. (B) Free text. (C) Free text now, structured later. No transfer-mechanism field in any case; that is a follow-up issue.

## Options

- A: ISO 3166-1 alpha-2 list + optional location_note (recommended)
- B: free text
- C: free text now, structured later
- Other

## Final answer

_(none)_

## Rationale

_(none)_

## Change log

- `2026-11-23T21:05:58.356510+00:00` - opened
