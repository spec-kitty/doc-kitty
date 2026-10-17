---
work_package_id: WP03
title: Move sitemapDraftFilter and pin the ./config exports (#174)
dependencies: []
requirement_refs:
- FR-009
- FR-010
- C-002
- NFR-002
- SC-004
planning_base_branch: fix/gate-config-hardening
merge_target_branch: fix/gate-config-hardening
branch_strategy: Planning artifacts for this mission were generated on fix/gate-config-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/gate-config-hardening unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gate-config-hardening-01M55KMR
base_commit: fca5acc6245483f0c7a7b87fcafaf96aaba3cc44
created_at: '2026-10-17T19:26:12.999334+00:00'
subtasks:
- T010
- T011
- T012
history:
- at: '2026-10-17T19:30:00Z'
  event: created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/route-shaping.ts
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/config.ts
- src/lib/integrations/route-shaping.ts
- src/tests/config-invariants.test.ts
- src/tests/sitemap-feeds.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP03 — Move `sitemapDraftFilter` and pin the `./config` exports (#174)

## ⚡ Do This First: Load Agent Profile

Load the `implementer-ivan` profile with the `/spk-charter-profile-load` skill. Then run `spec-kitty charter context --action implement --json`. Follow DISCIPLINED_REFACTORING: move only, with no behaviour change.

## Objective

Finish the PR #171 `config.ts` split. `sitemapDraftFilter` moves to `src/lib/integrations/route-shaping.ts` and stays re-exported from `./config`, with a test pinning the runtime export list of `./config`. Spec: FR-009, FR-010, C-002, NFR-002.

## Branch strategy

- Planning branch and merge target: `fix/gate-config-hardening`. The lane comes from `lanes.json`. It is independent of WP01/WP02.
- `spec-kitty agent action implement WP03 --agent claude --mission gate-config-hardening-01M55KMR`.

## Test economy (read first)

Follow DIRECTIVE_041. Add no new test file. Add ONE export-list assertion and repoint one import. Report a table of tests changed.

## Subtasks

### T010 — Move

- `src/lib/config.ts:402` defines `sitemapDraftFilter`, and it is used at :722 with `docsDir`, `base` and `indexBasename`. Move the function verbatim into `src/lib/integrations/route-shaping.ts`.
- Its helpers (for example `normalizeBasePrefix`, `resolveSectionRegistry`, `sectionFeeds`, `draftRoutesOf`, or whatever it really uses) must be imported from their owning modules (`../draft-publication.mjs`, `./shared.js`, `../route-shaping.js`, …), **never from `../config`**. ADR-0058 says integration modules never import `config.ts`.
- If a helper exists only in `config.ts`, list it in your report and move it too only if it is a pure leaf. Otherwise stop and report.
- Re-export `sitemapDraftFilter` from `config.ts` in the existing re-export block (~:439-464).

### T011 — Repoint the test

- `src/tests/sitemap-feeds.test.ts:21` imports from `../lib/config.js`. Import from the new module, and keep one assertion that `config.sitemapDraftFilter === routeShaping.sitemapDraftFilter`. That pins the re-export.

### T012 — Export list

- In `src/tests/config-invariants.test.ts`, add one assertion:

  ```ts
  expect(Object.keys(await import('../lib/config.js')).sort()).toEqual([...])
  ```

  The list is an inline literal taken from `origin/main` (`a76c5563`) before your move. Show red-first evidence in your report: drop one re-export and the test goes red.

## Definition of Done

- `grep -n "from '../config" src/lib/integrations/*.ts` is empty.
- `cd src && node_modules/.bin/vitest run tests/config-invariants.test.ts tests/sitemap-feeds.test.ts` is green. `tsc --noEmit` shows no new errors in the touched files.
- The commit is `refactor(config): …` / `test(config): …` with the trailer lines.

## Addenda from the brownfield scout (binding)

- **Definition:** `config.ts:402-437`, with the JSDoc ending at about :401. The one call site is :722, `sitemap({ filter: sitemapDraftFilter(docsDir, base, indexBasename) })`.
- **Imports for route-shaping.ts:**
  - `{ normalizeBasePrefix, siteDraftRoutes }` from `./shared.js` (`normalizeBasePrefix` is already imported at :16);
  - `sectionOf`, added to the existing `../metadata.js` import (:11);
  - `{ resolveSectionRegistry, sectionFeeds, feedsSurface }` from `../sections.js`.

  sections.ts does not import config or route-shaping, so this creates no cycle. No helper lives only in config.ts.
- Remove any `config.ts` import that becomes unused, but grep for other uses first. `pnpm lint` flags unused imports.
- **Re-export:** add it to the route-shaping list in config.ts:441-447.
- **sitemap-feeds.test.ts:** update the comment at :10 as well as the import at :21.
- **T012:**
  - Generate the literal mechanically: `git worktree add <tmp> a76c5563`, then print the value-export keys with vitest or node. List value exports only, because `export type` names don't exist at runtime.
  - Place the assertion outside any test that re-mocks config. `config-invariants.test.ts:42` already imports config under a `vi.mock` of glossary/load.js (:36).
- **tsc DoD:** take an error-count baseline before the change and compare after. Report both numbers.
- **Test economy:** keep the export-list assertion plus ONE identity check (`config.sitemapDraftFilter === routeShaping.sitemapDraftFilter`), and nothing else.
