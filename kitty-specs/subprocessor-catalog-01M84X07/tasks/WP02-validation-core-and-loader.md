---
work_package_id: WP02
title: Validation core and loader
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- NFR-005
- C-001
- C-003
- C-007
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
subtasks:
- T004
- T005
- T006
- T007
- T008
- T009
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
role: implementer
agent: claude
authoritative_surface: src/lib/
create_intent:
- src/lib/subprocessors-core.mjs
- src/lib/subprocessors-iso3166.mjs
- src/lib/subprocessors-loader.mjs
- src/tests/subprocessors-core.test.ts
- src/tests/subprocessors-loader.test.ts
execution_mode: code_change
owned_files:
- src/lib/subprocessors-core.mjs
- src/lib/subprocessors-iso3166.mjs
- src/lib/subprocessors-loader.mjs
- src/tests/subprocessors-core.test.ts
- src/tests/subprocessors-loader.test.ts
- src/tests/fixtures/subprocessors/**
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 - Validation core and loader

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Build the single validation path that every later WP imports:

- a **pure core** (`subprocessors-core.mjs`): no fs, no Astro, no clock;
- a static **ISO 3166-1 alpha-2 list** (`subprocessors-iso3166.mjs`);
- a **bare-Node loader** (`subprocessors-loader.mjs`) that reads the file and the reference data and runs the core.

Requirements: FR-001 to FR-007, NFR-005, C-001, C-003, C-007. Depends on: none.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP02 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

- **Contracts.** `kitty-specs/subprocessor-catalog-01M84X07/data-model.md` and `contracts/subprocessors-catalog.contract.md` are the spec for this WP. The message table there is binding: match its wording.
- **Precedent to copy.** Use the style of `src/lib/measures-core.mjs` and `src/lib/measures-loader.mjs`:
  - `// @ts-check` and JSDoc typedefs;
  - named exports;
  - a `[dk-...]` tag constant;
  - YAML read with the `yaml` package, a BOM ignored, and multi-document files rejected.
- **Measures reuse.** Import `normaliseClassification` and `classificationProblems` from `measures-core.mjs`, and `readMeasuresCatalog` from `measures-loader.mjs`. Do **not** copy measure logic.
- **Ordering.** `compareCodeUnit` from `src/lib/vocabulary-core.mjs` is the repo's string comparator.
- **No new dependency.**
- **Red first.** Write T004 before anything else and see it fail.

## Subtasks

### T004 — Red-first tests and fixtures

**Fixtures.** Create these under `src/tests/fixtures/subprocessors/`. Each one is a docs root with a `_meta/` folder.

- **`valid/docs/_meta/`**:
  - `subprocessors.yaml` with three records:
    - `acme-hosting`, current, every optional field set;
    - `beta-mail`, with `since` in 2027;
    - `gamma-analytics`, with `since` and `until`.
  - `bibliography.yaml` with one entry, `acme-dpa`.
  - No `measures.yaml`, so the shipped default applies. Use real default ids from `measures-default.mjs`.
- **`absent/docs/_meta/`**: no `subprocessors.yaml`. Add a `.gitkeep`.
- **`empty/docs/_meta/subprocessors.yaml`**: holds `[]`.
- **Invalid fixtures**: one directory per case in the contract's message table.

**`subprocessors-core.test.ts`** (pure inputs, no fs). Cover each case in the contract table:
- not a list;
- a record that is not a mapping;
- a missing required field, for **each** of the 6 required fields;
- an unknown field (`untill`);
- a bad id, and a duplicate id;
- an empty string;
- bad dates: `2025-13-01`, `2025-02-30`, `"yesterday"`, a timestamp;
- `until` before `since`;
- `until` equal to `since` (this one is **allowed**);
- an empty `location`, `XX`, lower-case `de`, and a duplicate `NL`;
- an unresolved biblio id, an unresolved tool id, and an unknown reference type;
- an unknown measure.

For **every** rejection, assert the exact message. Pair each rejection with the
valid fixture as a positive control, per tactic `acceptance-criteria-non-vacuity`:
the same checker accepts the valid record.

Also assert:
- the problem order is stable (file order, then field order);
- change derivation and ordering (T008);
- that `null` optional fields are rejected ("must be a non-empty string"), not silently treated as absent.

**`subprocessors-loader.test.ts`**:
- `absent` gives `{ present: false, records: [], changes: [], problems: [] }`;
- `empty` gives present, with 0 records and no problems;
- `valid` gives 3 records, 4 changes, and no problems;
- a YAML syntax error gives the `could not parse YAML:` message;
- a file opening with `---` parses, and a second document is an error;
- a BOM is ignored;
- `since: 2025-01-15` is unquoted, so YAML sees a date. It must come back as the **string** `"2025-01-15"` under `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. Set `process.env.TZ` per test, or use a child process if vitest caches the TZ.

### T005 — `src/lib/subprocessors-iso3166.mjs`

- Export `ISO3166_ALPHA2`, a frozen `Set` of the 249 officially assigned alpha-2 codes.
- Add a header comment that names:
  - the source (the ISO 3166 Maintenance Agency's list of officially assigned codes);
  - the date reviewed;
  - that user-assigned and reserved codes (`AA`, `QM`–`QZ`, `XA`–`XZ`, `ZZ`, `EU`, `UK`) are deliberately absent (research R-03, ⚖ `EU`).
- Keep it alphabetical, one line per ~16 codes.
- Add one test asserting the size is 249, `GB` is in, `UK` is out, and `EU` is out.

### T006 — Core: shape validation

Export `SUBPROCESSORS_TAG = '[dk-subprocessors]'`, `SUBPROCESSOR_FIELDS` (ordered, from the data model) and `REQUIRED_FIELDS`.

Export `parseSubprocessorCatalog(data, source)`, which returns `{ records, problems }`. It checks:

- **Top level.** Must be an array. An empty array is valid.
- **Each entry.**
  - It must be a plain object.
  - The subject is `subprocessor "<id>"` when `id` is a valid string, else `subprocessor #<n>` (1-based).
  - Unknown keys are rejected, one message each, in key order.
  - Required keys must be present.
  - String fields must be non-empty strings, after a trim check. Keep the original value; do not trim it.
- **`id`.** Must match `^[a-z0-9]+(-[a-z0-9]+)*$`. Duplicates are reported on the second and later occurrences.
- **Dates.** Accept a string `YYYY-MM-DD` that is a real calendar day (round-trip check). Also accept a JS `Date` that YAML produced at UTC midnight: convert it with `toISOString().slice(0,10)`, never local getters. Reject anything else. Enforce `until >= since` with string comparison, since the ISO format makes that valid.
- **`location`.** Must be a non-empty array of strings.
  - A code that is all-upper and in the set passes.
  - A code that is lower-case but whose upper case is in the set gets the "write in upper case" message.
  - Any other code gets the "not an assigned" message.
  - Duplicates are rejected.
- **Normalised record.**
  - Keys appear in `SUBPROCESSOR_FIELDS` order, absent keys omitted.
  - Dates are strings.
  - `tom_classification` and `external_references` are kept raw here; T007 checks them.
- **Message format.** Every message is `${SUBPROCESSORS_TAG} ${source}: ${subject}: ${tail}`, except the top-level message, which has no subject.

### T007 — Core: reference checks

Export `subprocessorReferenceProblems(records, refs, source)`.

`refs` is `{ bibliographyIds: ReadonlySet<string>, toolIds: ReadonlySet<string>, measures: ReadonlyMap<string, MeasureRecord>, measuresLabel: string }`.

- **`external_references`.**
  - Each entry must be an inline `{url, title, note?}` or a catalog `{type, id}`. Use the same inline rule as `resolveEntry` in `src/scripts/validate-catalog.mjs`: has `url`, and not both `type` and `id`.
  - `type` must be `biblio` or `tool`, and `id` must be in the matching set.
  - Use the contract messages.
- **`tom_classification`.**
  - Call `classificationProblems(value, refs.measures, `${source}: subprocessor "${id}"`, refs.measuresLabel)`.
  - Pass its messages through **unchanged**. They carry `[dk-measures]`, which is intended: they are the measures core's messages.

Export `normaliseSubprocessorReferences(record, refs)` for the renderers. It does this:
- resolves biblio and tool entries to `{type, id, title, url}`;
- leaves inline entries as `{url, title, note?}`;
- normalises `tom_classification` to `{measure, scope?, note?}` with `normaliseClassification`.

The catalog title and URL lookup needs maps rather than sets. Define
`refs.bibliography: ReadonlyMap<string, {title, url}>` and
`refs.tools: ReadonlyMap<string, {name, url}>`, and derive the id sets from them.
Pick one shape, document it with a JSDoc typedef, and use it consistently.

### T008 — Core: changes

Export `deriveChanges(records)`, which returns a `ChangeEntry[]`:
- one `added` entry per record (`since`);
- one `removed` entry per record with `until`.

Sort by:
1. `date` descending (string compare);
2. `id` ascending (`compareCodeUnit`);
3. kind, with `added` before `removed`.

Return new objects only. The function is pure, with no `Date.now()`.

### T009 — Loader

In `src/lib/subprocessors-loader.mjs`:

- **`SUBPROCESSORS_REGISTRY_RELPATH`**: `path.join('_meta', 'subprocessors.yaml')`.
- **`readSubprocessorCatalog(docsRoot, sourceLabel?)`**:
  - Uses `stat` for the absent case.
  - Reads the file and parses it with `yaml`, as `measures-loader.mjs` does.
  - Returns `{ present, source, records, problems }`.
  - `sourceLabel` defaults to the path relative to `process.cwd()`, with POSIX separators.
- **`readCitationRefs(docsRoot)`**:
  - A lenient read of `_meta/bibliography.yaml` and `_meta/tools.yaml`.
  - Returns the T007 maps.
  - Malformed records are **skipped silently**, because the existing citation checks already report them. Do not double-report.
  - Uses the same YAML engine.
- **`checkSubprocessorCatalog(docsRoot, sourceLabel?)`**: the one entry point for both callers. It:
  1. reads the catalog;
  2. returns early when it is absent;
  3. reads the citation refs and `readMeasuresCatalog(docsRoot)`, then `buildMeasuresIndex`;
  4. runs the parse and reference problems;
  5. returns `{ present, source, records, normalised, changes, problems }`.
  - `normalised` holds the records with references resolved, and is only meaningful when there are no problems.

## Definition of Done

- T004 tests were written first and seen failing, and now pass.
- Every contract message case has a test with a same-fixture positive control.
- No fs, clock or Astro import in `subprocessors-core.mjs`.
- `checkSubprocessorCatalog` is the single entry point WP03 and WP05 will call.
- Full `pnpm test` passes (both tiers and mcp). Report the counts in the hand-off.

## Risks

- **YAML dates.** The `yaml` package parses `2025-01-15` as a string by default under the `core` schema. Confirm which schema `measures-loader.mjs` uses and match it. Then the `Date` branch may be dead code. Keep it only if a test proves it is reachable.
- **Message drift.** WP05's parity test will compare the build against the gate. Both call `checkSubprocessorCatalog`, so parity holds as long as no caller post-processes messages.

## Reviewer guidance

- Check the messages against the contract table, word for word.
- Check positive controls exist on the same fixture.
- Check there is no duplicated measures logic.
- Check the TZ tests.
