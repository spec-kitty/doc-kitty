# Decision Moment `01M1MN1VRT868Q6H6Z7DRGKCZ6`

- **Mission:** `metadata-vocab-hub-consolidation-01M1MFVT`
- **Origin flow:** `plan`
- **Slot key:** `plan.consolidation.core-structure`
- **Input key:** `consolidation_core_structure`
- **Status:** `resolved`
- **Created:** `2026-09-03T22:08:26.906878+00:00`
- **Resolved:** `2026-09-03T22:26:22.775855+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

#49 shared pure-ESM core structure vs metadata.ts's documented fs-free purity boundary — how to reconcile?

## Options

- Two-layer: fs-free derivation/enum core (metadata.ts imports) + thin fs-loader layer (sections.ts + gate import) — preserves the fs-free invariant
- Single core incl. fs reads (sections.ts + gate import); metadata.ts imports only pure re-exports — fewer files, mildly bends the boundary
- Other

## Final answer

Two-layer shared pure-ESM core: (1) a fs-free derivation/enum core (canonical STATUSES/DOC_TYPES/KINDS, frozen SECTION_TYPE fallback, expectedDocType + adr/plans/operations sub-path switch, and the pure vocabulary/axis resolver functions) that metadata.ts and schema.ts import — preserving metadata.ts's documented fs-free purity contract; (2) a thin fs-loader layer (loadVocabulary, loadSectionRegistry, sectionTypes/sectionSubtypes readers) that reads _meta/*.yaml, imported by sections.ts and the bare-Node validate-frontmatter.mjs gate. Both layers are plain .mjs so the gate imports them directly with no Astro/build context; TS consumers get types via a hand-written .d.ts (no repo-wide allowJs). Codegen rejected: it reintroduces the generated-twin staleness #49 exists to eliminate.

## Rationale

_(none)_

## Change log

- `2026-09-03T22:08:26.906878+00:00` — opened
- `2026-09-03T22:26:22.775855+00:00` — resolved (final_answer="Two-layer shared pure-ESM core: (1) a fs-free derivation/enum core (canonical STATUSES/DOC_TYPES/KINDS, frozen SECTION_TYPE fallback, expectedDocType + adr/plans/operations sub-path switch, and the pure vocabulary/axis resolver functions) that metadata.ts and schema.ts import — preserving metadata.ts's documented fs-free purity contract; (2) a thin fs-loader layer (loadVocabulary, loadSectionRegistry, sectionTypes/sectionSubtypes readers) that reads _meta/*.yaml, imported by sections.ts and the bare-Node validate-frontmatter.mjs gate. Both layers are plain .mjs so the gate imports them directly with no Astro/build context; TS consumers get types via a hand-written .d.ts (no repo-wide allowJs). Codegen rejected: it reintroduces the generated-twin staleness #49 exists to eliminate.")
