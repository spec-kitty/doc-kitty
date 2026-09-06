# Research: Feed order determinism (#85)

## D1 — Where the nondeterminism comes from (verified in #83)

`rankForFeed` sorts by `updatedMillis` only. V8's sort is stable, so ties keep
input order; input is `getCollection('docs')`, whose store is filled by Astro's
glob loader in the completion order of a `pLimit(10)` read+render pool.
`tinyglobby` alone returned 16 distinct orders over 20 calls on `example/docs`.
Two clean builds of the unchanged tree produced two different `rss.xml` hashes
with identical sorted item multisets. No other output leaked the order in the #83 oracle run, but that was partly
luck: `rankForAgents` is NOT strictly total (it ends in a bare
`title.localeCompare` with no locale; titles are not unique) — it only
becomes deterministic because `collectDocEntries` now feeds it a slug-sorted
list (D3) — and the sitemap does NOT sort routes itself (see D4 / #87).

## D2 — Tiebreak choice

- **Decision**: ascending slug, locale-independent (`localeCompare(…, 'en')` or
  code-point compare). Slug is unique per entry, so the comparator is total.
- **Alternatives**: title (not unique; localized), file mtime (not in
  frontmatter, filesystem-dependent), preserving "first seen" (that is the
  bug). Rejected.

## D3 — Fix at the adapter too

- **Decision**: also sort `collectDocEntries` by slug. Every current consumer
  already applies a total sort, so outputs are unchanged, and any future
  consumer that forgets to sort is stable by construction.
- **Risk considered**: hidden reliance on collection order elsewhere. Grep
  shows `collectDocEntries` consumers are the four routes (rss, llms-txt,
  agent-index, sitemap/agent-page) and `buildDocsIndex` (a map keyed by slug,
  order-insensitive). The corpus oracle is the backstop.

## D4 — Second nondeterministic file found by the oracle: `sitemap-0.xml`

Running the two-build oracle after the fix: `rss.xml` is now byte-identical
and correctly ordered (updated desc, ties by slug); `sitemap-0.xml` differed
between builds 1 and 2 (same 30 URLs, different order) and matched between
builds 2 and 3 — intermittent, timing-driven. Cause by source reading:
`@astrojs/sitemap` writes Astro's `pages` unsorted, and Starlight generates
the docs routes from its own `getCollection` (same loader-order root cause as
#85), which `collectDocEntries` cannot reach. Different layer (build
integration), so filed as **#87** rather than widening this mission.

## D5 — Squad outcome (pre-PR)

- reviewer-renata: APPROVE. Folded: "code-unit" wording; shared.ts docstring
  overclaim; SC-003 / D1 text aligned.
- paula-patterns: ship-after-folds. Folded: `sortBySlug` moved beside
  `compareSlug` in the Astro-free `metadata.ts` (the adapter keeps only the
  call), which makes the "unit-testable without mocking" claim true. Deferred
  (outside C-003) as **#88**: `rankForAgents` and the llms-txt section sort are
  only positionally deterministic (they rely on the new slug baseline);
  `Hub.astro` and three slot components read `getCollection` directly and do
  not get the baseline; nine bare `localeCompare` sites; two inline compare
  twins. Sitemap order → **#87**.
