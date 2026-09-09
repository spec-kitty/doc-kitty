---
work_package_id: WP04
title: Consumer artifact checker (feeds + agent-API)
dependencies:
- WP01
requirement_refs:
- FR-005
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
- T020
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: tests/consumption/scripts/
create_intent:
- tests/consumption/scripts/assert-consumer-artifacts.mjs
execution_mode: code_change
owned_files:
- tests/consumption/scripts/assert-consumer-artifacts.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_010 (spec fidelity — assert the SHIPPED shape), DIRECTIVE_032 (conceptual alignment — `pages` not `entries`).

## Objective

A small, **corpus-agnostic** consumer-owned checker that verifies the fixture's feeds
and agent-API are present and well-formed — the coverage the non-portable, corpus-pinned
`assert-build-artifacts.mjs` cannot provide over a tarball (research D1).

Read first: `../contracts/consumption-test-contract.md` (C-3), `../research.md` (D1),
and the shipped routes `src/lib/routes/agent-index.ts` (**emits `pages[]`, count===pages.length,
version '2'**) + `src/lib/routes/rss.ts`/`bibliography.ts`. Match the shipped
`assert-build-artifacts.mjs` XML rigor (stack scanner) without its repo-root/corpus coupling.

## Subtasks

### T017 — Feeds well-formedness (real XML scanner, not regex)
`tests/consumption/scripts/assert-consumer-artifacts.mjs <dist>`:
- `rss.xml`: exists, non-empty, well-formed XML, `<channel>` with ≥1 `<item>`.
- `llms.txt`: exists, non-empty, first line a top-level `#` title.
- `sitemap-index.xml` (or `sitemap-0.xml`): exists, well-formed, ≥1 `<loc>`.

### T018 — Agent-API shape (the corrected key)
- `api/index.json`: valid JSON; top-level **`pages`** array (NOT `entries` — the
  first draft was wrong); `version === '2'`; `count === pages.length`; every `pages[]`
  record carries `slug, route, section, title, doc_status, kind` (and `related[]` /
  `audience[]` where present). Corpus-agnostic: shape + invariants, no fixed counts.

### T019 — Favicon output + bibliography
- Assert the built site emits a favicon asset (the `<link rel="icon">` target exists in
  `dist/`) — closes the favicon warn-path hole (a missing favicon does NOT fail the
  build via modules; contract C-2/C-3).
- `api/bibliography.json`: valid JSON, `records[]` each with `id/title/url`.

### T020 — Self-verify green
Run the checker against WP01's built `dist/` and confirm exit 0. It is auto-discovered
by WP01's orchestrator (`assert-consumer-*.mjs` glob) — no edit to the orchestrator needed.

## Definition of Done
- `assert-consumer-artifacts.mjs <dist>` exits 0 on a good build, non-zero (per-assertion
  message) on a missing/malformed feed, wrong agent-API key, bad count, or missing favicon.
- Asserts `pages[]` (verified against `agent-index.ts`), not `entries[]`.
- Uses a real XML scanner, no corpus-specific counts, no repo-root path assumptions.

## Reviewer guidance
Confirm against `src/lib/routes/agent-index.ts` that the key really is `pages`. Delete a
`<link rel=icon>`/favicon from a copied dist and confirm the checker catches it.

## Branch Strategy
Planning branch and merge target: `feat/release-0.1.0-consumption-readiness`. Depends on
WP01. Execution worktrees per `lanes.json`. Implement with `spec-kitty agent action implement WP04 --agent claude`.
