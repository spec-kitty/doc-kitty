---
work_package_id: WP01
title: Annex core and format
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-007
- FR-013
- NFR-001
- NFR-003
- NFR-004
- NFR-005
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-tom-annex-export-01M84YDP
base_commit: 33f9bfb1164c880a86798bca96b83492347ee4ba
created_at: '2026-11-23T21:43:55.498717+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/tom-annex/
create_intent:
- src/lib/tom-annex/core.mjs
- src/lib/tom-annex/tom-annex.schema.json
- src/tests/tom-annex-core.test.ts
- src/tests/fixtures/tom-annex/graph.mjs
execution_mode: code_change
owned_files:
- src/lib/tom-annex/core.mjs
- src/lib/tom-annex/tom-annex.schema.json
- src/tests/tom-annex-core.test.ts
- src/tests/fixtures/tom-annex/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP01 - Annex core and format

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Build the one pure function every caller shares: it turns the built content graph
and the effective measures catalog into the **evidence index** object of format
1.0, and serialises it to canonical bytes. The route (WP03), the OKF export (WP04),
the stamp (WP06) and the CLI (WP07) only call this. They never re-derive anything
(C-004).

> **Evidence index, not the contractual annex.** Not legal advice. ⚖ marks counsel items.

Requirements: FR-001, FR-002, FR-003, FR-004 (constants), FR-007 (ordering and
serialiser), FR-013 (format half), NFR-001, NFR-003, NFR-004. Depends on: none.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- Execution worktrees are allocated per computed lane from `lanes.json`.
- Run `spec-kitty agent action implement WP01 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- Read `kitty-specs/tom-annex-export-01M84YDP/{spec.md,plan.md,data-model.md,research.md}` and
  `contracts/tom-annex.schema.json` (normative field list and order).
- Graph types are in `src/lib/docs-index.ts:120-180`:
  - `GraphNode`: page nodes carry `title`, `description`, `doc_status`, `verified` (`GraphStamp[]`), `updated` and `href` (the unbased route). They have **no** `url`.
  - Measure nodes are `kind: 'catalog'`, id `catalog:measure:<id>`, with `title` (the label), `url` (the DPV IRI) and `measure: {nature, frameworks}`.
  - `GraphEdge`: `{id, source, target, rel, note?, scope?}`. For `classified-as`, `source` is the page node id and `target` is the measure node id.
- Catalog types are in `src/lib/measures-core.mjs`: `MeasureRecord` `{id, label, nature, frameworks, dpv?}`, and `MEASURE_SCOPES`.
- `loadMeasuresCatalog` (`src/lib/measures-loader.mjs:103`) returns `{index, records, source, isDefault}`. The core takes plain data, not the loader.
- Style precedent: `src/lib/measures-core.mjs`. Use `// @ts-check`, JSDoc typedefs, named exports, no `node:fs`, no Astro.
- Code-unit comparison: `compareCodeUnit` already exists. Search `src/lib` for it and reuse it; do not use `localeCompare`.
- Whitespace flattening of notes: copy the rule from `src/lib/okf-export/core.mjs:264-267` (`text.replace(/\s+/g, ' ').trim()`), or factor it out if you can without touching OKF files (WP04 owns them).

## Test-first rule (NFR-004)

Write each test, run it, **see it fail for the right reason**, then implement. Note
the red run in the WP's activity log, either with
`spec-kitty agent tasks mark-status` or in your hand-off message.

## Subtasks

### T001 — Graph and catalog fixture builders

**Purpose**: Tiny, readable fixtures so every later test states its own graph.

**Steps**:
1. Create `src/tests/fixtures/tom-annex/graph.mjs` exporting builders:
   - `page(id, {title, description, href, updated, doc_status, verified})`, which returns a `kind: 'page'` node;
   - `measureNode(record)`, which returns the `catalog:measure:<id>` node as `classifiedEdges` builds it;
   - `classified(pageId, measureId, {note, scope})`, which returns a `classified-as` edge (`id` as `docs-index.ts` builds it: check the format there);
   - `catalog(records)`, which returns `{records, source: 'test catalog', isDefault: false}`.
2. Add a "canonical" fixture: four measures (`events-logging`, `incident-response`, `access-control`, `backup`), three pages, one page classifying two measures, one organisation-scope entry, one measure uncovered.

**Validation**: the fixtures import cleanly in a test, with no test assertions yet.

### T002 — Per-measure records grouped by scope (FR-001, FR-002)

**Purpose**: The heart of the index.

**Steps**:
1. Red tests in `src/tests/tom-annex-core.test.ts`:
   - A page that classifies M with a note appears under `scopes.system` M, with `title`, `description`, `url`, `updated`, `doc_status`, `verified` and `note`.
   - Two pages that classify M with `scope: organisation` give **one** entry in `scopes.organisation`, with both pages.
   - The same measure under both scopes appears in both groups, each with its own pages.
   - One page with two entries for M (system and organisation) appears once in each group.
   - Measure fields come from the **catalog record**: `label`, `nature`, `frameworks` (catalog order kept) and `dpv`, with `dpv` omitted when the catalog has none. They do not come from the graph node.
   - Missing optional page fields become `null` (`description`, `updated`, `note`). `verified` is always an array.
2. Implement `buildTomAnnex(graph, catalog, {site, base})`:
   - Index nodes by id and walk `edges` filtered to `rel === 'classified-as'`.
   - Scope defaults to `system` when an edge has none (ADR-0080 default).
   - `verified` is normalised to `{by, at}` objects only. Drop `content_hash` from the graph stamps, since it is not in the format.

**Edge cases**: an edge whose target is not in the catalog cannot happen
(ADR-0080 fails the build), but throw a `[dk-tom-annex]` error naming the id
rather than emitting a broken record.

### T003 — The `uncovered` list (FR-003)

**Steps**:
1. Red test: a catalog measure with no edge is in `uncovered` as `{id, label, nature}`. A covered measure is **not** in it. These two assertions share one fixture, which is the positive control.
2. Red test: an empty graph (no edges) gives every catalog measure in `uncovered`. The caller decides not to emit in that case (WP03). The core still returns a valid object.
3. Implement: uncovered means catalog ids minus ids seen in either scope.

### T004 — Label, notice and ⚖ counsel constants (FR-004)

**Steps**:
1. Export these constants:
   - `TOM_ANNEX_LABEL = 'Evidence index, not the contractual annex.'`
   - `TOM_ANNEX_NOTICE`: one sentence: "Not legal advice: this index lists documentation that evidences each measure; the annex of a data processing agreement remains the parties' own document."
   - `TOM_ANNEX_COUNSEL`: the three ⚖ items from `research.md` § "⚖ Counsel items", each prefixed `⚖ `.
2. Red test: the object carries all three, verbatim. WP04, WP07 and WP08 import these constants and never retype the strings.

### T005 — URL building, note flattening and sorting (FR-007)

**Steps**:
1. Red tests:
   - `url` is absolute. It is built from `site` and `base` plus the page `href`, the same way `absolute()` in `src/lib/routes/shared.ts:146` does. With `site` undefined it falls back to `http://localhost:4321`, as that helper does.
   - Notes with line breaks and tabs are flattened to single spaces and trimmed.
   - Measures within a scope are sorted by `id` by code unit. Evidence is sorted by `url`. `uncovered` is sorted by `id`.
   - Shuffling the input `nodes` and `edges` arrays gives a deep-equal output (determinism).
2. Implement a pure `absoluteUrl(site, base, href)` inside the core. Do not import `shared.ts`: it is TypeScript with Astro context. Document that it must match `absolute()`. WP05's build test cross-checks the real `api/pages` URLs.

### T006 — Canonical serialiser and shipped format schema (FR-013)

**Steps**:
1. Export `serializeTomAnnex(annex)`, which returns `JSON.stringify(ordered, null, 2) + '\n'`.
   - Keys must be emitted in **schema order**: `format`, `format_version`, `label`, `notice`, `generated` (only when present), `catalog`, `scopes`, `uncovered`, `counsel`, and the nested orders from `data-model.md`.
   - Build ordered objects explicitly. Do not rely on insertion order of objects built elsewhere.
2. Copy `contracts/tom-annex.schema.json` to `src/lib/tom-annex/tom-annex.schema.json`. This shipped copy is what #404 reads.
   **One deliberate difference:** leave `generated` out of the top-level `required` list. This WP does not produce the stamp; WP06 adds it and makes it required. The format stays 1.0 throughout (analysis I4).
3. Red tests:
   - The serialised canonical fixture equals a committed golden string. Write it into the test, short, using the fixture from T001.
   - **Schema consistency**: there is no JSON-schema validator in the repo, and you must not add one. Assert instead that:
     - every top-level key of the built object is in the schema's `properties`;
     - every `required` key is present;
     - the same holds for `measureEntry`, `evidenceRef` and the `uncovered` items.
     Walk the schema in the test.
   - `format_version` is `'1.0'` and matches the schema pattern.

## Definition of Done

- [ ] `buildTomAnnex`, `serializeTomAnnex` and the three constants are exported from `src/lib/tom-annex/core.mjs`, which is fs-free and Astro-free and passes `// @ts-check`.
- [ ] Every T002–T006 test was red first, and is now green.
- [ ] `pnpm test` passes (both tiers and mcp, NFR-005), and so do `pnpm lint` and `pnpm typecheck`, if present at the root.
- [ ] The shipped schema equals the mission contract, except that `generated` is not yet required (WP06 adds that).

## Risks

- **Field-name drift.** Renaming a field later is a major-version change (NFR-003). Match the contract now.
- **Hidden locale sorting.** Use code-unit order everywhere.

## Reviewer guidance

- Check the organisation-scope "appears once" rule against a fixture with two
  pages.
- Check that `uncovered` has a positive control on the same fixture.
- Check that no `node:` import or Astro import crept in.
- Check that the label strings are constants, not repeated literals.
