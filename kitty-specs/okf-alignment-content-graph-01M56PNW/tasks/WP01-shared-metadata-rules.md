---
work_package_id: WP01
title: Shared metadata rules in the vocabulary core (#177)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-006
- FR-008
- FR-021
- FR-022
- FR-023
- NFR-002
- NFR-004
- C-001
- C-004
- C-005
- C-009
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: 9e78752d6e774901af769050b2e8e3bcd8189d5a
created_at: '2026-10-18T05:34:48.620227+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 - Metadata alignment (#177)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/generator-stamp.mjs
- src/tests/okf-status-mapping.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/vocabulary-core.mjs
- src/lib/schema.ts
- src/scripts/validate-frontmatter.mjs
- src/lib/generator-stamp.mjs
- src/tests/schema-validator-parity.test.ts
- src/tests/vocabulary-single-source.test.ts
- src/tests/okf-status-mapping.test.ts
role: implementer
task_type: implement
---

# Work Package Prompt: WP01 – Shared metadata rules in the vocabulary core (#177)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude` (model `sonnet`)

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## ⚠️ IMPORTANT: Review Feedback

- **Has review feedback?**: Check the `review_ref` field in the event log (via `spec-kitty agent tasks status` or the Activity Log below).
- **You must address all feedback** before your work is complete.

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the Activity Log below or in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks. Use language identifiers in code blocks.

---

## Objectives & Success Criteria

Make the vocabulary core the single owner (C-009) of every metadata rule this mission adds, so the two validator twins (`schema.ts` Zod schema and the standalone `validate-frontmatter.mjs`) agree by construction (NFR-002).

Done when:

- `vocabulary-core.mjs` exports pure functions: `parseActor(s)` / `isActor(s)`, `normaliseInstant(v)` → `{ date, dateOnly } | null`, `checkOkfVersion(v)` → warning-or-null, `okfStatusOf(docStatus)` (total over `STATUSES`, absent → `stable`).
- `src/lib/generator-stamp.mjs` exists with `toolkitVersion()`, `makeStamp({producer, hash, previous, now})`, `isGeneratedStamp(by, producer?)`.
- Both twins accept UTC `updated`/`stale_after`/`generated.at`/`verified[].at`, date-only values (read as midnight UTC, `dateOnly: true`), all three actor forms, bare-mapping `verified`, `generated.content_hash`.
- The standalone validator emits **advisory warnings** (exit code stays 0, NFR-004) for: date-only `updated`, email author (suggest `human:<local-part>`), index file missing `okf_version`, `okf_version` other than the string `"0.2"` (including an unquoted number).
- Generated-page detection is prefix-based and still exempts a versioned stamp, while an authored page is not exempt (FR-006 positive control).
- `schema-validator-parity.test.ts` covers every form above with 100% agreement; `okf-status-mapping.test.ts` enumerates `STATUSES`.

## Context & Constraints

- Spec: `kitty-specs/okf-alignment-content-graph-01M56PNW/spec.md` (FR-001..FR-004, FR-006, FR-008 rule, FR-021..FR-023; NFR-002, NFR-004; C-004, C-009).
- Plan IC-01 (and the stamp owner part of IC-02). Data model: `data-model.md` sections Actor, Instant, Generated stamp, `verified`, `doc_status` → `status`.
- ADR-0059 is binding (C-001). Charter: `.kittify/charter/charter.md`.
- This WP owns the shared files. Later WPs import; they do not edit these files.

## Branch Strategy

- **Strategy**: see `branch_strategy` frontmatter.
- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T001 – Red-first parity fixtures

- **Purpose**: Write the failing assertions first (ATDD).
- **Steps**:
  1. Open `src/tests/schema-validator-parity.test.ts` and find the existing fixture table that both twins run against.
  2. Add fixtures (each must be judged identically by both twins, accept/reject and warning class):
     - `updated: 2026-10-18T09:30:00Z` → pass, no warning.
     - `updated: 2026-10-18T09:30:00.123Z` → pass.
     - `updated: 2026-10-18` → pass, date-only warning naming the file.
     - `updated: 2026-10-18T09:30:00+02:00` → decide with `normaliseInstant` (recommend: reject non-`Z` offsets as not canonical; if ADR-0059 allows offsets, accept). Record the choice in a code comment citing ADR-0059.
     - `authors: [jane@example.com]` → pass + email warning; `human:jane`, `doc-kitty-gherkin/0.3.0`, `process:ci` → pass.
     - `okf_version: "0.2"` → no warning; `okf_version: 0.2` (number) and `"0.1"` → warning (not failure).
     - `verified: {by: human:jane, at: 2026-10-18T00:00:00Z}` (bare) and the list form → pass.
     - `stale_after` UTC and date-only.
     - `generated: {by, at, content_hash}` → pass.
  3. Run the suite and confirm the new fixtures fail.
- **Files**: `src/tests/schema-validator-parity.test.ts`.

### Subtask T002 – Pure rules in `vocabulary-core.mjs`

- **Purpose**: One owner (C-009).
- **Steps**:
  1. Add exports next to `STATUSES` (JSDoc-const block near `src/lib/vocabulary-core.mjs:25-33`; follow the pure-ESM, JSDoc-typed, no-`.d.ts` convention documented there).
  2. `parseActor` follows the grammar in `data-model.md` (`human:<id>`, `process:<id>`, `<name>/<version>`; email recognised separately so callers can warn). Return a discriminated object (`{kind, id|name, version}`) or `null`.
  3. `normaliseInstant(v)`: accept `Date` (YAML may already have parsed it; treat a midnight-UTC `Date` coming from a date-only scalar carefully — prefer reading the raw string when available), ISO `…Z` string, date-only string. Return `{ date: Date, dateOnly: boolean }`. Never use locale parsing.
  4. `okfStatusOf(docStatus)`: table from `data-model.md`; unknown/charter-added values → `stable`; absent → `stable`.
  5. `checkOkfVersion(v)`: `"0.2"` string only.
  6. `isIndexFile(path, indexBasename)` should reuse `normalizeIndexBasenames` (`vocabulary-core.mjs:792`) so FR-003 "which files are index files" matches routing (plan decision 5).
- **Files**: `src/lib/vocabulary-core.mjs`.
- **Notes**: If `vocabulary-single-source.test.ts` enumerates exports or asserts single definitions, extend it to include the new names (strengthen, do not add a test).

### Subtask T003 – Wire the Zod twin

- **Steps**:
  1. `src/lib/schema.ts:176` `updated: z.coerce.date()` and `:237` `stale_after` → a shared preprocess calling `normaliseInstant` (do NOT let `z.coerce.date()` be its own parser; see plan IC-01 risk).
  2. `:185` `okf_version` stays lenient (`z.union([z.string(), z.number()])` or equivalent) so a number does not fail the build (warning only, FR-023).
  3. `:228` `generated` gains optional `content_hash`; `generated.by` uses `isActor` refinement (warn-level is the validator's job; schema accepts).
  4. `:231` `verified` accepts list or bare `{by, at}` and transforms to a list.
  5. `authors` accepts actors and emails.
- **Files**: `src/lib/schema.ts`.

### Subtask T004 – Wire the standalone validator + warnings

- **Steps**:
  1. In `src/scripts/validate-frontmatter.mjs:105-401`, replace local date/actor checks with imports from `vocabulary-core.mjs`.
  2. Add the four advisory warnings (date-only `updated`, email author, missing `okf_version` on an index file, non-`"0.2"` `okf_version`). Each warning names the file. Exit code unaffected (NFR-004).
- **Files**: `src/scripts/validate-frontmatter.mjs`.

### Subtask T005 – `generator-stamp.mjs` and prefix detection [P]

- **Steps**:
  1. Create `src/lib/generator-stamp.mjs`:
     - `toolkitVersion()` reads `../package.json` relative to `import.meta.url` (that is `src/package.json`, the published `@spec-kitty/doc-toolkit` manifest — C-004; never the repo root manifest). Cache it.
     - `makeStamp({ producer, hash, previous, now })` → `{ by: `${producer}/${version}`, at, content_hash: `sha256:<12 hex>` }`; `at` reuses `previous.at` when `previous.content_hash === content_hash` (even across a version bump), else `now` formatted as `YYYY-MM-DDTHH:MM:SSZ`. `now` is injectable (tests deterministic).
     - `isGeneratedStamp(by, producer?)`: prefix match `<producer>/`; also accept the legacy exact value `doc-kitty/gherkin` so pages generated before WP02 regenerates them are still detected.
  2. `validate-frontmatter.mjs:113-144`: `GENERATED_BY_STAMPS` exact `includes` → `isGeneratedStamp`. Keep the exported name if other modules import it (grep first); otherwise replace with a producers list.
- **Files**: `src/lib/generator-stamp.mjs`, `src/scripts/validate-frontmatter.mjs`.
- **Notes**: Add the FR-006 positive control to the existing generated-page exemption fixture in `schema-validator-parity.test.ts` (versioned stamp exempt; authored page not exempt).

### Subtask T006 – Focused `okf-status-mapping.test.ts` [P]

- **Steps**: One focused test (the one new test of this change): iterate `STATUSES`, assert `okfStatusOf` returns one of `draft|stable|deprecated`; assert absent → `stable`; assert an unknown value → `stable`.
- **Files**: `src/tests/okf-status-mapping.test.ts`.

### Post-tasks adversarial additions (must do)

- **NFR-004 proof survives WP04**: after WP04 migrates our trees there is no old-forms tree left, so `validate-frontmatter.mjs docs` exiting 0 proves nothing. Add an old-forms fixture tree (date-only `updated`, `authors: [a@b.c]`, `okf_version` on the root index only, legacy `generated.by: doc-kitty/gherkin`) under `src/tests/fixtures/` and assert in `schema-validator-parity.test.ts`: validator exit code `0`, stderr contains each of the advisory warnings, and the Zod twin parses every page. This is the NFR-004 assertion; do not count the live-tree run.
- **Warning parity is validator-only**: the Zod twin cannot emit warnings. Parity (NFR-002) means identical accept/reject; the warning class is asserted against the standalone validator only. Do not invent a warning channel in `schema.ts`.
- **FR-006 positive control must be two-sided**: one fixture with `generated.by: doc-kitty-gherkin/9.9.9` asserted *exempt*, one authored fixture with the same body and no `generated` asserted *not exempt* (the exemption-specific rule fires). A test that only asserts the exempt case passes on a no-op that exempts everything.
- **FR-023**: assert three distinct inputs: `"0.2"` (no warning), `0.2` unquoted (warning — note YAML yields the number `0.2`, so check `typeof !== 'string'`), `"0.1"` (warning).

## Test Strategy

- `pnpm --filter @spec-kitty/doc-toolkit test -- schema-validator-parity okf-status-mapping vocabulary-single-source`
- Typecheck: run the toolkit typecheck as CI does (`pnpm --filter @spec-kitty/doc-toolkit exec tsc --noEmit` or the package `typecheck` script; check `src/package.json`).
- `node src/scripts/validate-frontmatter.mjs docs` and `... example/docs` must still exit 0 (warnings are expected now; WP04 removes them).

## Risks & Mitigations

- YAML parsers turn `2026-10-18` into a `Date` before Zod sees it, losing the date-only flag. Mitigation: detect via the raw scalar or via midnight-UTC plus the source text; test both twins with the same fixture.
- Ripple: no pinned baselines move in this WP (no output format change yet). If any do, update them here (C-007).

## Review Guidance

- Reviewer runs on `opus`. Check: both twins import the same functions (no duplicated regex); warnings never change exit codes; `okfStatusOf` is total; `toolkitVersion()` reads `src/package.json`; legacy stamp still detected.
- Confirm typecheck ran and passed in addition to vitest.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.

> **Orchestrator ruling (non-Z offsets):** an ISO 8601 instant with a non-`Z` offset (e.g. `+02:00`) is accepted by both validators as a valid instant and raises a doc-sanity warning recommending `Z`; generators and the migration always emit `Z`. Add it as one more parity-fixture row.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- Cites verified: schema.ts:176/185/228/231/237, vocabulary-core.mjs:792, validate-frontmatter.mjs:113-144.
- Validator twin has its OWN zod copies to change in lockstep: `validate-frontmatter.mjs:200` (okf_version), `:201` (authors), `:224` (stale_after `z.coerce.date()`), `:377` (generated-page `updated` check). Missing any one is a parity break.
- `GENERATED_BY_STAMPS` is imported by `src/tests/schema-validator-parity.test.ts:10,432-435`, which pins `['doc-kitty/gherkin']` exactly and regex-asserts the import shape. Keep the export or update that test in this WP.
- `schema.ts:806` has a second `authors` (catalog schema). It is not the page field, so leave it alone.
- No eslint complexity rule exists (`eslint.config.js`). The ≤15 limit is review-enforced only.
