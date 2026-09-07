# Implementation Plan: Determinism hardening (#87 + #88)

**Branch**: `feat/determinism-hardening` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

## Summary

Direct-to-feat on `feat/determinism-hardening`, PR to `main` (Closes #87, #88).
Two work packages mapping 1:1 to the two issues:

- **WP01 (#87)** — a toolkit `AstroIntegration` (`doc-kitty:sitemap-order`)
  appended to the integrations array in `config.ts` after the `sitemap(...)`
  entry, whose `astro:build:done` hook reads each `dist/sitemap-*.xml`, sorts
  its `<url>` blocks by `<loc>` (code-unit ascending), and writes it back. Pure
  string/XML helper + a unit test over a fixture sitemap. Sorts with the shared
  `compareCodeUnit` (WP02), so WP01 **depends on WP02**.
- **WP02 (#88)** — the comparator hygiene sweep, all byte-neutral:
  - a single `compareCodeUnit(a, b)` in the pure-ESM core
    (`vocabulary-core.mjs`); `metadata.ts` moves `compareSlug`'s body there and
    re-exports it as the slug-typed alias (one implementation, reachable from
    every `.ts` and `.mjs` twin);
  - `rankForAgents` gains a `compareCodeUnit(a.slug, b.slug)` tiebreak appended
    after the existing title order, and the title `localeCompare` is pinned to a
    fixed locale — **verified byte-neutral** (titles are unique on the corpus so
    the slug tiebreak never fires; the priority-0.5 `context` trio stays in
    title order Domain/Marzipan/Product);
  - the llms.txt section sort and `hub-children.mjs` gain the same appended
    code-unit tiebreak; the id/path/number `localeCompare` sites route through
    `compareCodeUnit` (byte-neutral: ASCII/digit keys already code-unit-ordered);
    the two inline `a<b?...` glossary twins import it; the `.mjs`/`.ts` parity
    twins are kept in sync;
  - `Hub.astro` and the Audience/Related/OnThisPage slot components call the
    shared collection/index helpers instead of inline copies (byte-neutral);
  - regression tests: shuffled-input per ranker + the sitemap sort helper.

## Oracle

A clean `example/dist` build was hashed on the pre-change tree (234 files). The
mission is verified by: (a) two consecutive post-change builds hash identically
(SC-001, incl. `sitemap-0.xml`); (b) vs the pre-change baseline, **only**
`sitemap-*.xml` differs (SC-002, C-001). Because the pre-change `sitemap-0.xml`
is itself nondeterministic, the baseline comparison for that one file is by
sorted-URL-set equality, not raw bytes.

## Charter Check

- **DIRECTIVE_041**: shuffled-input regression tests pin every hardened order.
- **DIRECTIVE_001/024 (locality)**: WP01 is the build-integration layer; WP02 is
  the metadata/route/comparator layer; disjoint owned files.
- **Behaviour change is explicit and bounded**: only `sitemap-*.xml` bytes
  change (deliberately, to sorted); everything else is byte-neutral (C-001).
- **DIRECTIVE_051**: N/A; no dependency change (C-003).

No violations → Complexity Tracking empty.

## Project Structure

```
src/lib/sitemap-order.ts        # NEW — pure sort helper + the integration (WP01)
src/lib/config.ts               # register the integration after sitemap() (WP01)
src/lib/vocabulary-core.mjs     # NEW compareCodeUnit; used by the .mjs twins (WP02)
src/lib/metadata.ts             # compareSlug → alias of compareCodeUnit; rankForAgents, resolveIndexEntries (WP02)
src/lib/sections.ts             # byOrderThenId via compareCodeUnit (WP02)
src/lib/catalog.ts              # bibliography id sort (WP02)
src/lib/hub-children.mjs        # selectHubChildren tiebreak (WP02)
src/lib/vocabulary-loader.mjs   # order-then-id twin (WP02)
src/lib/routes/llms-txt.ts      # section sort tiebreak (WP02)
src/lib/routes/shared.ts        # (only if a shared buildDocsIndex export is needed by WP02 components) 
src/lib/glossary/generate.ts    # inline twin → compareCodeUnit (WP02)
src/lib/glossary/definitions-payload.ts # inline twin → compareCodeUnit (WP02)
src/scripts/generate-adr-index.mjs # ADR-number sort locale-independent (WP02)
src/layouts/Hub.astro           # use shared collection helper (WP02)
src/components/slots/{Audience,Related,OnThisPage}.astro # use shared buildDocsIndex (WP02)
src/tests/*                     # sitemap-order test (WP01); ranker shuffle tests (WP02)
```

## Implementation Concern Map

### IC-01 — Sitemap post-build sort (#87)
- **Requirements**: FR-001, FR-006, NFR-001, NFR-002
- **Surfaces**: NEW `src/lib/sitemap-order.ts` (pure `sortSitemapXml(xml): string`
  + the `AstroIntegration`); `src/lib/config.ts` registration after the
  `sitemap(...)` entry (~L856), mirroring the `favicon.ts` / `manifest.ts`
  `astro:build:done` idiom (read `fileURLToPath(dir)/sitemap-*.xml`, rewrite).
- **Depends-on**: IC-02 (imports `compareCodeUnit`).
- **Risks**: the emitted XML is single-line, no inter-tag whitespace; each
  `<url>` carries only `<loc>`. Sort whole `<url>…</url>` blocks by `<loc>` text;
  do not reformat the rest. Handle multiple `sitemap-N.xml` files; leave the
  index consistent (single page today, so the index is unchanged).

### IC-02 — Comparator core + intrinsic-total rankers + dedupe (#88)
- **Requirements**: FR-002, FR-003, FR-004, FR-005, FR-006, NFR-002, NFR-003;
  C-001, C-002, C-004
- **Surfaces**: the comparator source in `vocabulary-core.mjs`; the ranker/sort
  sites and their `.mjs` twins; the glossary inline twins; the component
  read-paths; regression tests. See research D2 for the full site table.
- **Depends-on**: none.
- **Risks**: (a) `rankForAgents` must APPEND the slug tiebreak (not replace the
  title key) and the pinned-locale title compare must not reorder the
  demonstrator — the oracle is the arbiter; fall back to an unpinned title
  compare + appended slug if it does. (b) Routing id/path sorts through
  `compareCodeUnit` changes collation; byte-neutral only because the keys are
  ASCII/digit — the oracle confirms. (c) `.mjs`↔`.ts` parity twins
  (`metadata.ts:457`↔`vocabulary-core.mjs`, `sections.ts:87`↔
  `vocabulary-loader.mjs`) must move together. (d) The slot components read raw
  `getCollection`; routing them through the shared helper must not introduce an
  Astro import cycle — if it does, dedupe only what is clean and note the rest.
