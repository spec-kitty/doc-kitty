---
work_package_id: WP02
title: Draft hubs for draft-only directories
dependencies:
- WP01
requirement_refs:
- FR-002
- FR-003
- NFR-003
- C-005
- SC-002
planning_base_branch: issue-156-gherkin-trim-and-fixes
merge_target_branch: issue-156-gherkin-trim-and-fixes
branch_strategy: Planning artifacts for this mission were generated on issue-156-gherkin-trim-and-fixes. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-156-gherkin-trim-and-fixes unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-fixes-01M4X4YF
base_commit: 322891a5fd6f5c078e0529b6f39528671e312482
created_at: '2026-10-14T12:27:20.399329+00:00'
subtasks:
- T005
- T006
- T007
- T008
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/gherkin/generate.mjs
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/gherkin/generate.mjs
- src/tests/gherkin-generate.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP02 — Draft hubs for draft-only directories

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

A directory whose features are all drafts gets a generated hub with `doc_status: draft`; no published hub links it; generation never reads the draft setting (#124). Plan: IC-03. Research: R2. Data model: Hub.

## Branch strategy

Planning artifacts were generated on `issue-156-gherkin-trim-and-fixes`; completed changes merge back into `issue-156-gherkin-trim-and-fixes`, which goes to `main` as one draft PR the operator merges. The execution worktree is allocated per computed lane from `lanes.json`; run `spec-kitty agent action implement <WP> --agent claude --mission gherkin-trim-and-fixes-01M4X4YF`.

## Shared context

- Read `spec.md`, `plan.md` (your IC), `research.md`, `data-model.md`, `contracts/public-surface.md` and `research/code-grounding.md` first.
- Node 22, pnpm, Vitest. No dependency change.
- In a lane worktree run `pnpm install --offline --frozen-lockfile` once; revert mode-only changes under `src/scripts/` with `git checkout -- src/scripts`. Run tests per file: `cd src && ./node_modules/.bin/vitest run tests/<file>`.
- Locate code by symbol, not line: earlier WPs edit the same files.
- Every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifier in commits.
- Terminology: "Mission" for the Spec Kitty work object; Gherkin "Feature" is a domain term.

## Subtasks

### T005 — Tidy first: hub status parameter

Out-of-map edit (recorded): `serializeHubFrontmatter` in `feature-core.mjs` (owned by WP01) gains an optional `status` (default `'active'`) written as `doc_status`. Behaviour-neutral; existing goldens unchanged. Commit alone.

### T006 — Red

In `gherkin-generate.test.ts`, through `planFeaturePages`: sources `a/live.feature` (published) and `drafts/only.feature` (`@wip`), plus nested `a/inner/wip.feature` (`@wip`). Assert: `drafts/README.md` planned with `doc_status: draft`, title from the directory, intro and no list; `a/inner/README.md` planned as draft; the root hub lists `a` but not `drafts`; `a/README.md` lists `live` but not `inner`; the root hub stays `active`. Replace the existing assertion that a draft-only directory gets no hub (it pins the old rule; re-point, do not delete coverage of "drafts are not listed"). Commit red.

### T007 — Fix

In `planFeaturePages`: plan a hub for every directory in `dirTitles`; status `active` when the directory is in `publishedDirs`, else `draft`. Link a child hub into its parent only when the child is published. Root always active. Update the module/function comments that describe the old rule (the `publishedDirs` comment, the "Hubs" loop comment).

### T008 — Determinism row

A row that plans the same fixture with `process.env.DK_PUBLISH_DRAFTS` set to `on`, then `off` (restore after), and asserts the two plans are equal (Map entries). It documents R3 and FR-003.

## Definition of done

- Red commit before fix commit; `gherkin-generate.test.ts`, `gherkin-codegen-guard.test.ts`, `gherkin-check-cli.test.ts`, `gherkin-example.test.ts` green; `pnpm validate:features` passes (example unchanged).
- Ad-hoc: tag `example/features/hr/request-leave.feature` `@wip`, `pnpm generate:features`, `pnpm build:a11y`; no "Add an index page" warning for `behaviour/hr`; revert both.

## Risks and reviewer guidance

- Draft gating must hold: no published hub may list a draft hub (its Markdown is served raw to agents).
- Sidebar code is a sibling's surface (#112): do not touch it.
