# Contracts — Metadata / Vocabulary / Hub Consolidation

This mission adds **no HTTP/API endpoints or external event shapes**, so there are no request/response or wire contracts. It is an internal refactor + two additive enhancements.

The mission's "contracts" are the **function signatures of the single-sourced modules**, which are specified in [`../data-model.md`](../data-model.md):

- `src/lib/vocabulary-core.mjs` — fs-free derivation/enum core (`STATUSES`/`DOC_TYPES`/`KINDS`, `SECTION_TYPE`, `expectedDocType`, the pure vocabulary resolver, index-basename helpers).
- `src/lib/vocabulary-loader.mjs` — fs-loader layer (`loadVocabulary`, `loadSectionRegistry`, `sectionTypes`, `sectionSubtypes`).
- `src/scripts/generate-adr-index.mjs` — `extractAdrMeta(rawMarkdown, {slug, frontmatter}) → {number,status,date}|null`, the sole ADR number/status/date source for both the generator and `Hub.astro`.

These are enforced by the mission's tests (`vocabulary-core.test.ts` golden-master, `vocabulary-single-source.test.ts` structural gate, `hub-adr-card.test.ts` fidelity + single-source gate) rather than by a serialized contract file.
