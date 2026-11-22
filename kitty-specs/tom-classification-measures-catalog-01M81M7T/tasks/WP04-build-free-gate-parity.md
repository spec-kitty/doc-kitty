---
work_package_id: WP04
title: Build-free catalog gate resolves measure ids
dependencies:
- WP02
requirement_refs:
- FR-006
- NFR-002
- FR-005
- SC-002
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP runs in the lane worktree computed in lanes.json, and completed changes merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
agent: claude
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/validate-catalog.mjs
create_intent:
- src/tests/validate-catalog-measures.test.ts
- src/tests/fixtures/catalog-measures/default-ok/docs/README.md
- src/tests/fixtures/catalog-measures/unknown-id/docs/README.md
- src/tests/fixtures/catalog-measures/consumer/docs/README.md
- src/tests/fixtures/catalog-measures/consumer/docs/_meta/measures.yaml
- src/tests/fixtures/catalog-measures/bad-catalog/docs/_meta/measures.yaml
- src/tests/fixtures/catalog-measures/bad-catalog/docs/README.md
execution_mode: code_change
owned_files:
- src/scripts/validate-catalog.mjs
- src/tests/validate-catalog-measures.test.ts
- src/tests/fixtures/catalog-measures/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 - Build-free catalog gate resolves measure ids

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Make `pnpm validate:catalog` (`src/scripts/validate-catalog.mjs`) catch an unknown measure id and a malformed catalog without a site build, using the **same** WP02 core the build uses. Parity is then structural (NFR-002).

Requirements: FR-006, NFR-002, and FR-005 (gate side). Depends on: WP02.

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP04 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- `validate-catalog.mjs` today: `validateRoot(root, problems)` loads the bibliography and tools, walks pages, and resolves `external_references`. It deliberately re-implements resolution because the TS side imports Astro. For measures that reason is gone: `measures-core.mjs` and `measures-loader.mjs` are bare-Node safe. **Import them; do not re-implement.**
- WP02 API: `readMeasuresCatalog(docsRoot)` gives `{ records, problems, source, isDefault }`. `buildMeasuresIndex(records)`. `classificationProblems(value, index, page, catalogLabel)` gives `string[]`.
- The page label in messages: use `relative('.', file)`, the same as the existing citation messages.

## Subtasks

### T013: Wire measures into `validateRoot`

1. At the start of `validateRoot`, call `readMeasuresCatalog(resolve(root))`, push its `problems`, and build the index from `records`.
2. Read the catalog once. Only when at least one page in the root carries `tom_classification` does a bad **default** matter, but a bad **consumer** file is always reported. Simplest correct rule: always push problems. The default is valid by WP02's test.
3. In the page loop, next to `external_references`, read `parsed.data?.tom_classification`. When it is defined, increment a `measures` counter and push every string from `classificationProblems(value, index, relative('.', file), source)`.
4. Return `{ citations, measures }`. In `run`, the success line reports both counts, for example `✓ 12 external reference(s) and 3 TOM classification(s) resolve across 2 root(s): docs, example/docs.`. Keep the failure output format.
5. Update the file header comment: a short paragraph on measure resolution and why it imports rather than re-implements.

### T014: Fixtures

Under `src/tests/fixtures/catalog-measures/` (each a docs root):

- `default-ok/docs/README.md`: a valid root page with `tom_classification: [transmission-protection, { measure: accountability, scope: organisation }]`, and no `_meta/measures.yaml`.
- `unknown-id/docs/README.md`: `tom_classification: [transmision-protection]`.
- `consumer/docs/_meta/measures.yaml` (one record `a-5-15-access-control`) plus `README.md` using `a-5-15-access-control` **and** `transmission-protection`. The second must fail, which proves the wholesale replace.
- `bad-catalog/docs/_meta/measures.yaml` (duplicate id) plus a `README.md` with no classification. It must still fail, because a consumer catalog is always checked.

Each README needs the minimal valid frontmatter the walker expects (title, description, doc_status, updated, kind). The gate only reads `external_references` and `tom_classification`, but keep the pages valid.

### T015: Tests (write first)

`src/tests/validate-catalog-measures.test.ts` imports `validateRoot` (exported already) and asserts:

- `default-ok`: zero problems, `measures === 1`;
- `unknown-id`: exactly one problem, equal to `[dk-measures] <rel path>/README.md: unknown measure id "transmision-protection" (not in the shipped default catalog)`;
- `consumer`: one problem naming `transmission-protection` and the consumer catalog path, and none for `a-5-15-access-control`;
- `bad-catalog`: a problem naming the catalog file and `duplicate`.

Add one CLI-level case that spawns `node src/scripts/validate-catalog.mjs <unknown-id root>` and expects exit code 1, with stderr containing the page path and the id (acceptance scenario US2.2).

Then run the real gate: `pnpm validate:catalog` must stay green on `docs` and `example/docs`.

## Definition of done

- Tests green (red first); real gate green; lint and typecheck clean; no suppressions.

## Risks

- `walkMarkdownPaths` skips `_meta`. That is good, but the fixture `_meta/measures.yaml` must not be picked up as a page.

## Reviewer guidance

- No duplicated resolution logic in the script; the message strings come from the core.
