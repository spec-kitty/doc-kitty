# Decision Moment `01M1MFXSJHAYEFYCDCC5NKS8JT`

- **Mission:** `metadata-vocab-hub-consolidation-01M1MFVT`
- **Origin flow:** `specify`
- **Slot key:** `specify.consolidation.acceptance-bar`
- **Input key:** `consolidation_acceptance_bar`
- **Status:** `resolved`
- **Created:** `2026-09-03T20:38:50.705418+00:00`
- **Resolved:** `2026-09-03T20:41:08.108149+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

For #49, what is the done-bar for eliminating the mjs↔ts vocabulary/type split-brain?

## Options

- Structural single source (divergence impossible by construction; parity test becomes a redundant guard or is removed)
- Reduce duplication but keep NFR-004 parity test as the safety net
- Other

## Final answer

Structural single source: a shared pure-ESM core imported by both the bare-Node gate (validate-frontmatter.mjs) and the toolkit libs (sections.ts loadVocabulary, metadata.ts expectedDocType), so vocabulary + type-derivation divergence is impossible by construction. The NFR-004 resolved-vocabulary parity test becomes a redundant guard (kept as a cheap regression guard or removed if structurally moot).

## Rationale

_(none)_

## Change log

- `2026-09-03T20:38:50.705418+00:00` — opened
- `2026-09-03T20:41:08.108149+00:00` — resolved (final_answer="Structural single source: a shared pure-ESM core imported by both the bare-Node gate (validate-frontmatter.mjs) and the toolkit libs (sections.ts loadVocabulary, metadata.ts expectedDocType), so vocabulary + type-derivation divergence is impossible by construction. The NFR-004 resolved-vocabulary parity test becomes a redundant guard (kept as a cheap regression guard or removed if structurally moot).")
