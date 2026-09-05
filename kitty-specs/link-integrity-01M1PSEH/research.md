# Research — Internal link integrity

Consolidated from the prior architect link-integrity investigation (curl-verified) and re-verified on current main (7921389). Decisions the mission must not re-open.

## D1 — Base-prefix internal links at shared seams (#61)

- **Decision**: Astro does NOT rewrite raw `/…` links, so every internal href must be built base-aware. Two shared seams: (a) thread the configured `base` into the glossary remark plugins via the established `normalizeBasePrefix` pattern (`config.ts` already uses it for `/rss.xml`,`/llms.txt`), feeding one base-aware term-URL builder shared by `glossary-autolink.internal.ts` (~:160), `glossary-term.ts` (~:108), and the preview client; (b) one `withBase()` helper (reads `import.meta.env.BASE_URL`, available in `.astro`/`.ts` module scope) for `metadata.ts routeFor` (~:288), `Related.astro` (~:65), `OnThisPage.astro` (~:253/299), `Audience.astro` (~:74).
- **Rationale**: no shared helper exists today; the base-prefix pattern is proven (`normalizeBasePrefix`/`discoveryHead`) but was never applied to link-building. One helper each (component + glossary) kills the clone (NFR-002).
- **Alternatives**: per-call-site prefixing (rejected — clone drift, the exact cause).

## D2 — Re-author content links as `.md`-relative (#61 Class B + A6)

- **Decision**: author internal content links as file-relative with the `.md` extension (`[…](./blocks-demonstrator.md)`). Astro rewrites a link naming a real collection source file to its final base-prefixed route URL.
- **Rationale**: fixes the leaf-page trailing-slash trap (bare `blocks-demonstrator` → child 404) AND the root-absolute 404s, AND makes the source gate correct for free (filesystem path == route node for `.md` links). Confirmed offenders: `architecture/superseded-note.md:19`, `architecture/blocks-demonstrator.md:29/32/34`, `plans/missions/mission-alpha.md:22`, `plans/missions/mission-beta.md:14`, `changelog/README.md:12`, `adr/README.md:17`, `guides/README.md:14`, `architecture/README.md:16`.
- **Alternatives**: base-absolute authored links (rejected — verbose, still defeats the gate).

## D3 — Fix glossary anchor generation (#63)

- **Decision**: `generate.ts` (~:93) emits the **block-form** heading attribute (attribute-list line immediately above the heading) instead of the inline `## name {#anchor}` form, since this toolkit's markua-attributes is block-form only (`markua-attributes.ts:200-227`).
- **Rationale**: the inline form is never consumed → the slugger doubles the id (`cargo-cargo`) and `{#…}` renders literally, so term fragments never resolve. Block-form is the supported syntax.
- **Alternatives**: add inline-trailing heading-attribute support to markua-attributes (larger; deferred unless block-form proves insufficient).

## D4 — Fail-closed link gate (#62)

- **Decision**: add `assert:no-broken-links` that walks `example/dist/**/*.html`, extracts every internal href, resolves it **as a URL against the base** (trailing-slash directory semantics), and asserts the target exists in `dist`; wire into CI next to `validate:links`. Also tighten `check-links.mjs`: fail root-absolute internal doc links and extensionless-relative internal doc links.
- **Rationale**: the source gate is green-on-broken (skips `/…` at `:139`, resolves relative vs filesystem at `:193`, never sees rendered/component/generated output). Only a base-aware dist walk catches all three classes; it must be **RED on today's dist** (~30 links) and green after the fixes.
- **Alternatives**: source-only fixes (rejected — can't see component/generated/dist links).

## Sequencing
IC-01 and IC-02 fix the links (IC-02 depends on IC-01's shared glossary builder for OnThisPage); IC-03's gate goes green only after both — prove it RED on the pre-fix dist. Mirrors the architect's P1→P3→P4→(P2/P5) with the gate demonstrated red-first.

## Supply-chain
No dependency added/upgraded/removed — N/A.
