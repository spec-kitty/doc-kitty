# Contract — enriched agent surface

Backs FR-014 and DIRECTIVE_018.

## Per-page record (extended)

Each `/api/pages/<id>.json` and `/api/index.json` record gains:

- `audience: { profile, guidance_text }[]` — carried as authored.
- `related: { ref, title, kind, doc_status }[]` — **resolved** (was raw slugs).

## Composition (MUST)

- `toAgentRecord(entry)` stays **pure and single-entry** — it does not gain corpus
  awareness.
- A separate `resolveRelated(refs, index)` runs in the route (which already calls
  `getCollection('docs')`) and enriches the record before serialization.
- Resolution failures are already build-fatal at render (FR-004), so the agent
  surface never emits a dangling `related`.

## Versioning (MUST)

- Because `related` changes shape for existing consumers, the agent-API `version`
  is incremented (the seam already lives in the index/route builders).

## Gating (unchanged)

- `doc_status` gating still applies to pages: a `draft` page is absent from
  `/api/index.json`, RSS, and the sitemap. `/api/bibliography.json` is a catalog
  projection and is **not** page-gated.

## Assertions

- `assert-build-artifacts.mjs`: `EXPECTED_PAGE_KEYS` includes `audience`/`related`;
  resolved-`related` asserted as an array of objects (non-string), `version` bumped;
  the retained draft page absent from index/sitemap.
