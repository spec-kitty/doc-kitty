---
work_package_id: WP06
title: ADR-0087 stamp and producer registration
dependencies:
- WP03
requirement_refs:
- FR-008
- NFR-001
- NFR-004
- NFR-005
- C-002
- C-003
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/tom-annex/stamp.mjs
create_intent:
- src/lib/tom-annex/stamp.mjs
- src/tests/tom-annex-stamp.test.ts
execution_mode: code_change
owned_files:
- src/lib/tom-annex/stamp.mjs
- src/lib/producers.mjs
- src/tests/tom-annex-stamp.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP06 - ADR-0087 stamp and producer registration

> **GATE (C-002): do not claim this WP until PR #445 (ADR-0087) has merged to
> `main`, the mission branch has been rebased onto it, and the dispatcher has
> confirmed. ADR-0087 was accepted on 2026-11-23.**

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Give the evidence index the generated-section stamp of ADR-0087:

```json
"generated": { "by": "doc-kitty-tom-annex/<version>", "at": "<instant>|null", "source_digest": "sha256:<64 hex>", "content_hash": "sha256:<12 hex>" }
```

Also register `doc-kitty-tom-annex` as an ownership producer (ADR-0083), so WP07's
hub page and the stamp readers recognise it.

Requirements: FR-008, NFR-001, NFR-004, NFR-005, C-003. Depends on: WP03.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP06 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- Read `docs/adr/0087-generated-section-contract.md`: D1 (keys and order), D2 (the digest's canonical form), D5 (`at` and artifacts derived at build time).
- Read `kitty-specs/tom-annex-export-01M84YDP/research.md` R-04 and R-05.
- `src/lib/generator-stamp.mjs` holds `toolkitVersion()` and `formatInstant`/`normaliseInstant` (via `vocabulary-core.mjs`). Reuse them; do not reimplement them.
- `src/lib/producers.mjs` has the entry shape `{id, role, scope?, recognition?, retiredBy?, regenerateHint?}` and is built by `createProducerRegistry([...])` at about line 197.
- WP02's `siteContentGraph()` returns `locations` (with `file`) and `measures` (with `source` and `isDefault`).

## Subtasks

### T026 — `source_digest` (ADR-0087 D2)

**Steps**:
1. Create `src/lib/tom-annex/stamp.mjs` (fs-free) exporting
   `sourceDigest(inputs: Array<{path: string, sha256: string}>): string`:
   - sort the entries by `path`, by code unit;
   - join them as `${path}\0${sha256}` with `\n`;
   - return `sha256:` plus the full 64-hex sha256 of that text.
   - Use `node:crypto`. It is built in, but it is still a `node:` import: if the
     file must stay importable by fs-free code, put the hashing behind a passed-in
     function, or accept the `node:crypto` import and document it. Choose one and
     say which in the hand-off.
2. Define the **declared inputs** in a pure helper
   `annexInputs({evidencePages, catalog})`:
   - each evidence page: `{path: <project-relative POSIX path of its source file>, sha256: <hex of its committed bytes>}`;
   - the catalog:
     - a consumer file (`_meta/measures.yaml`) uses its project-relative path and its bytes;
     - the shipped default uses `{path: 'catalog:default', sha256: sha256(canonical JSON of the records)}`. Canonical JSON means keys sorted and records sorted by id.
3. Red tests:
   - the order of inputs does not change the digest;
   - changing one page's bytes changes it;
   - adding a page changes it;
   - a whitespace-only change to a non-evidence page does **not** change it (positive control: an evidence-page change on the same fixture does);
   - a default catalog and a consumer catalog with equal records still give different digests (the path differs). Pin that as intended.

### T027 — `content_hash` and `at` (ADR-0087 D5)

**Steps**:
1. `contentHash(annexWithoutGenerated)`: `sha256:` plus the first 12 hex of the
   sha256 of `serializeTomAnnex(annex)` with no `generated` key.
2. `annexInstant(evidencePages)`: the latest of every evidence page's `updated`
   and `verified[].at`, normalised with `normaliseInstant` and formatted with
   `formatInstant`. It is `null` when none exist. **Never** read the clock; a test
   fakes `Date` and asserts it is unused.
3. `stampAnnex(annex, {inputs, evidencePages})` returns the annex with `generated`
   inserted in schema position: after `notice`, before `catalog`.
4. Red tests:
   - The same inputs give the same stamp across two calls with different faked
     clocks.
   - `at` follows the max instant.
   - `content_hash` changes when the body changes and not when only `generated`
     differs.

### T028 — Register the producer (ADR-0083)

**Steps**:
1. Add an entry to `PRODUCER_REGISTRY`:
   `{ id: 'doc-kitty-tom-annex', role: 'ownership', scope: { type: 'section', kinds: ['Hub'] }, recognition: 'stamp-and-scope', regenerateHint: 'node <toolkit>/scripts/tom-annex.mjs --dist <dist> --hub <path> (see docs/guides/tom-annex.md)' }`.
   - This uses a section scope with no named section, narrowed per call through
     `producerScopes`, exactly as Gherkin's entry does (ADR-0083 D5).
   - The snapshot is **not** a page and is **not** scoped here (R-04; the operator
     ruled to keep it). WP07 recognises it by its CLI path.
2. Red tests:
   - The registry builds.
   - `isGeneratedStamp('doc-kitty-tom-annex/1.2.3')` is true.
   - A hub page with that stamp outside its narrowed scope is **not** generated
     (a positive and negative pair on one fixture).
3. Update every test that enumerates `PRODUCERS`, such as producer-registry and
   generator-stamp tests. Grep for `PRODUCERS` and `doc-kitty-glossary` in
   `src/tests`.

### T029 — Wire the stamp into the route; schema and gate accept it

Some of these files are **out of map**, owned by WP03 and WP05, which are approved
by the time this WP runs. Record a one-line rationale for each in the hand-off:
"WP06 wires the ADR-0087 stamp, which C-002 held back from WP03/WP05."

**Steps**:
1. `src/lib/routes/tom-annex.ts`:
   - collect the evidence pages' source files from `locations`;
   - read their bytes with `node:fs`, at build time from committed files (C-003);
   - build `inputs` and call `stampAnnex`.
2. `src/scripts/assert-build-artifacts.mjs` `assertTomAnnex`:
   - require `generated`;
   - check that `by` starts with `doc-kitty-tom-annex/`;
   - check the `source_digest` and `content_hash` patterns;
   - recompute `content_hash` from the file without `generated` and compare.
3. The schema in `src/lib/tom-annex/tom-annex.schema.json` already describes
   `generated` as optional. Make it **required** and bump `format_version` to
   `1.1`, since this is an additive field (NFR-003). Mirror both into
   `kitty-specs/.../contracts/` through a planning note in the hand-off, not as an
   edit here.
4. Run the WP05 two-builds test: it must stay green with **no mask**.

## Definition of Done

- [ ] The annex carries a stamp in schema position. `at` comes from inputs, never the clock.
- [ ] The digest follows ADR-0087 D2, and its tests include positive controls.
- [ ] The producer is registered, and the existing producer tests are updated.
- [ ] The artifact gate verifies `content_hash`. The two-builds test is green, unmasked.
- [ ] `format_version` is 1.1, with the schema requiring `generated`.
- [ ] `pnpm test` passes in full.

## Risks

- **Clock leakage** breaks byte stability. T027's faked-clock test guards it.
- **Path normalisation on Windows**: use POSIX separators in `path`.
- **A broader registry**: a new ownership producer joins the readers that still
  recognise stamps alone (ADR-0083 negatives). Its stamp only ever appears on its
  own outputs, so this is acceptable. Say so in the hand-off.

## Reviewer guidance

- Recompute `content_hash` by hand on a built file.
- Grep the stamp module for `Date.now`, `new Date(` and `performance`.
