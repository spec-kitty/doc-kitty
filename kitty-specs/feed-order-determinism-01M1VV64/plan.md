# Implementation Plan: Feed order determinism (#85)

**Branch**: `feat/feed-order-determinism` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/feed-order-determinism-01M1VV64/spec.md`

## Summary

Two tiny, intentional ordering fixes in the metadata/route layer, delivered
direct-to-feat and landing via a PR to `main` (Closes #85):

1. **IC-01 — total feed comparator.** `rankForFeed` in `src/lib/metadata.ts`
   breaks `updatedMillis` ties by ascending slug with a locale-independent
   comparison, so the feed order no longer depends on content-layer insertion
   order (which is the completion order of Astro's 10-way concurrent glob
   loader; measured 16 distinct orders in 20 calls).
2. **IC-02 — slug-sorted collected entries.** `collectDocEntries` in
   `src/lib/routes/shared.ts` sorts the adapted entries by slug, so every
   downstream surface is order-stable by construction, not one comparator at a
   time. Every current consumer already sorts with a total comparator
   (`rankForAgents`: section → priority → title; sitemap sorts itself), so
   their outputs are byte-identical.
3. **IC-03 — regression test.** A shuffled-input unit test for `rankForFeed`
   (and a small one for the collect adapter's ordering contract), so the
   comparator cannot silently become partial again.

Oracle: a clean `example/dist` build was hashed on the pre-change tree (234
files). After the change: two consecutive builds must hash identically to
each other (NFR-001); versus the baseline exactly `rss.xml` may differ, and
only in item order (NFR-002).

## Technical Context

**Language/Version**: TypeScript 5.x (Node ≥ 20, ESM) on Astro 5 + Starlight
**Primary Dependencies**: existing only; none added (C-002)
**Testing**: vitest (from `src/`, serial) + build + validate/assert gates; a11y
suite unaffected (no HTML change) but run as part of the gate set
**Constraints**: locale-independent tiebreak (C-001); scope = metadata.ts +
routes/shared.ts + tests (C-003)
**Scale/Scope**: ~5 lines of production code, ~40 lines of tests

## Charter Check

- **DIRECTIVE_041 (tests prove behaviour)**: IC-03 pins the total-order
  contract with a shuffle test, so the fix cannot regress silently.
- **DIRECTIVE_001 / DIRECTIVE_024 (locality)**: two functions in the
  metadata/route layer; routes and renderers untouched.
- **Behaviour change is explicit**: the tie order of feed items changes from
  arbitrary to slug order; recorded in the spec (not a silent side effect).
- **DIRECTIVE_051 (supply chain)**: N/A.

No violations → Complexity Tracking empty.

## Project Structure

```
src/lib/metadata.ts          # rankForFeed: add slug tiebreak (IC-01)
src/lib/routes/shared.ts     # collectDocEntries: sort by slug (IC-02)
src/tests/metadata.test.ts   # shuffle test for rankForFeed (IC-03)
src/tests/<route/shared test> # ordering contract for collectDocEntries if a
                              # pure seam exists; else document why not (IC-03)
kitty-specs/feed-order-determinism-01M1VV64/contracts/feed-order.md
```

## Implementation Concern Map

### IC-01 — Total feed comparator
- **Purpose**: deterministic feed order.
- **Relevant requirements**: FR-001, NFR-001, C-001
- **Affected surfaces**: `rankForFeed` in `src/lib/metadata.ts`.
- **Risks**: `localeCompare` without a locale argument is environment-dependent;
  use `localeCompare(b.slug, 'en')` or a code-point comparison. Keep the
  `isPublished` filter and the desc-by-updated primary key untouched.

### IC-02 — Slug-sorted collected entries
- **Purpose**: order stability by construction for every consumer.
- **Relevant requirements**: FR-002, NFR-002
- **Affected surfaces**: `collectDocEntries` in `src/lib/routes/shared.ts`.
- **Risks**: `getCollection` is Astro-bound, so the adapter has no pure unit
  seam; extract the sort into a tiny exported pure helper (e.g.
  `sortBySlug(entries)`) that the adapter applies and the test exercises, or
  test through `rankForFeed` only and say so. Consumers must be byte-identical
  (llms.txt, agent index, sitemap): the corpus oracle proves it.

### IC-03 — Regression test
- **Purpose**: pin the total order.
- **Relevant requirements**: FR-003, SC-002
- **Affected surfaces**: `src/tests/metadata.test.ts` (+ shared-route test).
- **Risks**: the test must fail if the tiebreak is removed — use ≥3 tied
  entries and a deterministic shuffle (reverse + interleave) rather than
  `Math.random`, so the test itself is reproducible.
