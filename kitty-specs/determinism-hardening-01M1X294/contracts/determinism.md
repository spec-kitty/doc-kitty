# Contract: determinism hardening (#87 + #88)

## `compareCodeUnit` (FR-004, C-004)
```
// src/lib/vocabulary-core.mjs
export function compareCodeUnit(a: string, b: string): number  // UTF-16 code-unit; -1/0/1
```
- The ONE code-unit comparator. `metadata.ts` re-exports it as `compareSlug`
  (slug-typed alias, #85). No other inline `a<b?-1:...` or bare `localeCompare`
  is added; the sites in research D2 route through it (or through a
  fixed-locale `localeCompare` for human-facing title order).

## `sortSitemapXml` (FR-001, NFR-001)
```
// src/lib/sitemap-order.ts
export function sortSitemapXml(xml: string): string  // reorder <url> blocks by <loc>, code-unit asc; otherwise byte-preserving
export default function sitemapOrderIntegration(): AstroIntegration  // astro:build:done → rewrite each dist/sitemap-*.xml
```
- Reorders whole `<url>…</url>` blocks by `<loc>` text; preserves the prolog,
  `<urlset …>` attributes, and every non-`<url>` byte. Idempotent (sorting a
  sorted sitemap is a no-op).

## Ranker totality (FR-002)
- `rankForAgents`, the llms.txt section sort, and `selectHubChildren` are total:
  a shuffled input ranks identically. The slug/code-unit tiebreak is APPENDED
  after the existing primary keys, so the demonstrator output is unchanged.

## Byte-neutrality (C-001)
- Acceptance: a fresh build changes only `sitemap-*.xml` versus a pre-change
  build; two consecutive post-change builds are byte-identical.
