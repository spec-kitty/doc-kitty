# Tasks: Route rule and index-name consolidation

**Mission**: `route-rule-consolidation-01M4WE27`
**Branch**: planning base and merge target `fix/route-rule-consolidation` (draft PR to `main`, owner merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

Six work packages, one per concern in the plan's Implementation Concern Map. WP01, WP02 and WP03 run in sequence: they all touch `config.ts`, `schema.ts` and `check-links.mjs`, so each shared file has one owner and the other two make small, named edits after it lands. WP04 depends on WP03: its guard scans `config.ts`, which WP03 rewrites, and WP03 adds sidebar cases to WP04's `route-shaping.test.ts`. WP05 has no dependency and runs beside them. WP06 writes the records once the behaviour is final.

```
WP01 ─► WP02 ─► WP03 ─► WP04 ─┐
WP05 ─────────────────────────┴─► WP06
```

Shared-file ownership: `src/scripts/check-links.mjs` and `src/lib/schema.ts` -> WP01; `src/lib/vocabulary-core.mjs` -> WP02; `src/lib/config.ts` -> WP03. Named out-of-map edits: WP01 in `config.ts` (env publish, validation); WP02 in `schema.ts` (`resolveIds` throw), `config.ts` (`:~478` throw), `check-links.mjs` (strict collision report), `check-links-tightened.test.ts`; WP01 in `validate-frontmatter.mjs` (index-name resolution only); WP02 also in `draft-publication.mjs` (comment) and the moved pins in `schema-validator-parity`, `section-type-parity`, `gherkin-check-cli` tests; WP03 in `schema.ts` (`DEFAULT_DOCS_PATTERN` negations), `route-table.test.ts`, `route-shaping.test.ts` (sidebar cases), `check-links-tightened.test.ts` (`_meta` case); WP04 in `config.ts`, `draft-publication.mjs`, `favicon.ts`, `deck/deck-slug.ts` (non-address expressions rewritten so the guard does not match). One shared resolver `resolveSiteIndexBasenames(root)` (`src/scripts/site-index-names.mjs`, WP01) serves every CLI that takes index names.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red first: loader, check and flag disagreements | WP01 | |
| T002 | Publish index names from the integration (`DK_INDEX_BASENAME`) | WP01 | |
| T003 | Loader reads the published names lazily; mismatch error | WP01 | |
| T004 | check-links reads the site config with `runnerImport`; source line; default `README` | WP01 | |
| T005 | `--index-basename` must agree (order-insensitive) | WP01 | |
| T006 | Example config, CLI callers, package/CI flags and fixtures on the single setting | WP01 | |
| T007 | Red first: the collision fixture table | WP02 | |
| T008 | Group collisions by route; drop winner/demotion | WP02 | |
| T009 | One formatter `formatRouteCollisions` | WP02 | |
| T010 | Wire loader, integration and strict check | WP02 | |
| T011 | Reject Gherkin `index.feature` on any setting | WP02 | |
| T012 | Rewrite winner/demote pins and the validator | WP02 | |
| T013 | Red first: sidebar index and `_meta` | WP03 | |
| T014 | The walk excludes `_meta`; loader glob negations | WP03 | |
| T015 | `directoryMetaInputs` on the shared walk and route rule | WP03 | |
| T016 | Example sidebar output unchanged | WP03 | |
| T017 | Clean up readers of the old model | WP03 | |
| T018 | Red first: `/index` and root `index` ids on every listing surface, incl. on-this-page and Related | WP04 | |
| T019 | `metadata.ts` onto `routeOfSlug`; delete `routeFor` | WP04 | |
| T020 | Feeds, scenario index, route shaping, Hub, OnThisPage, Related onto `routeOfSlug` | WP04 | |
| T021 | Guard test against any `` `/${…}/` `` address, no allow-list | WP04 | |
| T022 | Example `dist` diff (NFR-001), build-time medians (NFR-004), BA-3 / agent-API pins | WP04 | |
| T023 | Sweep remaining template addresses | WP04 | |
| T024 | Red first: nested link in reference-style links | WP05 | [P] |
| T025 | Guard `linkReference` and `definition` | WP05 | [P] |
| T026 | First-per-section parity with inline links | WP05 | [P] |
| T027 | ADR-0050 | WP06 | |
| T028 | Regenerate the ADR index | WP06 | |
| T029 | CHANGELOG `[Unreleased]` Breaking and Fixed | WP06 | |
| T030 | Consumer guide and architecture pages | WP06 | |
| T031 | Docs gates | WP06 | |

## Phase 1 — Routing core (sequential)

### WP01 — Index names set once

**Prompt**: [tasks/WP01-index-names-set-once.md](tasks/WP01-index-names-set-once.md)
**Goal**: index names set in `defineDocKittyIntegrations` only; the loader and `dockitty-check-links` read them; disagreements fail with both values.
**Priority**: P2 (spec US3), but first in sequence: WP02's strict check uses these names.
**Independent test**: config-only `['index']` fixture: loader routes `x/index.md` at `/x/`, and `check-links --strict` with no flag agrees; a disagreeing flag exits 2, a matching one passes.
**Dependencies**: none
**Requirements**: FR-007, FR-008, C-004

**Subtasks**:

T001 Red first: loader, check and flag disagreements (WP01)
T002 Publish index names from the integration (`DK_INDEX_BASENAME`) (WP01)
T003 Loader reads the published names lazily; mismatch error (WP01)
T004 check-links reads the site config with `runnerImport`; source line; default `README` (WP01)
T005 `--index-basename` must agree (order-insensitive) (WP01)
T006 Example content config and callers on the single setting (WP01)

**Implementation sketch**: env seam beside `DK_DOCS_ROOT` (research S1); loader reads at `resolveIds()`; check evaluates the site config with Vite `runnerImport` (S2); remove `DEFAULT_CHECK_INDEX_BASENAMES`.
**Parallelism**: runs beside WP05.
**Risks**: env leakage between test files; `runnerImport` with custom Vite aliases unverified; check default change shifts non-strict hints for `docs/`.
**Estimated prompt size**: ~205 lines

### WP02 — Route-keyed collisions stop the build and the strict check

**Prompt**: [tasks/WP02-route-keyed-collisions.md](tasks/WP02-route-keyed-collisions.md)
**Goal**: two files on one route fail the loader, the build and `check-links --strict` with one message; `index.feature` rejected.
**Priority**: P1 (spec US2)
**Independent test**: `x/README.md` + `x/index.md` on a `README`-only site fails the loader and the strict check naming both; `x/README.md` alone passes.
**Dependencies**: WP01
**Requirements**: FR-004, FR-005, FR-006, NFR-003

**Subtasks**:

T007 Red first: the collision fixture table (WP02)
T008 Group collisions by route; drop winner/demotion (WP02)
T009 One formatter `formatRouteCollisions` (WP02)
T010 Wire loader, integration and strict check (WP02)
T011 Reject Gherkin `index.feature` on any setting (WP02)
T012 Rewrite winner/demote pins and the validator (WP02)

**Implementation sketch**: `groupIndexCollisions` keyed by `routeOfSlug(id).toLowerCase()` over all paths (drafts included); `resolveIndexEntries` without demotion; one formatter, three call sites.
**Parallelism**: after WP01; beside WP05.
**Risks**: tests pinning winner/demote must be rewritten deliberately, not deleted; ADR-0048 generated-page wording kept.
**Estimated prompt size**: ~210 lines

### WP03 — Sidebar on the shared walk and route rule, `_meta` excluded

**Prompt**: [tasks/WP03-sidebar-shared-walk-and-meta.md](tasks/WP03-sidebar-shared-walk-and-meta.md)
**Goal**: the sidebar decides folder index pages with `routeOfSlug` and reads `walkMarkdownPaths`; `_meta` excluded everywhere.
**Priority**: P2 (spec US4)
**Independent test**: `['index']`, draft `x/README.md` + published `x/index.md`, drafts off: folder labelled with `index.md`'s title; `_meta/x.md` gets no route while `_meta/bibliography.yaml` still loads.
**Dependencies**: WP02
**Requirements**: FR-009, FR-010

**Subtasks**:

T013 Red first: sidebar index and `_meta` (WP03)
T014 The walk excludes `_meta`; loader glob negations (WP03)
T015 `directoryMetaInputs` on the shared walk and route rule (WP03)
T016 Example sidebar output unchanged (WP03)
T017 Clean up readers of the old model (WP03)

**Implementation sketch**: `_meta` exclusion in `docs-walk.mjs` + matching glob negations; `directoryMetaInputs` uses the walk and `isIndex` = page route equals containing folder's route.
**Parallelism**: after WP02; beside WP05.
**Risks**: a11y baselines on sidebar markup; `x.md` next to folder `x/` must not count as the folder's index.
**Estimated prompt size**: ~170 lines

## Phase 2 — Address builders (after WP03) and the independent glossary fix

### WP04 — Address builders onto the shared route rule, with a guard

**Prompt**: [tasks/WP04-address-builders-and-guard.md](tasks/WP04-address-builders-and-guard.md)
**Goal**: every listing surface gives the served address for `/index` ids and the root; a guard test prevents hand-built addresses.
**Priority**: P1 (spec US1)
**Independent test**: id `guide/index` through RSS, `llms.txt`, scenario index, agent record, `resolveRelated` and the Hub helper shows `/guide/`; `guide/setup` unchanged; the guard flags a planted `` `/${slug}/` ``.
**Dependencies**: WP03
**Requirements**: FR-001, FR-002, FR-003, NFR-001, NFR-002

**Subtasks**:

T018 Red first: `/index` ids on every listing surface (WP04)
T019 `metadata.ts` onto `routeOfSlug`; delete `routeFor` (WP04)
T020 Feeds, scenario index, route shaping, Hub onto `routeOfSlug` (WP04)
T021 Guard test against hand-built addresses (WP04)
T022 Example output list and BA-3 / agent-API pins (WP04)
T023 Sweep remaining template addresses (WP04)

**Implementation sketch**: import `routeOfSlug`; replace each `` `/${slug}/` ``; source-scanning guard with a planted positive control.
**Parallelism**: after WP03; beside WP05.
**Risks**: agent-API `route` contract (BA-3) changes for `plans/index` pages only; guard must ignore comments and base-prefix builders.
**Estimated prompt size**: ~200 lines

### WP05 — Glossary autolinker skips reference-style link text

**Prompt**: [tasks/WP05-glossary-reference-link-guard.md](tasks/WP05-glossary-reference-link-guard.md)
**Goal**: no glossary link inside `[term][ref]`, `[term][]`, `[term]` or a definition; plain text still autolinked.
**Priority**: P3 (spec US5)
**Independent test**: one fixture page: the reference link holds one link; the plain-text occurrence is autolinked.
**Dependencies**: none
**Requirements**: FR-011, SC-004

**Subtasks**:

T024 Red first: nested link in reference-style links (WP05)
T025 Guard `linkReference` and `definition` (WP05)
T026 First-per-section parity with inline links (WP05)

**Implementation sketch**: two node types added to `isGuardType`.
**Parallelism**: fully independent (operator decision 1).
**Risks**: first-per-section count drift; pinned by T026.
**Estimated prompt size**: ~150 lines

## Phase 3 — Records

### WP06 — ADR-0050, changelog and consumer guide

**Prompt**: [tasks/WP06-adr-changelog-and-guide.md](tasks/WP06-adr-changelog-and-guide.md)
**Goal**: decisions recorded in ADR-0050; 0.3.0 Breaking/Fixed entries an adopter can act on; consumer guide on the single setting.
**Priority**: P1 (release blocker for 0.3.0, C-003)
**Independent test**: docs gates green; ADR index regenerated; comms-cleo review of the changelog (C-006) passes before the PR is ready.
**Dependencies**: WP01, WP02, WP03, WP04, WP05
**Requirements**: FR-012, SC-005, C-002, C-003, C-006

**Subtasks**:

T027 ADR-0050 (WP06)
T028 Regenerate the ADR index (WP06)
T029 CHANGELOG `[Unreleased]` Breaking and Fixed (WP06)
T030 Consumer guide and architecture pages (WP06)
T031 Docs gates (WP06)

**Implementation sketch**: write from the merged code; curator-carla drafts, comms-cleo rewrites the changelog.
**Parallelism**: last.
**Risks**: MD018 on issue numbers; hand-edited ADR index; accepted ADRs edited by mistake.
**Estimated prompt size**: ~175 lines
