---
section: Added
---

- **Pages can classify the technical and organisational measures they evidence
  (#406).** Before, a page could not say which data-protection measure it
  documents. Now an optional `tom_classification` field lists measure ids, each
  with an optional `scope` (`system` or `organisation`) and `note`. Ids resolve
  against `docs/_meta/measures.yaml`, or against a shipped default of the 17
  example headings of the EU standard contractual clauses. An unknown id fails the
  build and `pnpm validate:catalog`. The content graph gains `classified-as`
  edges, `/api/pages` records list the resolved measures, and the OKF export adds
  a Measures section. See
  [ADR-0080](docs/adr/0080-tom-classification-field-and-measures-catalog.md).
