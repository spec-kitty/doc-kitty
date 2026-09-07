---
work_package_id: WP01
title: Sitemap post-build sort (#87)
dependencies:
- WP02
requirement_refs:
- C-001
- C-003
- FR-001
- FR-006
- NFR-001
- NFR-002
- NFR-004
planning_base_branch: feat/determinism-hardening
merge_target_branch: feat/determinism-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/determinism-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/determinism-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/sitemap-order.ts
create_intent:
- src/lib/sitemap-order.ts
execution_mode: code_change
owned_files:
- src/lib/sitemap-order.ts
- src/lib/config.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile
```
/ad-hoc-profile-load implementer-ivan
```

## Objective

Issue #87: make the built `sitemap-*.xml` reproducible by sorting its `<url>`
entries by `<loc>` in a toolkit `astro:build:done` hook. Read the mission
spec/plan/research/contract in `kitty-specs/determinism-hardening-01M1X294/`
(research D1 has the hook location + XML shape). Issue: `gh issue view 87`.
**WP02 has already landed `compareCodeUnit` in `src/lib/vocabulary-core.mjs`** —
import and use it for the `<loc>` sort (one comparator).

## Hard rules
- Do NOT commit/stage/stash/switch branches. No dependencies (C-003). Do NOT run
  the full `pnpm test` (the vitest `build` project owns `example/dist`); a single
  `pnpm build` is fine ONLY if you must smoke-test, but the orchestrator owns the
  build oracle — prefer the unit test. Run unit tests with
  `cd src && ./node_modules/.bin/vitest run --project fast`. No `astro check`.
- Only edit `src/lib/sitemap-order.ts` (new) and `src/lib/config.ts`.

## Subtasks

### T007 — `sortSitemapXml` + integration
- New `src/lib/sitemap-order.ts`:
  - `export function sortSitemapXml(xml: string): string` — reorder whole
    `<url>…</url>` blocks by their `<loc>` text using
    `compareCodeUnit` (import from `./vocabulary-core.mjs`), preserving the XML
    prolog, the `<urlset …>` open tag with all its `xmlns:*` attributes, and every
    non-`<url>` byte. Idempotent (sorting a sorted sitemap returns it unchanged).
    The emitted XML is single-line with no inter-tag whitespace; each `<url>`
    carries only `<loc>` — but parse defensively (regex over `<url>.*?</url>` with
    the `<loc>(.*?)</loc>` key) so extra children would ride along with their block.
  - `export default function sitemapOrderIntegration(): AstroIntegration` with an
    `astro:build:done` hook that, for each `sitemap-*.xml` (NOT the index) present
    under `fileURLToPath(dir)`, reads it, applies `sortSitemapXml`, and writes it
    back. Mirror the idiom in `src/lib/favicon.ts` (hook ~L135) / `src/lib/manifest.ts`
    (~L177): `path.join(fileURLToPath(dir), name)`, `readFileSync`/`writeFileSync`,
    a `logger` line. Leave `sitemap-index.xml` untouched (it references page files
    by name, which do not change).
- Register it in `src/lib/config.ts` in `defineDocKittyIntegrations`, appended to
  the integrations array AFTER the `sitemap(...)` entry (~L856) so the file exists
  when the hook runs.

### T008 — Unit test
- `src/tests/sitemap-order.test.ts` (new): feed `sortSitemapXml` a fixture with
  out-of-order `<url>` blocks; assert output has them in ascending `<loc>` order,
  the prolog + `<urlset …>` attributes + closing tag are byte-preserved, and
  sorting the sorted output is a no-op (idempotent). Include a case where a
  `<url>` carries an extra child (e.g. `<lastmod>`) to prove blocks move whole.

## Verify & report
- `cd src && ./node_modules/.bin/vitest run --project fast` → green (report count; +1 file).
- `cd src && ./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | wc -l` → 30 baseline; none new in your files.
- `git diff --stat`; confirm no package.json.
- Report the helper's approach, the integration slot, and test results. Do NOT commit.
