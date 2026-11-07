---
section: Changed
---

- **Metadata blocks start collapsed (#290).** Before, Who is this for, Related,
  External references and Glossary links used always showed in full, and on a
  page with several they pushed the content down. Now each starts closed behind a
  control with its label and count, such as "Related (3)". They open by mouse or
  keyboard, also with scripts off, start closed again on the next page, print
  open, and stay in search. Set `metadataBlocks: { collapsed: false }` to keep them
  open. See [ADR-0077](docs/adr/0077-shared-disclosure-control.md).
