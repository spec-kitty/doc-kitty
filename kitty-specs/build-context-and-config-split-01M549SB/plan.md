# Implementation Plan: One owner for build state, a smaller config.ts, and an honest agent API

**Branch**: `chore/build-context-and-config-split` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)
**Input**: `kitty-specs/build-context-and-config-split-01M549SB/spec.md` (issues #115, #103)

## Summary

1. Fix the docs that name `/sitemap.xml` (#103).
2. Add `_links` to the agent-API index and to each per-page agent JSON, built in the routes from `absolute(site, …)` hrefs. Optional site-owned surfaces are declared through a route option, and the index stays at version `'2'`.
3. Give draft-publication build state one owner: a per-call `createBuildState()` closure inside `defineDocKittyIntegrations`, shared by the draft-publication and route-shaping integrations. It replaces the options mutation and the `globalThis` warning sink.
4. Move six integrations out of `config.ts` into `src/lib/integrations/`, with shared helpers in a leaf module. Everything public stays re-exported from `config.ts`.
5. Make the env-file reader honour Vite's `envDir` and the active `--mode`, in the build hook and in the gates.
6. Record it all in ADR-0058, with a vocabulary note on "published" and CHANGELOG entries.

## Technical Context

**Language/Version**: TypeScript 5 and plain ESM `.mjs` on Node 20+
**Primary Dependencies**: Astro 5.18.2, Vite 6.4.3, Starlight 0.32.6, `@astrojs/sitemap` (no new dependency)
**Storage**: N/A
**Testing**: vitest, run serially from `src/` (`./node_modules/.bin/vitest run`)
**Target Platform**: build-time Astro integrations (`@spec-kitty/doc-toolkit`, `./config` is the public entry)
**Project Type**: single library package with an example site
**Performance Goals**: none
**Constraints**: spec C-001..C-006; byte-identical example outside `api/index.json` and `api/pages/**`; `./config` export surface unchanged
**Scale/Scope**: about 1,300 lines moved out of `config.ts`, 2 route changes, 1 env resolver, about 12 docs edited, 1 ADR

## Charter Check

- **DIRECTIVE_018 (published contracts):** `_links` is an additive key, so the version stays `'2'`, and ADR-0058 records the rule. PASS.
- **DIRECTIVE_041 (test economy):** new tests are limited to one href-resolution test, one build-state reset test and one env-resolution table. The module moves need no new tests. PASS.
- **Deep modules and extract-then-publish:** the integrations move first and keep their re-exports, then the build state is rewired. PASS.

## Design

### Build-state owner (FR-008, FR-008a)

- `src/lib/build-state.ts` exports `createBuildState()`, which returns `{ unpublishedDirs: string[], unpublishedPaths: string[], warnings: … }` plus setters.
- `defineDocKittyIntegrations` creates one per call and passes it to `draftPublicationIntegration` (the writer) and `routeShapingIntegration` (the reader). The reader serves the virtual module from the state at Vite load time.
- Because it is rebuilt per call, a dev reload or a second config starts empty.
- **Warning sink.** The route-shaping middleware runs in the prerender bundle, a second module instance, so a closure cannot reach it. The preferred design computes the same warnings in the integration from `directoryMetaInputs` and drops the sink. If that is not equivalent, the build-state module owns the one `Symbol.for` channel and documents it. WP02 decides with evidence.

### Module split (FR-009, NFR-004)

| New module | From `config.ts` (main @ ac55bbb6) |
|---|---|
| `src/lib/integrations/shared.ts` (leaf: `siteDraftRoutes`, `normalizeBasePrefix`, other shared helpers) | scattered (~405, ~491) |
| `src/lib/integrations/route-shaping.ts` | ~1714-1906 |
| `src/lib/integrations/draft-publication.ts` | ~1907-2026 |
| `src/lib/integrations/diagrams.ts` | ~675-1216 (fix the file-relative `injectScript` entry path ~1067) |
| `src/lib/integrations/gherkin.ts` | ~1349-1665 |
| `src/lib/integrations/glossary.ts` | ~1241-1348 |
| `src/lib/integrations/markua.ts` | ~1666-1713 |

- `config.ts` keeps the options and types, `defineDocKittyIntegrations`, and re-exports of every moved public symbol.
- **Gate:** a snapshot of the `./config` export names and `typeof` values (NFR-002), taken before WP02 and compared at the end.
- `src/package.json` `files` already ships all of `lib/`.

### Env resolution (FR-010, FR-010a)

- `draft-publication.mjs` gains `resolveEnvSource({ root, envDir, mode })`, which resolves `envDir` against the root as Vite does (`false` means none), and `activeMode({ argv, command })`, which reads `--mode x` / `--mode=x`, else `development`/`production`, and rejects `local`.
- `readEnvFiles` takes the resolved directory.
- The draft-publication hook uses `config.vite.envDir` and `activeMode`.
- The gates keep `--mode` (`takeSiteFlags`). `site-index-names.mjs`'s evaluate child returns `{ names, envDir }`, and gates that use it pass `envDir` on.
- A gate that cannot evaluate the config but finds `envDir` in the config text fails with a named message.

### `_links` (FR-003..005, FR-004a..c)

- Hrefs are built with `absolute(site, …)` (`routes/shared.ts` ~138), the way `url`/`source` are built today.
- **Index top level:** `self`, `llms`, `sitemap` (`sitemap-index.xml`), `scenarios` (only when the injected scenario route is built), plus the declared optional surfaces (`pages`, `rss`, `bibliography`).
- **Index record:** `self` (the per-page JSON, when declared), `html`, `source`, and `related: [{href, title}]` for resolved entries.
- **Per-page JSON:** `self`, `up`, `html`, `source`, `related`.
- Links are added in `agent-index.ts` and `agent-page.ts`, not in `toAgentRecord`.
- `agentIndexRoute` and `agentPageRoute` accept a `links` option that declares the optional surfaces, with defaults matching the example. The example's route files pass it explicitly when the defaults differ.
- **FR-005 test:** build the example and resolve every href against `dist/`.

### Docs (FR-001, FR-006, FR-011..013)

- **Sitemap:** replace every served-path `/sitemap.xml` with `sitemap-index.xml` (and `sitemap-0.xml` where the parts matter): `README.md`, `docs/guides/adopting.md`, `docs/architecture/{generators,overview,agent-first}.md`, `docs/context/convention.md`, `docs/plans/{product,metadata-model}.md`.
- **`_links` docs:** describe the shipped shape in `docs/plans/roadmap.md`, `docs/plans/features/{README,generated-sitemap-and-read-api}.md`, `docs/plans/design-readiness.md` (the relation set is now defined) and the agent-first doc.
- **Vocabulary:** a glossary entry or vocabulary note gives "published" and "emitted" their meanings.
- **ADR-0058:** covers the build-state owner, the split, the env contract, redirect withholding kept static-only, the empty-group rule kept, and additive `_links` with version `'2'`.
- **CHANGELOG:** Added (`_links`) and Changed (the env reader honours `envDir` and `--mode`; affected are sites that set `vite.envDir` or build with a custom `--mode`).

## Work Package Sketch

| WP | Content | Owns | Depends on |
|---|---|---|---|
| WP01 | #103 doc truth: sitemap paths, FR-002 guard | docs listed above (sitemap only) | — |
| WP02 | Leaf module, build state, route-shaping and draft-publication extraction | `config.ts`, `build-state.ts`, `integrations/{shared,route-shaping,draft-publication}.ts`, `route-shaping.ts` | — |
| WP03 | Diagrams extraction | `integrations/diagrams.ts` (config.ts edits out-of-map, sequential) | WP02 |
| WP04 | Gherkin, glossary and Markua extraction, plus the shared integration-name constant | `integrations/{gherkin,glossary,markua}.ts`, the tests that hard-code names | WP03 |
| WP05 | Env resolution | `draft-publication.mjs`, `site-index-names.mjs`, the gate scripts | WP02 |
| WP06 | `_links` | `routes/agent-index.ts`, `routes/agent-page.ts`, example API route files | WP01 |
| WP07 | ADR-0058, `_links` docs, vocabulary, CHANGELOG, NFR gates | ADR, docs, CHANGELOG | all |

## Risks

1. **The warning sink crosses module instances.** WP02 proves the replacement is equivalent, or keeps one owned channel.
2. **Import cycles in the split.** The leaf module imports nothing from `config.ts`; `madge`-style checks are done by reading the import graph.
3. **File-relative paths in moved code** (`injectScript`, `fileURLToPath(import.meta.url)`). WP03 and WP04 grep for `import.meta.url` in each moved block.
4. **Body pins on `api/index.json`.** Existing tests pinning the index body may need the added keys; NFR-003 allows only those changes.
5. **Argv parsing for `--mode`.** It is table-tested, and `--mode` absent keeps today's behaviour.
