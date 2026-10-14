# Tasks: Gherkin test trim and fixes

**Mission**: `gherkin-trim-and-fixes-01M4X4YF`
**Branch**: planning and merge target `issue-156-gherkin-trim-and-fixes` (draft PR to `main`, operator merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/public-surface.md](contracts/public-surface.md), [quickstart.md](quickstart.md), [research/code-grounding.md](research/code-grounding.md)

Six work packages in one chain. The fixes come first because they add tests;
the trim (WP05) judges the final suite; the records (WP06) describe what landed.
WP02 and WP03 both edit `src/lib/gherkin/generate.mjs`, so they run in order.

```
WP01 ─► WP02 ─► WP03 ─► WP04 ─► WP05 ─► WP06
```

Bug-fix discipline for WP01–WP04 (C-005): tidy-first enabler commits, then the
red test committed alone through the existing entry point, then the fix.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Parity test: fixture copies of `book-consignment.feature` equal the example file | WP01 | |
| T002 | Replace the inline copy in `gherkin-feature-core.test.ts` with a fixture read; retire its self-hash test | WP01 | |
| T003 | Red: `@WIP` / `@Deprecated` near-miss rows in `gherkin-feature-core.test.ts` | WP01 | |
| T004 | Fix: near-miss warning in `parseMetadataTags` | WP01 | |
| T005 | Tidy: `serializeHubFrontmatter` takes a status (default `active`) | WP02 | |
| T006 | Red: draft-only directory gets a draft hub, unlinked from its parent | WP02 | |
| T007 | Fix: plan hubs for every directory; status from `publishedDirs` | WP02 | |
| T008 | Determinism row: plan is identical under `DK_PUBLISH_DRAFTS=on` and `off` | WP02 | |
| T009 | Red: `titles` validation rows in `gherkin-options.test.ts` | WP03 | |
| T010 | Fix: `titles` in `GHERKIN_PAGES_KEYS`, `validateGherkinPages`, `normalizeGherkinOptions` | WP03 | |
| T011 | Red + fix: `planFeaturePages` applies `titles` and warns on an unknown key | WP03 | |
| T012 | CLI `--titles <dir>=<title>`; parity test; `package.json` scripts | WP03 | |
| T013 | Thread `titles` through `config.ts` (type + `gherkinIntegration`) | WP03 | |
| T014 | Example: `titles: { hr: 'HR' }`, regenerate `example/docs/behaviour/**` | WP03 | |
| T015 | Red: `doc-kitty:gherkin` `astro:build:done` fails on an advertised, missing scenario index | WP04 | |
| T016 | Fix: `scenario-index-check.mjs` and the hook | WP04 | |
| T017 | Pass rows: both present, neither present, no `llms.txt` | WP04 | |
| T018 | Inventory and verdict table per Gherkin test file | WP05 | |
| T019 | Planted-break proof for every RETIRE (covering guard goes red) | WP05 | |
| T020 | Retire / merge the proven duplicates | WP05 | |
| T021 | Re-run the suites; before/after counts | WP05 | |
| T022 | ADR-0052 and the regenerated ADR index | WP06 | |
| T023 | Consumer guide (Gherkin section + scenario-route sentence), authoring guide, architecture page | WP06 | |
| T024 | Changelog entries | WP06 | |

## WP01 — Worked-example parity and the status-shorthand warning

**Prompt**: [tasks/WP01-parity-and-status-shorthand.md](tasks/WP01-parity-and-status-shorthand.md)
**Goal**: #128 one source of truth for `book-consignment.feature`; #123 near-miss warning.
**Priority**: P1. **Independent test**: `vitest run tests/gherkin-feature-core.test.ts tests/gherkin-fixture-parity.test.ts`.

T001 Parity test (WP01)
T002 Remove the inline fourth copy (WP01)
T003 Red near-miss rows (WP01)
T004 Near-miss warning (WP01)

Dependencies: none. Risks: example must stay warning-free.

## WP02 — Draft hubs for draft-only directories

**Prompt**: [tasks/WP02-draft-only-directory-hubs.md](tasks/WP02-draft-only-directory-hubs.md)
**Goal**: #124 option 1, generation independent of the draft setting.
**Priority**: P1. **Independent test**: `vitest run tests/gherkin-generate.test.ts`.

T005 Hub frontmatter status (WP02)
T006 Red draft-hub rows (WP02)
T007 Plan draft hubs (WP02)
T008 Determinism row (WP02)

Dependencies: WP01. Risks: R3 purity; parent hub must not link a draft hub.

## WP03 — `gherkin.titles`

**Prompt**: [tasks/WP03-gherkin-titles.md](tasks/WP03-gherkin-titles.md)
**Goal**: #125.
**Priority**: P2. **Independent test**: `vitest run tests/gherkin-options.test.ts tests/gherkin-generate.test.ts tests/gherkin-example.test.ts tests/gherkin-check-cli.test.ts`; `pnpm validate:features`.

T009 Red option rows (WP03)
T010 Option validation (WP03)
T011 Titles in the planner (WP03)
T012 CLI flag and scripts (WP03)
T013 Integration threading (WP03)
T014 Example and regenerated pages (WP03)

Dependencies: WP02. Risks: config literal parsing in `gherkin-example.test.ts`; sidebar label in screenshots.

## WP04 — Advertised scenario index must exist

**Prompt**: [tasks/WP04-scenario-index-check.md](tasks/WP04-scenario-index-check.md)
**Goal**: #126 option 2 as a build-end check.
**Priority**: P2. **Independent test**: `vitest run tests/gherkin-integration.test.ts`.

T015 Red hook row (WP04)
T016 Check module and hook (WP04)
T017 Pass rows (WP04)

Dependencies: WP03 (both edit `config.ts`). Risks: integration-name pins must not move (no new integration).

## WP05 — Trim the Gherkin suites

**Prompt**: [tasks/WP05-trim-gherkin-suites.md](tasks/WP05-trim-gherkin-suites.md)
**Goal**: #156.
**Priority**: P1 (release gate). **Independent test**: `pnpm test` green; every RETIRE has planted-break evidence.

T018 Inventory and verdicts (WP05)
T019 Planted-break proofs (WP05)
T020 Retire / merge (WP05)
T021 Re-run and counts (WP05)

Dependencies: WP04. Risks: coverage disguised as a duplicate.

## WP06 — Records and adopter docs

**Prompt**: [tasks/WP06-records-and-docs.md](tasks/WP06-records-and-docs.md)
**Goal**: ADR, guides, changelog.
**Priority**: P2. **Independent test**: `pnpm validate:docs`, `pnpm validate:adr-index`, `pnpm validate:links`.

T022 ADR-0052 (WP06)
T023 Guides and architecture page (WP06)
T024 Changelog (WP06)

Dependencies: WP05.
