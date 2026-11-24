# Tasks: Large hubs: sidebar child cap

**Mission**: `large-hubs-sidebar-child-cap-01M81KGV`
**Branch**: planning base and merge target `feat/341-sidebar-child-cap` (draft PR to `main`, operator merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/cap-api.md](contracts/cap-api.md), [quickstart.md](quickstart.md)

Five work packages, one per concern in the plan. They run in sequence: each builds on the types and data of the one before.

```
WP01 ─► WP02 ─► WP03 ─► WP04 ─► WP05
```

Shared-file ownership: `src/lib/child-cap.ts` (new, the pure cap API) → WP01; `src/lib/integrations/route-shaping.ts` and the module types → WP02; `src/lib/route-shaping.ts` and `route-middleware.ts` → WP03. WP03 re-exports the WP01 API from `route-shaping.ts` so #342 has one import path.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red first: resolver, hint, label and validation tests | WP01 | |
| T002 | `child-cap.ts`: `DEFAULT_CHILD_CAP`, `resolveChildCap`, `cappedChildHidden`, `resolveCappedLabel`, `HubCap` types | WP01 | |
| T003 | Site option `sidebar.childCap` / `sidebar.cappedLabel` split and validated in `config.ts` | WP01 | |
| T004 | Section `sidebar.childCap` in `sections.ts` (both registry paths) | WP01 | |
| T005 | Frontmatter `sidebar_child_cap` in `schema.ts` and `validate-frontmatter.mjs` | WP01 | |
| T006 | UI string `dockitty.sidebar.cappedEntry` in `i18n-plugin.ts` | WP01 | |
| T007 | Red first: hub data from a fixture tree (count, order, drafts, sub-folders, levels) | WP02 | |
| T008 | Read `sidebar_child_cap`, `doc_status`, `sidebar.label` in the build-time page read | WP02 | |
| T009 | Build `hubCaps` with `selectHubChildren` and `resolveChildCap`; only hubs over their cap | WP02 | |
| T010 | Serialise `hubCaps` and `cappedLabel` into the virtual module; module types | WP02 | |
| T011 | Red first: capped group, current marking, pagination, relabel and icon cases | WP03 | |
| T012 | Capped group in `shapeSidebar` (`hubCaps`, `cappedLabel`, `currentSlug` options; `dkCappedHub` marker) | WP03 | |
| T013 | `expandCappedGroups` and the pre-hidden branch of `shapePagination` | WP03 | |
| T014 | `relabelledLinks` and `decorateSidebarIcons` skip the capped entry | WP03 | |
| T015 | Middleware wiring; re-export the cap API from `route-shaping.ts` | WP03 | |
| T016 | Capture the uncapped goldens on the base commit | WP04 | |
| T017 | Build suite: 200-child fixture, cap+2, current, prev/next, hint equivalence, goldens | WP04 | |
| T018 | Example capped hub `example/docs/guides/capped-hub/` | WP04 | |
| T019 | Playwright + axe on the example capped hub | WP04 | |
| T020 | Measurement script on a 1,000-child fixture | WP04 | |
| T021 | Configuration guide `docs/guides/sidebar-child-cap.md` | WP05 | |
| T022 | Consumer setup and authoring cross-references | WP05 | |
| T023 | Dogfood `adr` section cap; measurements into the plan doc | WP05 | |
| T024 | Changelog fragment | WP05 | |

## WP01 — Cap settings and resolution

Prompt: [tasks/WP01-cap-settings-and-resolution.md](tasks/WP01-cap-settings-and-resolution.md). Priority P1. Independent test: unit tests on the resolver and on config, section and frontmatter validation.

T001 Red first: resolver, hint, label and validation tests (WP01)
T002 `child-cap.ts` pure API (WP01)
T003 Site option split and validation (WP01)
T004 Section `sidebar.childCap` (WP01)
T005 Frontmatter `sidebar_child_cap` (WP01)
T006 UI string `dockitty.sidebar.cappedEntry` (WP01)

Dependencies: none. Risks: the object-form `sidebar` unknown-key message lists the keys; existing tests pin it.

## WP02 — Build-time hub data

Prompt: [tasks/WP02-build-time-hub-data.md](tasks/WP02-build-time-hub-data.md). Priority P1. Independent test: `routeShapingSource` on a fixture tree.

T007 Red first: hub data tests (WP02)
T008 Extend the page read (WP02)
T009 Build `hubCaps` (WP02)
T010 Serialise and type the module (WP02)

Dependencies: WP01. Risks: uncapped sites must emit an empty `hubCaps`; the module text changes, the HTML must not.

## WP03 — Shaping, current marking and pagination

Prompt: [tasks/WP03-shaping-current-and-pagination.md](tasks/WP03-shaping-current-and-pagination.md). Priority P1. Independent test: pure unit tests on shaped trees.

T011 Red first: shaping tests (WP03)
T012 Capped group in `shapeSidebar` (WP03)
T013 Pagination expansion (WP03)
T014 Relabel and icons skip the capped entry (WP03)
T015 Middleware wiring and re-export (WP03)

Dependencies: WP02. Risks: duplicate hub href (index link and capped entry); pre-hidden current page.

## WP04 — Proof on built output

Prompt: [tasks/WP04-proof-on-built-output.md](tasks/WP04-proof-on-built-output.md). Priority P1. Independent test: the build suite and the Playwright spec.

T016 Uncapped goldens on the base commit (WP04)
T017 Build suite (WP04)
T018 Example capped hub (WP04)
T019 Playwright + axe (WP04)
T020 Measurement script (WP04)

Dependencies: WP03. Risks: existing example tests that count guides pages.

## WP05 — Documentation and dogfood

Prompt: [tasks/WP05-documentation-and-dogfood.md](tasks/WP05-documentation-and-dogfood.md). Priority P2. Independent test: doc-sanity gates and the repo docs build keep every ADR link.

T021 Configuration guide (WP05)
T022 Cross-references (WP05)
T023 Dogfood and measurements (WP05)
T024 Changelog fragment (WP05)

Dependencies: WP04.
