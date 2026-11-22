---
work_package_id: WP02
title: Measures core, loader and shipped default catalog
dependencies: []
requirement_refs:
- FR-003
- FR-004
- FR-005
- NFR-001
- NFR-004
- C-002
- C-005
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP runs in the lane worktree computed in lanes.json, and completed changes merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T004
- T005
- T006
- T007
- T008
agent: claude
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/measures-core.mjs
- src/lib/measures-loader.mjs
- src/lib/measures.default.yaml
- src/tests/measures-core.test.ts
- src/tests/measures-loader.test.ts
- src/tests/fixtures/measures/consumer/docs/_meta/measures.yaml
- src/tests/fixtures/measures/bad-catalog/docs/_meta/measures.yaml
execution_mode: code_change
owned_files:
- src/lib/measures-core.mjs
- src/lib/measures-loader.mjs
- src/lib/measures.default.yaml
- src/tests/measures-core.test.ts
- src/tests/measures-loader.test.ts
- src/tests/fixtures/measures/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 - Measures core, loader and shipped default catalog

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Build the one parser and resolver that every surface shares. It has a pure core with no fs and no Astro, a thin fs loader that picks the consumer file or the shipped default, and the default catalog itself. WP04, WP05 and WP06 import these modules. Getting the API right here keeps their work small.

Requirements: FR-003, FR-004, the FR-005 resolver half, NFR-001 and NFR-004. Depends on: none.

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP02 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- Read: `kitty-specs/tom-classification-measures-catalog-01M81M7T/{plan.md,data-model.md,research.md,contracts/frontmatter-and-catalog.md}`.
- Precedent for a pure core plus an fs loader: `src/lib/vocabulary-core.mjs` (pure, JSDoc-typed `.mjs`, imported by TS and by bare-Node scripts) and `src/lib/vocabulary-loader.mjs` (reads `_meta/*.yaml` with gray-matter's YAML engine by wrapping text in `---` fences). Copy that style: `// @ts-check`, JSDoc typedefs, named exports.
- YAML parsing: use the same gray-matter wrap trick as `loadCatalogFile` in `src/scripts/validate-catalog.mjs`. **No new dependency.**
- `compareCodeUnit` from `vocabulary-core.mjs` is the repo's one string comparator, if you need ordering.
- **Red first**: write T008's tests before T005–T007 and watch them fail.

## Subtasks

### T004: Shipped default catalog `src/lib/measures.default.yaml`

**Purpose**: The 17 default measures (FR-003, research R2).

**Steps**:

1. The file header comment says three things. First: "Default measures catalog (ADR-0080). Not legal advice." Second: labels are short identifiers for headings in Decision (EU) 2021/914 Annex II and GDPR Article 32(1). Third: the `dpv` IRI names the nearest W3C DPV 2.3 concept, as a pointer and not an equivalence. Also say that a consumer `docs/_meta/measures.yaml` replaces this file wholesale.
2. Write 17 records, in heading order, with exactly the ids, natures and DPV terms of the table in research.md R2. Labels follow the research page list (`docs/architecture/research/eu-dpa-compatibility.md` lines 167–183), for example `Protection of data during transmission`.
3. `frameworks`: every record has `{ framework: eu-scc-2021-914-annex-ii, ref: "<n>" }` (quote the ref so YAML keeps it a string). Records 1–4 also have `{ framework: eu-gdpr, ref: "Art. 32(1)(a)" }` through `(d)`.
4. `dpv: https://w3id.org/dpv#<Term>`.

**Validation**: T008's default-catalog test: 17 records, unique ids, the ADR examples `transmission-protection` and `events-logging` are present, and every record passes `parseMeasuresCatalog`.

### T005: `parseMeasuresCatalog` and `buildMeasuresIndex`

**Purpose**: Turn catalog text into validated records, collecting every problem.

**API** (in `src/lib/measures-core.mjs`):

```js
/** @typedef {'technical'|'organisational'|'legal'|'physical'} MeasureNature */
/** @typedef {{framework: string, ref: string}} FrameworkRef */
/** @typedef {{id: string, label: string, nature: MeasureNature, frameworks: FrameworkRef[], dpv?: string}} MeasureRecord */
export const MEASURE_NATURES = /** @type {const} */ (['technical', 'organisational', 'legal', 'physical']);
export const MEASURE_SCOPES = /** @type {const} */ (['system', 'organisation']);
export const MEASURES_TAG = '[dk-measures]';
/** @returns {{records: MeasureRecord[], problems: string[]}} */
export function parseMeasuresCatalog(data, label) { /* data = already-parsed YAML value */ }
/** @returns {Map<string, MeasureRecord>} */
export function buildMeasuresIndex(records) {}
```

- `parseMeasuresCatalog` takes the **parsed** YAML value, so the core stays fs- and parser-free. `null` or `undefined` (an empty file) gives zero records and no problem. A non-array is one problem: `<label>: must be a YAML list of measure records`.
- Per record, report every problem in the form `` `${MEASURES_TAG} ${label}: ${id ?? `record ${index}`}: ${problem}` ``:
  - not a mapping;
  - `id` missing or not kebab case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`);
  - duplicate id;
  - `label` missing or empty;
  - `nature` not in `MEASURE_NATURES`;
  - `frameworks` missing, empty, or an entry without string `framework` and `ref`;
  - `dpv` present but not a string starting with `http://` or `https://`.
- A record with any problem is left out of `records`.
- Output record keys come in a fixed order (`id, label, nature, frameworks, dpv?`) and drop unknown keys, so downstream JSON is deterministic (NFR-001).

### T006: `normaliseClassification`, `resolveClassification` and `classificationProblems`

**Purpose**: The single page-side resolution, shared by the build (throws) and the gate (collects).

**API**:

```js
/** @typedef {{measure: string, scope: 'system'|'organisation', note?: string}} ClassificationEntry */
/** @typedef {ClassificationEntry & {label: string, nature: MeasureNature, dpv?: string, frameworks: FrameworkRef[]}} ResolvedClassification */
export function normaliseClassification(value) {} // -> ClassificationEntry[]; [] for undefined
export function classificationProblems(value, index, page, catalogLabel) {} // -> string[]
export function resolveClassification(value, index, page, catalogLabel) {} // -> ResolvedClassification[]; throws Error(first problem)
```

- Normalise: a string `s` becomes `{ measure: s, scope: 'system' }`. An object keeps `measure`, sets `scope` to the given value or `system`, and keeps `note` only when it is a non-empty string. Shape errors are the schema's job (WP03), but the core must not crash on garbage. Report a non-list or a bad entry as a problem: `` `${MEASURES_TAG} ${page}: tom_classification entry ${i} is not a measure id or { measure, scope?, note? }` ``.
- De-duplicate by `measure`, keeping the first occurrence's position. If the same measure appears with two different scopes, report `` `${MEASURES_TAG} ${page}: measure "${id}" is listed with both scopes` ``. Two identical entries are fine and collapse (spec edge case). When a duplicate carries a note and the first did not, keep the first entry as it is. Document this choice in a comment.
- Unknown id: `` `${MEASURES_TAG} ${page}: unknown measure id "${id}" (not in ${catalogLabel})` ``. Use this exact wording, because the contract and the gate share it.
- `resolveClassification` throws `new Error(problems.join('\n'))` when there are problems. Otherwise it returns the resolved entries in authored order, with keys `measure, label, nature, scope, note?, dpv?, frameworks`.

### T007: Loader `src/lib/measures-loader.mjs`

**Purpose**: Pick the effective catalog (FR-004) with one existence check (NFR-004).

**API**:

```js
export const MEASURES_REGISTRY_RELPATH = path.join('_meta', 'measures.yaml');
export const DEFAULT_MEASURES_PATH = fileURLToPath(new URL('./measures.default.yaml', import.meta.url));
/** @returns {{index: Map<string, MeasureRecord>, records: MeasureRecord[], source: string, isDefault: boolean}} */
export function loadMeasuresCatalog(docsRoot) {}
/** @returns {{records, problems, source, isDefault}} — never throws on a bad catalog; the gate uses this */
export function readMeasuresCatalog(docsRoot) {}
```

- `readMeasuresCatalog`: if `<docsRoot>/_meta/measures.yaml` exists, read and parse it, else read the default. `source` is the path relative to `process.cwd()` for a consumer file, and the literal `the shipped default catalog` for the default. A YAML syntax error becomes one problem naming the file.
- `loadMeasuresCatalog` throws `new Error(problems.join('\n'))` when there are problems.
- Memoise per resolved `docsRoot` within the process, using a `Map`, so the graph route and the page route of one build parse once. Export `clearMeasuresCatalogCache()` for tests.

### T008: Tests (write first)

- `src/tests/measures-core.test.ts`:
  - parse: valid list, empty or null, non-list, each record problem (one case per rule), duplicate id, deterministic key order;
  - normalise and resolve: bare id gets scope `system`; object form with note; duplicates collapse; conflicting scopes report; unknown id message matches the contract string exactly, naming page and id; garbage entries report and do not throw from `classificationProblems`;
  - default catalog: load `measures.default.yaml` through the loader. It has 17 records with unique ids, no problems, contains `transmission-protection` and `events-logging`, and has the `eu-gdpr` ref on exactly records 1–4.
- `src/tests/measures-loader.test.ts` with fixtures under `src/tests/fixtures/measures/`:
  - `consumer/docs/_meta/measures.yaml` holds 2 custom records (one id `a-5-15-access-control`). The loader returns exactly those 2 and `isDefault: false`, and `transmission-protection` is absent (wholesale replace, US4).
  - A docs root with no `_meta` gives the default with `isDefault: true`. Use a temp dir or `src/tests/fixtures/measures/no-catalog/docs/` with a `.gitkeep`.
  - `bad-catalog/docs/_meta/measures.yaml` has a duplicate id and a bad nature. `readMeasuresCatalog` lists both problems naming the file, and `loadMeasuresCatalog` throws.

**Commands**: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/measures-core.test.ts src/tests/measures-loader.test.ts` (adapt to the workspace's vitest invocation; see `src/package.json` `test`). Then `pnpm lint` and `pnpm --filter @spec-kitty/doc-toolkit typecheck`.

## Definition of done

- Both test files are green, and were red before the implementation (note it in the commit message).
- `pnpm lint` and the toolkit typecheck are clean, with no `eslint-disable` and no `@ts-ignore`.
- No new dependency in any `package.json`.

## Risks

- The `import.meta.url` resolution of the default must work from the published package (`files` includes `lib`) and from a pnpm symlinked install. Use `fileURLToPath(new URL(...))`, never `process.cwd()`.
- Do not import `astro:*` or `schema.ts` from these modules. The bare-Node gate imports them.

## Reviewer guidance

- Check the exact message strings against `contracts/frontmatter-and-catalog.md`.
- Check the DPV terms against research R2 (no invented terms).
