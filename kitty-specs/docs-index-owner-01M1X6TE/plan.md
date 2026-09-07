# Implementation Plan: Docs-index neutral owner + Hub dedup (#90)

**Branch**: `feat/docs-index-owner` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

## Summary
Direct-to-feat, PR to `main` (Closes #90). One WP, orchestrator-implemented (a
mechanical, byte-neutral move):

1. **New `src/lib/docs-index.ts`** owns `collectDocEntries` + `buildDocsIndex`
   (moved verbatim from `routes/shared.ts`). `collectDocEntries` gains an opt-in
   `{ withBody }` (default false → byte-identical shape for every current caller;
   true → adds `body: entry.body ?? ''`, the exact field Hub maps today).
2. **`DocEntry`** (metadata.ts) gains `body?: string` (additive/optional).
3. **`shared.ts`** keeps the docs-root resolver (`docsRoot` &c.) and the feed
   helpers (`absolute`, `xmlEscape`); its now-unused imports (`sortBySlug`,
   `DocEntry`, `DocsIndex`, `DocKittyFrontmatter`) are trimmed; `getCollection`
   and `slugFromEntryId` stay (used by `docsRoot`/`docsRootFromSignal`).
4. **Rewire 7 importers** (rss, agent-index, llms-txt, agent-page; Audience,
   Related, OnThisPage) to import `collectDocEntries`/`buildDocsIndex` from
   `docs-index.js`, keeping their `shared.js` imports for `absolute`/`docsRoot`.
5. **`Hub.astro`** replaces its inline `getCollection('docs').map(...)` with
   `await collectDocEntries({ withBody: true })`; drops the now-unused
   `getCollection` import (keeps `slugFromEntryId` for `currentSlug`,
   `DocKittyFrontmatter` for `isAdrKind`).
6. **Tests**: `collect-doc-entries-order.test.ts` rewires its dynamic import to
   `docs-index.js` and gains a `withBody` case; comment path updated.
   `deck-slug.ts` doc-comment path reference updated.

## Byte-neutrality
`collectDocEntries({withBody:true})` returns the same `{slug,data,body}` shape
Hub builds today; Hub's input to `selectHubChildren` changes from raw order to
slug-sorted, but `selectHubChildren` is intrinsically total (#88), so its output
is unchanged. Default `collectDocEntries()` is identical to today for all other
callers. Verified by the pre/post build hash oracle (SC-003, NFR-001).

## Charter Check
- DISCIPLINED_REFACTORING: byte-neutral move with a hash oracle + full suite.
- DIRECTIVE_024 (locality/ownership): the extraction gives the docs-index
  derivation a neutral owner; docs-root and feed helpers stay route-scoped.
- No dependency change (C-002). No violations.

## IC map
- **IC-01**: create docs-index.ts (move + opt-in body); DocEntry.body.
- **IC-02**: rewire importers + Hub; trim shared.ts; update the one test + comment.
