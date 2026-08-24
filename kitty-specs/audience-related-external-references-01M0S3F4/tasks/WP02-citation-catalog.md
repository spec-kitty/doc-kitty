---
work_package_id: WP02
title: Citation catalog + bibliography endpoint
dependencies:
- WP01
requirement_refs:
- FR-007
- FR-008
- FR-015
planning_base_branch: feat/audience-related-external-references
merge_target_branch: feat/audience-related-external-references
branch_strategy: Planning artifacts were generated on feat/audience-related-external-references. This WP may branch from a dependency-specific base during /spec-kitty.implement, but completed changes merge back into feat/audience-related-external-references unless the human redirects the landing branch.
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/
create_intent:
- src/lib/catalog.ts
- src/scripts/validate-catalog.mjs
- src/lib/routes/bibliography.ts
- docs/_meta/bibliography.yaml
- docs/_meta/tools.yaml
- example/docs/_meta/bibliography.yaml
- example/docs/_meta/tools.yaml
- src/tests/catalog.test.ts
execution_mode: code_change
owned_files:
- src/lib/catalog.ts
- src/scripts/validate-catalog.mjs
- src/lib/routes/bibliography.ts
- docs/_meta/bibliography.yaml
- docs/_meta/tools.yaml
- example/docs/_meta/bibliography.yaml
- example/docs/_meta/tools.yaml
- example/src/content.config.ts
- package.json
- .github/workflows/ci.yml
- src/tests/catalog.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its
initialization, boundaries, directives, and tactics. Then read this WP,
[../spec.md](../spec.md),
[../contracts/catalog-and-citation.contract.md](../contracts/catalog-and-citation.contract.md),
[../data-model.md](../data-model.md), and
`docs/adr/0018-citation-catalog-collections.md`.

## Objective

Ship the citation catalog: two data collections, their build-free validator, and the
`/api/bibliography.json` projection. Consumes WP01's exported catalog schema/loader
and `resolveCitation`. A `{type,id}` demonstrator citation co-lands with its record.

## Subtasks

### T007 — `catalog.ts` load/resolve model
Astro-free module wrapping WP01's `resolveCitation` with catalog loading helpers a
route can call. Keep it framework-agnostic (unit-testable).

### T008 — Toolkit catalog data [P]
`docs/_meta/bibliography.yaml` + `docs/_meta/tools.yaml` with real records
(CSL-JSON-lite per data-model). Include the `divio-2017` bibliography record and a
`revealjs` tool record as canonical examples.

### T009 — Example mirror + demonstrator citation
`example/docs/_meta/bibliography.yaml` + `tools.yaml`; wire both collections into
`example/src/content.config.ts` via the WP01 loader export. Add the **first**
`external_references: [{ type: biblio, id: <record> }]` demonstrator citation to an
existing example page **in this same WP** so it resolves (never a citation before its
record — C-007).

### T010 — Build-free catalog validator (parity)
`src/scripts/validate-catalog.mjs` — zero-import Node ESM that re-implements catalog
resolution (parity with WP01's `resolveCitation`): every `{type,id}` in the tree
resolves; unknown catalog `type` and missing id are **errors**. Wire it into the
`doc-sanity` lane (`package.json` `validate:catalog` script + the `doc-sanity` step
in `.github/workflows/ci.yml`).

### T011 — `/api/bibliography.json` route [P]
`src/lib/routes/bibliography.ts` following the existing `src/lib/routes/` pattern.
Emit `{ version, count, records: [{ id, title, url, ... }] }` from `bibliography`.
**Outside `doc_status` gating** — catalog records are not pages.

### T012 — Catalog unit tests
`src/tests/catalog.test.ts` — load + resolve happy path; missing id error; unknown
catalog type error; endpoint record shape.

## Branch Strategy

Planning branch and final merge target: `feat/audience-related-external-references`.
Worktree allocated per `lanes.json` during `/spec-kitty.implement`; changes merge
back into the mission branch.

## Definition of Done

- `bibliography`/`tools` collections load in both roots; demonstrator citation
  resolves at build.
- `validate-catalog.mjs` runs in `doc-sanity` and fails on a bad `{type,id}`.
- `/api/bibliography.json` emits records by stable id, un-gated.
- `pnpm typecheck/lint/test` green; `build-example` green (demonstrator + record
  co-landed); `doc-sanity` green (catalog validator passes on the real tree).

## Risks & reviewer guidance

- **Co-landing**: the demonstrator `{type,id}` and its record MUST land together or
  the build reds. Reviewer: confirm no orphan citation.
- **Parity**: `validate-catalog.mjs` must agree with `resolveCitation` (WP01) — the
  standalone gate re-implements, does not import TS.
- **Consumer wiring**: confirm the toolkit exports the catalog schema+loader so the
  example wires in one step (fail-fast assumes the collections are wired).
