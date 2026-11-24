# Tasks: Large hubs: paged hub listing

**Mission**: `large-hubs-paged-hub-listing-01M84WYV` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Planning base / merge target**: `feat/342-paged-hub-listing` (based on `main`; PR #426 merged)

Red first in every WP: write the test, see it fail for the right reason, then implement. Before every hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck`.

## Subtask Index

| ID | Description | WP | Parallel |
| --- | --- | --- | --- |
| T001 | Pure page-size resolver, paging arithmetic and `hubListingPages` in `child-cap.ts` | WP01 | |
| T002 | Widen the `HubCap` type with optional `capped` and `pageSize` | WP01 | |
| T003 | Frontmatter `hub_page_size` (schema and frontmatter gate) | WP01 | [P] |
| T004 | Section `hub.pageSize` in `sections.ts` | WP01 | [P] |
| T005 | Site option `hub.pageSize` validated in `config.ts` and threaded to the route-shaping options | WP02 | |
| T006 | Pagination UI strings and keys in the i18n plugin | WP01 | [P] |
| T007 | Read the pages in every sidebar mode; emit every published hub | WP02 | |
| T008 | Resolve and emit `capped` and `pageSize` per hub | WP02 | |
| T009 | `page` child collision error for paged hubs | WP02 | |
| T010 | Middleware and OpenAPI follow-up use capped entries only | WP02 | |
| T011 | Consumer-sidebar and locale-folder hub data tests; uncapped goldens unchanged | WP02 | |
| T012 | Extract `HubCardList.astro` from `Hub.astro`, byte-identical | WP03 | |
| T013 | Pure card lookup: listing slice of slugs → hub cards | WP03 | |
| T014 | Pure pagination window and `HubPagination.astro` | WP03 | |
| T015 | `Hub.astro` renders page 1 and the pagination when paged | WP03 | |
| T016 | Pagination styles in `hub.css` | WP03 | [P] |
| T017 | Paged-hubs integration injecting `/[...hub]/page/[page]` | WP04 | |
| T018 | `paged-hub.astro` route: `getStaticPaths` and `StarlightPage` | WP04 | |
| T019 | Fixture site options: page size, consumer sidebar, locale, `page` child | WP04 | |
| T020 | Build test: reachability, canonical, frame, sidebar current, sitemap | WP04 | |
| T021 | Build tests: consumer sidebar, locale, collision, exact multiple, unpaged identity | WP04 | |
| T022 | Agent-index listing records and build-id fold | WP05 | |
| T023 | Per-listing-page agent JSON | WP05 | |
| T024 | `llms.txt` lines for paged pages | WP05 | [P] |
| T025 | Feeds gating and the no-paged-hub byte-identity of the agent surfaces | WP05 | |
| T026 | Example paged hub and updated build-artifact pins and assertions | WP06 | |
| T027 | Broken-link gate proof on pagination links | WP06 | |
| T028 | Playwright: axe, keyboard and search ranking on the pagination | WP06 | |
| T029 | Measurements on the 1,000-child fixture; large-hubs plan doc update (measurements, Q3 change) | WP06 | |
| T030 | Configuration guide `docs/guides/paged-hub-listing.md` | WP07 | [P] |
| T031 | ADR-0089 and cross-references from ADR-0084 and the slice-1 guide | WP07 | |
| T032 | Agent API docs for listing records | WP07 | [P] |
| T033 | Changelog fragment and consumer-setup/authoring cross-references | WP07 | |

## Phase 1 — Foundation

### WP01 — Paging API and page-size settings

**Prompt**: [tasks/WP01-paging-api-and-settings.md](./tasks/WP01-paging-api-and-settings.md)
**Goal**: the pure paging API, the hub and section page-size settings (validated) and the pagination UI strings. The site option is in WP02, which owns `config.ts`. Priority P1. **Independent test**: unit tests on the exported functions and on each settings level.
**Dependencies**: none

T001 Pure page-size resolver, paging arithmetic and `hubListingPages` in `child-cap.ts` (WP01)
T002 Widen the `HubCap` type with optional `capped` and `pageSize` (WP01)
T003 Frontmatter `hub_page_size` (schema and frontmatter gate) (WP01)
T004 Section `hub.pageSize` in `sections.ts` (WP01)
T006 Pagination UI strings and keys in the i18n plugin (WP01)

### WP02 — Hub data for every hub (#429)

**Prompt**: [tasks/WP02-hub-data-every-hub.md](./tasks/WP02-hub-data-every-hub.md)
**Goal**: one resolved entry per published `kind: Hub` hub in every sidebar mode, with `capped` and `pageSize`, plus the `page` collision error. The sidebar output is unchanged. Priority P1. **Independent test**: generate the route-shaping module source for fixtures in both sidebar modes.
**Dependencies**: WP01

T005 Site option `hub.pageSize` validated in `config.ts` and threaded to the route-shaping options (WP02)
T007 Read the pages in every sidebar mode; emit every published hub (WP02)
T008 Resolve and emit `capped` and `pageSize` per hub (WP02)
T009 `page` child collision error for paged hubs (WP02)
T010 Middleware and OpenAPI follow-up use capped entries only (WP02)
T011 Consumer-sidebar and locale-folder hub data tests; uncapped goldens unchanged (WP02)

Risks: the site option must be threaded, not just validated (slice 1's WP01 was sent back for exactly that). An uncapped hub leaking into `shapeSidebar` would change the sidebar. The slice-1 build suite and its goldens are the guard.

## Phase 2 — The listing

### WP03 — Hub page and pagination markup

**Prompt**: [tasks/WP03-hub-page-and-pagination.md](./tasks/WP03-hub-page-and-pagination.md)
**Goal**: the card list and the pagination are components. A paged hub's own page lists page 1 and the pagination; an unpaged hub is byte-identical. Priority P1. **Independent test**: unit tests on the pure helpers, and the hub-block-order and slice-1 build suites unchanged.
**Dependencies**: WP02

T012 Extract `HubCardList.astro` from `Hub.astro`, byte-identical (WP03)
T013 Pure card lookup: listing slice of slugs → hub cards (WP03)
T014 Pure pagination window and `HubPagination.astro` (WP03)
T015 `Hub.astro` renders page 1 and the pagination when paged (WP03)
T016 Pagination styles in `hub.css` (WP03)

### WP04 — Paged route `/<hub>/page/N/`

**Prompt**: [tasks/WP04-paged-route.md](./tasks/WP04-paged-route.md)
**Goal**: pages 2 onwards in the Starlight frame, proven on a 200-child built fixture. Priority P1. **Independent test**: the new build-tier suite.
**Dependencies**: WP03

T017 Paged-hubs integration injecting `/[...hub]/page/[page]` (WP04)
T018 `paged-hub.astro` route: `getStaticPaths` and `StarlightPage` (WP04)
T019 Fixture site options: page size, consumer sidebar, locale, `page` child (WP04)
T020 Build test: reachability, canonical, frame, sidebar current, sitemap (WP04)
T021 Build tests: consumer sidebar, locale, collision, exact multiple, unpaged identity (WP04)

## Phase 3 — Machine surfaces (parallel with Phase 2)

### WP05 — Agent API and llms.txt

**Prompt**: [tasks/WP05-agent-surfaces.md](./tasks/WP05-agent-surfaces.md)
**Goal**: each paged page appears once in the agent index (with a per-page JSON) and in `llms.txt`, with children never repeated. Priority P2. **Independent test**: route-level unit tests with `astro:content` and the route-shaping module mocked.
**Dependencies**: WP02

T022 Agent-index listing records and build-id fold (WP05)
T023 Per-listing-page agent JSON (WP05)
T024 `llms.txt` lines for paged pages (WP05)
T025 Feeds gating and the no-paged-hub byte-identity of the agent surfaces (WP05)

## Phase 4 — Proof and documentation

### WP06 — Example, gates, accessibility and measurements

**Prompt**: [tasks/WP06-example-gates-a11y.md](./tasks/WP06-example-gates-a11y.md)
**Goal**: the deployed example has a paged hub, and the artifact gates, the link gate, axe, keyboard and search checks pass on it. NFR-001 and NFR-002 are measured. Priority P2.
**Dependencies**: WP04, WP05

T026 Example paged hub and updated build-artifact pins and assertions (WP06)
T027 Broken-link gate proof on pagination links (WP06)
T028 Playwright: axe, keyboard and search ranking on the pagination (WP06)
T029 Measurements on the 1,000-child fixture; large-hubs plan doc update (measurements, Q3 change) (WP06)

### WP07 — Documentation and ADR

**Prompt**: [tasks/WP07-documentation-and-adr.md](./tasks/WP07-documentation-and-adr.md)
**Goal**: a configuration page, ADR-0089, agent-API docs and a changelog fragment. Priority P2.
**Dependencies**: WP04, WP05

T030 Configuration guide `docs/guides/paged-hub-listing.md` (WP07)
T031 ADR-0089 and cross-references from ADR-0084 and the slice-1 guide (WP07)
T032 Agent API docs for listing records (WP07)
T033 Changelog fragment and consumer-setup/authoring cross-references (WP07)

## Dependency graph and lanes

```
WP01 ─► WP02 ─┬─► WP03 ─► WP04 ─┬─► WP06
              └─► WP05 ─────────┴─► WP07
```

WP05 runs in parallel with WP03 and WP04. WP06 and WP07 run in parallel at the end.
MVP: WP01–WP04 deliver the user-visible listing (US1–US3, US5, US6).
