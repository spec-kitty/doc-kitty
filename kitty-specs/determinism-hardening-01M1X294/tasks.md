# Tasks: Determinism hardening (#87 + #88)

**Mission**: `determinism-hardening-01M1X294` · **Branch**: `feat/determinism-hardening` (direct-to-feat; PR to `main`, Closes #87 #88)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Contract**: [contracts/determinism.md](./contracts/determinism.md)

Two work packages, 1:1 with the issues. WP01 (#87 sitemap) imports the shared
`compareCodeUnit` that WP02 (#88 comparators) creates, so WP01 depends on WP02.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `compareCodeUnit` in vocabulary-core.mjs; `compareSlug` → its alias in metadata.ts | WP02 | |
| T002 | `rankForAgents`: pin title locale + append `compareCodeUnit(slug)` tiebreak (byte-neutral) | WP02 | |
| T003 | llms-txt section sort + `selectHubChildren`: append code-unit tiebreak | WP02 | |
| T004 | Route id/path/number sorts (sections/catalog/metadata.resolveIndexEntries/adr-index) + inline glossary twins through `compareCodeUnit`; keep .mjs↔.ts twins in sync | WP02 | |
| T005 | Hub.astro + Audience/Related/OnThisPage: call shared collection/index helpers, drop inline copies (defer-with-note if it forces an Astro import cycle) | WP02 | |
| T006 | Regression tests: shuffled-input per ranker; parity twins green | WP02 | |
| T007 | `sortSitemapXml` pure helper + `doc-kitty:sitemap-order` integration; register after sitemap() in config.ts | WP01 | |
| T008 | Sitemap-sort unit test (fixture; idempotent; byte-preserving except <url> order) | WP01 | |

## Work Packages

### WP02 — Comparator hygiene sweep (#88)
- **Goal**: one shared `compareCodeUnit`; intrinsic-total, locale-independent rankers/sorts; inline twins and component read-paths routed through the shared helpers. Byte-neutral.
- **Priority**: P1.
- **Requirements**: FR-002, FR-003, FR-004, FR-005, FR-006; NFR-002, NFR-003, NFR-004; C-001, C-002, C-003, C-004.
- **Independent test**: `pnpm test` green with new shuffle tests + parity twins; orchestrator oracle shows no built-file byte change from WP02 alone.
- **Included subtasks**: T001–T006
- **Dependencies**: none
- **Prompt**: [tasks/WP02-comparator-hygiene.md](./tasks/WP02-comparator-hygiene.md)
- **Risks**: rankForAgents must APPEND not replace; locale-pin fallback; id/path collation byte-neutral only for ASCII keys; twin sync; possible Astro import cycle for T005.

### WP01 — Sitemap post-build sort (#87)
- **Goal**: a toolkit integration that sorts each built `sitemap-*.xml` by `<loc>`, making it reproducible.
- **Priority**: P1.
- **Requirements**: FR-001, FR-006; NFR-001, NFR-002, NFR-004; C-001, C-003.
- **Independent test**: unit test over a fixture sitemap; orchestrator two-build oracle shows `sitemap-0.xml` byte-stable and sorted.
- **Included subtasks**: T007, T008
- **Dependencies**: WP02 (imports `compareCodeUnit`)
- **Prompt**: [tasks/WP01-sitemap-order.md](./tasks/WP01-sitemap-order.md)
- **Risks**: single-line XML, only `<loc>` per `<url>`; handle multiple page files; idempotent; preserve every non-`<url>` byte.

## MVP
WP02 delivers the comparator determinism; WP01 closes the last byte-oracle hole.
