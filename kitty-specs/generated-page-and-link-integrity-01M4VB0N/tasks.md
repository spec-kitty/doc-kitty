# Tasks: Generated pages and relative links hold up for consumers

**Mission**: `generated-page-and-link-integrity-01M4VB0N`
**Branch**: planning and merge target `fix/generated-page-and-link-integrity` (draft PR to `main`, owner merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/public-surface.md](contracts/public-surface.md), [quickstart.md](quickstart.md)

Seven work packages. WP01 builds the shared route rule that everything else calls. WP02, WP03 and WP04 run in sequence because each makes small edits to `src/lib/config.ts`; WP01 owns that file and the others make named, recorded edits after it lands. WP05 needs only WP01 and can run beside them.

```
WP01 ─► WP02 ─► WP03 ─► WP04 ─┬─► WP06
  │                             │
  └────────────► WP05 ──────────┴─► WP07   (WP07 needs WP02 to WP05)
```

WP04, WP05 and the link halves of WP06 and WP07 are the #131 work and can be cut without undoing WP01 to WP03 (C-005).

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Move `readmeToIndexId` and `resolveIndexEntries` to `vocabulary-core.mjs`; keep `metadata.ts` exports | WP01 | |
| T002 | Add `routeOfSlug`, `generatedIndexBasename`, `buildRouteTable`, `resolveRelativeDocLink` | WP01 | |
| T003 | Hoist the loader walk to a shared `.mjs` | WP01 | |
| T004 | Converge `draftRoutesOf`, `directoryMetaInputs`, `detectIndexCollisions`, Gherkin `hubBasename` | WP01 | |
| T005 | Agreement test and parity-test cleanup | WP01 | |
| T006 | Red-first: rewrite the warn-and-delete test to expect a stop | WP02 | |
| T007 | Guard in `generateFeaturePages` with the FR-002 message | WP02 | |
| T008 | Register `allowEmpty` in options, config types and pass-through | WP02 | |
| T009 | `--allow-empty` in the CLI | WP02 | |
| T010 | Scenario tests and a real setting/flag parity assertion | WP02 | |
| T011 | Red-first: glossary routes under the default index name | WP03 | |
| T012 | Thread `indexBasename` into the generator; target-name rule | WP03 | |
| T013 | Stop on an authored file at a target path | WP03 | |
| T014 | Guarded prune of stale generated pages | WP03 | |
| T015 | Update direct callers and pins | WP03 | |
| T016 | Red-first plugin tests through the real Markdown processor | WP04 | |
| T017 | The `relative-md-links` remark plugin | WP04 | |
| T018 | Wire it into `baseAbsoluteLinksIntegration` with a JSON route table | WP04 | |
| T019 | Pipeline parity classifier and `.mdx` coverage | WP04 | |
| T020 | Freshness: the table is in the config digest | WP04 | |
| T021 | Red-first: a resolvable relative link is accepted, a non-page target is reported | WP05 | |
| T022 | Resolve relative Markdown links through the shared route table | WP05 | |
| T023 | Reference-style definitions | WP05 | |
| T024 | `--strict` and `--index-basename` | WP05 | |
| T025 | Update pinned classifications | WP05 | |
| T026 | Move the fixture to the default index name | WP06 | |
| T027 | Add relative Markdown links in both forms | WP06 | |
| T028 | Assert the glossary routes and the rewritten hrefs | WP06 | |
| T029 | Pass `--strict --index-basename` to the proof's source check | WP06 | |
| T030 | ADR-0047: relative Markdown links are an accepted authored form | WP07 | |
| T031 | ADR-0048 for generated page names and empty sources; architecture pages | WP07 | |
| T032 | Consumer-setup guide | WP07 | |
| T033 | Changelog for 0.3.0 | WP07 | |
| T034 | Regenerate the ADR index and run the docs gates | WP07 | |

## Phase 1 — Foundation

### WP01 — Shared route rule and one docs walk

**Prompt**: [tasks/WP01-shared-route-rule.md](tasks/WP01-shared-route-rule.md)
**Goal**: One pure file-to-route rule and one docs walk, used by the loader, draft handling, sidebar inputs and the Gherkin generator. No output change for the example or the fixture.
**Independent test**: `route-table.test.ts` agreement case is red before the convergence and green after; existing metadata, index-basename, draft-publication and gherkin-generate tests stay green.
**Dependencies**: none
**Requirements**: FR-010, NFR-001, NFR-004, C-002

**Subtasks**:

T001 Move `readmeToIndexId` and `resolveIndexEntries` to `vocabulary-core.mjs`; keep `metadata.ts` exports (WP01)
T002 Add `routeOfSlug`, `generatedIndexBasename`, `buildRouteTable`, `resolveRelativeDocLink` (WP01)
T003 Hoist the loader walk to a shared `.mjs` (WP01)
T004 Converge `draftRoutesOf`, `directoryMetaInputs`, `detectIndexCollisions`, Gherkin `hubBasename` (WP01)
T005 Agreement test and parity-test cleanup (WP01)

## Phase 2 — Generated pages (#122, #129)

### WP02 — Gherkin empty-source guard and allowEmpty

**Prompt**: [tasks/WP02-gherkin-empty-source-guard.md](tasks/WP02-gherkin-empty-source-guard.md)
**Goal**: Stop the build on empty Gherkin sources when generated pages exist; `gherkin.allowEmpty` and `--allow-empty` opt out.
**Independent test**: `gherkin-generate.test.ts` empty-source case throws and leaves the tree untouched; CLI write mode exits 1, `--allow-empty` exits 0, `--check` unchanged.
**Dependencies**: WP01
**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-004a, FR-005, C-004

**Subtasks**:

T006 Red-first: rewrite the warn-and-delete test to expect a stop (WP02)
T007 Guard in `generateFeaturePages` with the FR-002 message (WP02)
T008 Register `allowEmpty` in options, config types and pass-through (WP02)
T009 `--allow-empty` in the CLI (WP02)
T010 Scenario tests and a real setting/flag parity assertion (WP02)

### WP03 — Glossary index file name and guarded prune

**Prompt**: [tasks/WP03-glossary-index-name-and-prune.md](tasks/WP03-glossary-index-name-and-prune.md)
**Goal**: Glossary pages are section indexes on any index-name setting; stale generated pages are removed, authored pages never.
**Independent test**: Generated files map to routes `glossary` and `glossary/<slug>` under the default index name; existing `index.md` pins stay byte-identical for sites listing `index`.
**Dependencies**: WP01, WP02
**Requirements**: FR-006, FR-007, FR-008, FR-009, NFR-002, C-003

**Subtasks**:

T011 Red-first: glossary routes under the default index name (WP03)
T012 Thread `indexBasename` into the generator; target-name rule (WP03)
T013 Stop on an authored file at a target path (WP03)
T014 Guarded prune of stale generated pages (WP03)
T015 Update direct callers and pins (WP03)

## Phase 3 — Relative links (#131, severable)

### WP04 — Relative Markdown link rewrite at build

**Prompt**: [tasks/WP04-relative-md-link-rewrite.md](tasks/WP04-relative-md-link-rewrite.md)
**Goal**: A remark plugin rewrites relative `.md`/`.mdx` links to based routes; the route table rides in the Astro config digest so links never go stale.
**Independent test**: Through the real Markdown processor, `../adr/0001-x.md#status` from `context/product.md` with base `/site` renders `href="/site/adr/0001-x/#status"`.
**Dependencies**: WP01, WP03
**Requirements**: FR-011, FR-012, FR-013, FR-014, FR-021, C-007

**Subtasks**:

T016 Red-first plugin tests through the real Markdown processor (WP04)
T017 The `relative-md-links` remark plugin (WP04)
T018 Wire it into `baseAbsoluteLinksIntegration` with a JSON route table (WP04)
T019 Pipeline parity classifier and `.mdx` coverage (WP04)
T020 Freshness: the table is in the config digest (WP04)

### WP05 — Source link check agrees with the build

**Prompt**: [tasks/WP05-check-links-agrees-with-build.md](tasks/WP05-check-links-agrees-with-build.md)
**Goal**: `dockitty-check-links` accepts a relative Markdown link exactly when the build resolves it; `--strict`, `--index-basename`, reference definitions.
**Independent test**: On a non-example tree with no flag, a relative link to a page passes and one to a non-page is reported; `check-links docs example/docs` exits 0.
**Dependencies**: WP01
**Requirements**: FR-015, FR-016, FR-017

**Subtasks**:

T021 Red-first: a resolvable relative link is accepted, a non-page target is reported (WP05)
T022 Resolve relative Markdown links through the shared route table (WP05)
T023 Reference-style definitions (WP05)
T024 `--strict` and `--index-basename` (WP05)
T025 Update pinned classifications (WP05)

## Phase 4 — Proof and records

### WP06 — Consumer proof on the default index name with both link forms

**Prompt**: [tasks/WP06-consumer-proof.md](tasks/WP06-consumer-proof.md)
**Goal**: The packaged-toolkit consumer site runs on the default index name with both link forms and asserts the glossary routes and rewritten hrefs. Verified by CI only.
**Independent test**: CI Consumption test passes with the new assertions; `url-baseline.txt` and the lockfile are unchanged.
**Dependencies**: WP03, WP04, WP05
**Requirements**: FR-020, SC-002, SC-003, SC-004

**Subtasks**:

T026 Move the fixture to the default index name (WP06)
T027 Add relative Markdown links in both forms (WP06)
T028 Assert the glossary routes and the rewritten hrefs (WP06)
T029 Pass `--strict --index-basename` to the proof's source check (WP06)

### WP07 — Decision record, adopter documentation and changelog

**Prompt**: [tasks/WP07-records-and-docs.md](tasks/WP07-records-and-docs.md)
**Goal**: ADR-0047 amends ADR-0037 and ADR-0048 amends ADR-0026 and ADR-0046, as new records; guide, architecture pages and the 0.3.0 changelog match the shipped behaviour.
**Independent test**: Frontmatter validation, source link check and ADR-index check pass on `docs`; no existing ADR has a diff.
**Dependencies**: WP02, WP03, WP04, WP05
**Requirements**: FR-018, FR-019, C-001, C-006

**Subtasks**:

T030 ADR-0047: relative Markdown links are an accepted authored form (WP07)
T031 ADR-0048 for generated page names and empty sources; architecture pages (WP07)
T032 Consumer-setup guide (WP07)
T033 Changelog for 0.3.0 (WP07)
T034 Regenerate the ADR index and run the docs gates (WP07)

## Notes

- NFR-003 (build time) is an observation recorded in the pull request by the mission driver, not a work-package gate.
- NFR-001, NFR-004 and SC-006 (the built example is byte-identical and deterministic) have no work-package owner: no work package can build the example locally. The mission driver compares the built example from CI on `main` and on the head, and records the result, or that it could not be compared, in the pull request.
- If the #131 work is cut (C-005): WP04 and WP05 are dropped, WP06 keeps T026 and the glossary half of T028 and depends on WP03 only, and WP07 drops T030 and the link parts and depends on WP02 and WP03. `resolveRelativeDocLink`, `unpublishedDraftPaths` and their tests in WP01 would then be unused; that is accepted and noted in the pull request.
- NFR-005 and NFR-006 apply to every work package: no existing gate is weakened, and each new test must fail when its fix is reverted.
- Build-level gates (example artifacts, built-link gate, accessibility, consumer proof) cannot run locally here; the draft pull request's CI is their verifier.
