# Implementation Plan: Route rule and index-name consolidation

**Branch**: `fix/route-rule-consolidation` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/route-rule-consolidation-01M4WE27/spec.md`

Planning questions are answered by the spec's binding operator decisions and
the four spikes in [research.md](research.md). Open operator questions are at
the end.

## Summary

Every surface that shows a page address will call `routeOfSlug`; index names
are set once in `defineDocKittyIntegrations` and reach the loader and the link
check from there; two files on one route stop the build and the strict check.

Approach, from the spikes:

- **Single source for index names** (S1, S2): the integration publishes the
  names in `process.env.DK_INDEX_BASENAME`, the same seam `DK_DOCS_ROOT` uses.
  The loader reads it at load time; `check-links` evaluates the site's
  `astro.config.*` with Vite's `runnerImport` and reads the same variable.
- **Collisions keyed by route** (S3): `groupIndexCollisions` groups by produced
  route over all paths, drafts included, case-insensitively. Any group is fatal.
  This one change covers #135, the #137 residue and the draft case from #138.
- **One walk** (FR-010): the sidebar uses `walkMarkdownPaths`, which now excludes
  `_meta` folders and `_meta.*` files at any depth.
- **Audit** (S4): the example site and `docs/` have no route collisions under
  their real settings, so the stricter rule needs no content fixes.

## Technical Context

**Language/Version**: TypeScript 5.9.3 and JSDoc-typed ESM (`.mjs`) on Node 24 (CI) / Node >= 20 (package); Astro 5.18.2, Starlight 0.32.6, Vite 6.4.3 (via Astro)
**Primary Dependencies**: `astro`, `@astrojs/starlight` (peer), `gray-matter`, `@cucumber/*` (Gherkin), mdast/unist utilities. No new dependency; `check-links` resolves `vite` through the site's `astro` install.
**Storage**: N/A
**Testing**: vitest (`src/tests/*.test.ts`, `fileParallelism: false`), Playwright a11y suite, build-artifact asserts (`src/scripts/assert-*.mjs`), the packed-tarball consumption test, two-build determinism gate
**Target Platform**: static site build (Node), GitHub Pages output
**Project Type**: single package (`src/`, published as `@spec-kitty/doc-toolkit`) plus the `example/` site that is also the project docsite
**Performance Goals**: example build time within +10% (NFR-004); `check-links` gains under 1 s per strict root for config evaluation (measured ~850 ms)
**Constraints**: byte-identical output except corrected addresses (NFR-001); deterministic output (NFR-002); no import cycle loader -> config (C-004); accepted ADRs not edited (C-002)
**Scale/Scope**: 6 issues (#134–#139); example tree 72 pages, repo docs 145 pages

## Charter Check

| Directive / rule | Status | Note |
|------------------|--------|------|
| DIRECTIVE_041 test economy (C-005) | Pass | Each concern gets red-first tests through existing entry points (`buildRouteTable`, `docKittyDocsLoader`, `defineDocKittyIntegrations`, the `check-links` CLI, `generate.mjs`, the remark plugin). No shape pins. The FR-003 guard is a source scan with a planted positive control. |
| DIRECTIVE_051 dependencies | Pass | No new dependency. `vite` is reached through the `astro` peer the site already installs. |
| C-001 one route rule | Pass | All surfaces move onto `routeOfSlug`; `routeFor` in `metadata.ts` is deleted, not kept as a parallel rule. |
| C-002 ADR immutability | Pass | New ADR-0050 amends ADR-0047 and ADR-0048 (and references ADR-0033 for `indexBasename`). |
| DISCIPLINED_REFACTORING | Pass | IC-03 and IC-04 are behaviour-preserving except the listed fixes; NFR-001 byte diff proves it. |
| USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY | Pass | Every new test is checked by reverting its fix (the "fails when the fix is reverted" rule in C-005). |
| Determinism (charter quality section) | Pass | Route table keys stay code-unit sorted; collision groups sorted; env value is a JSON array in config order. |
| Documentation policy | Pass | ADR, consumer guide (`docs/guides/consumer-setup.md`), CHANGELOG Breaking entries; comms-cleo rewrite (C-006). |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/route-rule-consolidation-01M4WE27/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── collision-error.md
│   ├── check-links-index-names.md
│   └── index-basename-config.md
└── tasks.md            # created by /spec-kitty.tasks
```

### Source Code (repository root)

```
src/lib/
├── vocabulary-core.mjs          # routeOfSlug, groupIndexCollisions -> route-keyed, buildRouteTable, formatRouteCollisions
├── docs-walk.mjs                # walkMarkdownPaths: + _meta exclusion
├── schema.ts                    # docKittyDocsLoader: env read, mismatch error, collision throw, glob negations
├── config.ts                    # defineDocKittyIntegrations (env publish, validation), base-absolute-links (~478),
│                                # directoryMetaInputs (1443-1495) onto the walk, topLevelContentDirs
├── metadata.ts                  # routeFor (331) removed -> routeOfSlug
├── route-shaping.ts             # indexHref (93)
├── routes/{rss,llms-txt,scenario-index}.ts
├── gherkin/generate.mjs         # index leaf rejection (240-251)
└── remark/glossary-autolink.internal.ts  # isGuardType (70-78)
src/layouts/Hub.astro            # address at :60
src/scripts/check-links.mjs      # config sourcing, collisions in --strict, default removed
src/tests/                       # route-table, route-feeds, route-shaping, check-links-tightened,
                                 # gherkin-generate, glossary-autolink, + new guard test
example/src/content.config.ts    # drop loader indexBasename
docs/adr/0050-*.md, docs/guides/consumer-setup.md, CHANGELOG.md
```

**Structure Decision**: single package; all changes inside `src/lib`, `src/scripts`,
`src/tests`, the example site's content config, and docs.

## Complexity Tracking

None.

## Implementation Concern Map

| IC | Concern | Issues / FRs | Depends on |
|----|---------|--------------|-----------|
| IC-01 | Index names set once | #136 / FR-007, FR-008 | none |
| IC-02 | Route-keyed collisions | #135, #137 / FR-004, FR-005, FR-006 | IC-01 (check-links names) |
| IC-03 | Sidebar on shared walk and rule, `_meta` excluded | #138 / FR-009, FR-010 | IC-02 (collision model, walk) |
| IC-04 | Address builders onto `routeOfSlug` + guard | #134 / FR-001, FR-002, FR-003 | none (lands before or after IC-02) |
| IC-05 | Glossary autolinker guard | #139 / FR-011 | none |
| IC-06 | ADR-0050, changelog, consumer guide | FR-012 | IC-01..IC-05 content final |

### IC-01 — Index names set once

- **Purpose**: one setting for index names, read by the loader and the link check (S1, S2).
- **Relevant requirements**: FR-007, FR-008; contracts `index-basename-config.md`, `check-links-index-names.md`.
- **Affected surfaces**: `src/lib/config.ts` (`defineDocKittyIntegrations`: publish `DK_INDEX_BASENAME`, run `validateIndexBasenames` always), `src/lib/schema.ts` (`docKittyDocsLoader`), `src/scripts/check-links.mjs` (config sourcing, source line, mismatch exit, remove `DEFAULT_CHECK_INDEX_BASENAMES`), `example/src/content.config.ts`, `package.json` `validate:links` (unchanged args; verify).
- **Sequencing/depends-on**: none.
- **Risks**: env leakage across vitest files (restore in `afterEach`); `runnerImport` cost and behaviour with custom Vite config (unverified for aliases); the check's default changes from `README,index` to `README`, which changes non-strict folder-link hints for `docs/` (run `validate:links` before/after and compare); consumption test must exercise a site without `docKittyDocsLoader` (US3 sc6).
- **Red first**: (1) config-only `['index']` fixture: loader routes `x/index.md` at `/x/` (fails today: loader uses `README`); (2) loader given `['index']` with integration `['README']` throws naming both; (3) `check-links --strict` with no flag on a fixture site whose config sets `['index']` resolves a folder link (fails today: default disagrees); (4) disagreeing flag exits 2, matching flag passes on the same fixture.

### IC-02 — Route-keyed collisions

- **Purpose**: two files on one route fail the build and the strict check with one message (S3).
- **Relevant requirements**: FR-004, FR-005, FR-006, NFR-003; contract `collision-error.md`.
- **Affected surfaces**: `vocabulary-core.mjs` (`groupIndexCollisions` -> route grouping, `resolveIndexEntries` loses demotion, `buildRouteTable`, new `formatRouteCollisions`), `config.ts` base-absolute-links `astro:config:setup` (~478) throws, `schema.ts` `resolveIds` throws instead of `console.warn`, `check-links.mjs` strict path, `gherkin/generate.mjs:245` (reject leaf `index` always), `validate-frontmatter.mjs` if it still reports `IndexCollision` (verify).
- **Sequencing/depends-on**: IC-01 for the names the strict check uses.
- **Risks**: tests that pin today's winner/demote behaviour (`route-table.test.ts`, loader E-05 tests) must be rewritten, not deleted silently; ADR-0048 generated-page collision wording must stay for that case; case-insensitive grouping is broader than index files (S4 found no hits).
- **Red first**: README-only `x/README.md` + `x/index.md` builds today (fixture through `buildRouteTable` + loader) and passes `check-links --strict` today; root pair; `.md`+`.mdx` same stem; draft-involved pair with drafts on and off; `x/index.feature` generates today on README-only; positive controls `x/README.md` alone and `x/other.feature`.

### IC-03 — Sidebar on the shared walk and rule, `_meta` excluded

- **Purpose**: the sidebar decides folder index pages with the route rule and reads the same file list as everything else.
- **Relevant requirements**: FR-009, FR-010; decision `01M4WE30W61BS7CG5D0KH99T0T`.
- **Affected surfaces**: `docs-walk.mjs` (exclude `_meta` folders at any depth and `_meta.md`/`.mdx`), `schema.ts` `DEFAULT_DOCS_PATTERN` (matching negations; the pattern-equality guard moves with it), `config.ts` `directoryMetaInputs` (use `walkMarkdownPaths`; `isIndex` = route is the folder route, via `routeOfSlug`), `topLevelContentDirs` (keep `_meta` skip; same rule).
- **Sequencing/depends-on**: IC-02 (no demotion model left; `isIndex` follows routes).
- **Risks**: sidebar labels in the example could change if any folder relies on today's `isIndex` (S4: none with collisions; verify by NFR-001 byte diff); Playwright a11y baselines on sidebar markup; catalog loaders must still load `_meta/*.yaml` (positive control).
- **Red first**: `['index']` with draft `x/README.md` + published `x/index.md`, drafts off: folder label is the raw name today; `['README']` with draft `x/README.md` + `x/other.md`; `_meta/x.md` gets a route today; bibliography still loads.

### IC-04 — Address builders onto `routeOfSlug`, with a guard

- **Purpose**: no surface advertises `/<id>/index/` or `/index/`.
- **Relevant requirements**: FR-001, FR-002, FR-003, NFR-001, NFR-002.
- **Affected surfaces**: `metadata.ts:331` (`routeFor` removed; `toAgentRecord.route`, `resolveRelated`), `routes/rss.ts:46`, `routes/llms-txt.ts:145`, `routes/scenario-index.ts:370`, `route-shaping.ts:93`, `layouts/Hub.astro:60`, `components/slots/OnThisPage.astro` and `Related.astro` (through `resolveRelated`); new guard test scanning `src/lib/**`, `src/layouts/**`, `src/components/**` for `` `/${…slug|id}/` `` outside `vocabulary-core.mjs`.
- **Sequencing/depends-on**: none.
- **Risks**: agent-API `route` field is a committed contract read by `assert-build-artifacts.mjs` (BA-3) and `agent-api.test.ts`; example output changes only for `plans/index.md` pages (list them for NFR-001); determinism gate must stay green; the guard must not match comments.
- **Red first**: fixture with id `guide/index` through each route module (rss, llms-txt, scenario-index, agent record, `resolveRelated`, Hub href) shows `/guide/index/` today; reserved id `index` through `resolveRelated` shows `/index/` today; `guide/setup` unchanged; guard fails on a planted `` `/${slug}/` `` file.

### IC-05 — Glossary autolinker guard

- **Purpose**: no link inside a reference-style link.
- **Relevant requirements**: FR-011.
- **Affected surfaces**: `src/lib/remark/glossary-autolink.internal.ts:70-78` (`linkReference`, `definition` added to `isGuardType`), `src/tests/glossary-autolink.test.ts`.
- **Sequencing/depends-on**: none; independent work package (operator decision 1).
- **Risks**: first-per-section autolink: a skipped occurrence inside a link must not consume the section's "first" slot (check current behaviour with the inline-link case and match it).
- **Red first**: `[term][ref]` plus a definition renders nested links today; same term in plain text on the same fixture still autolinks.

### IC-06 — ADR, changelog and consumer guide

- **Purpose**: record the decisions and give adopters one upgrade pass.
- **Relevant requirements**: FR-012, C-002, C-003, C-006.
- **Affected surfaces**: `docs/adr/0050-route-collisions-and-single-index-setting.md` (amends 0047, 0048; references 0033, 0018 for `_meta`): route-keyed fatal collisions, case-insensitive grouping, env seam, check-links sourcing, `_meta` everywhere, `index.feature`; `CHANGELOG.md` `[Unreleased]` Breaking (collisions fatal; loader/flag mismatch fatal; check default `README`; `_meta` markdown unpublished; `index.feature` rejected) and Fixed (#134, #138, #139); `docs/guides/consumer-setup.md`; `docs/architecture/glossary.md`/`gherkin-pages.md` where they describe `indexBasename` in two places.
- **Sequencing/depends-on**: IC-01..IC-05 (wording follows final behaviour). Changelog text is rewritten by comms-cleo before the PR is ready.
- **Risks**: ADR line-start issue numbers (see commit 93f86c8); doc-sanity gates on new ADR frontmatter; generated ADR index must be regenerated, not hand-edited.

## Operator decisions (resolved 2026-10-14)

1. **Flag comparison order** — the flag matches when it lists the same set of names, in any order; the check uses the config's order (decision `01M4WENQAJN2S0N7WXR12F7YY4`).
2. **Case-insensitive route collisions** — case-only collisions between ordinary pages fail, like any other collision (decision `01M4WENRXTXVQ7MEFV7EQXFMB2`).
