---
work_package_id: WP02
title: Comparator hygiene sweep (#88)
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- C-004
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- NFR-002
- NFR-003
- NFR-004
planning_base_branch: feat/determinism-hardening
merge_target_branch: feat/determinism-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/determinism-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/determinism-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/vocabulary-core.mjs
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/vocabulary-core.mjs
- src/lib/metadata.ts
- src/lib/sections.ts
- src/lib/catalog.ts
- src/lib/hub-children.mjs
- src/lib/vocabulary-loader.mjs
- src/lib/routes/llms-txt.ts
- src/lib/glossary/generate.ts
- src/lib/glossary/definitions-payload.ts
- src/scripts/generate-adr-index.mjs
- src/layouts/Hub.astro
- src/components/slots/Audience.astro
- src/components/slots/Related.astro
- src/components/slots/OnThisPage.astro
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile
```
/ad-hoc-profile-load implementer-ivan
```

## Objective

Issue #88: give the comparator family one shared source and make every ranker
intrinsically total and locale-independent — **byte-neutral** on the built
demonstrator (the orchestrator hashes `example/dist` before/after and rejects any
built-file change from this WP). Read the mission spec/plan/research/contract in
`kitty-specs/determinism-hardening-01M1X294/`; research D2 is the authoritative
site table. Issue: `gh issue view 88`.

## Hard rules
- Do NOT commit/stage/stash/switch branches. No dependencies (C-003). Do NOT run
  `pnpm build` or the full `pnpm test` (the vitest `build` project rebuilds
  `example/dist`, which the orchestrator's oracle owns) — run
  `cd src && ./node_modules/.bin/vitest run --project fast`. No `astro check`.
- BYTE-NEUTRAL: every change below is verified byte-neutral by the scout on
  today's corpus. If any change would reorder a built artifact, STOP and report
  rather than updating a golden.

## Subtasks

### T001 — Shared `compareCodeUnit`
- Add `export function compareCodeUnit(a, b)` to `src/lib/vocabulary-core.mjs`:
  `return a < b ? -1 : a > b ? 1 : 0;` (UTF-16 code-unit; locale-independent).
  JSDoc: the one code-unit comparator; `compareSlug` is its slug alias (#85/#88).
- In `src/lib/metadata.ts`, import `compareCodeUnit` from `./vocabulary-core.mjs`
  (metadata.ts already imports from it) and redefine `compareSlug` as
  `export const compareSlug = compareCodeUnit;` (or a thin typed wrapper) — one
  implementation. Keep `compareSlug`'s existing call sites working.

### T002 — `rankForAgents` intrinsic-total (byte-neutral)
- `src/lib/metadata.ts` `rankForAgents` (~L490): keep section → priority desc →
  title order; pin the title compare to a fixed locale:
  `a.data.title.localeCompare(b.data.title, 'en')`; then APPEND a final tiebreak
  `|| compareCodeUnit(a.slug, b.slug)`.
- This MUST NOT change the built `api/index.json` / `llms.txt`. The corpus has
  unique titles, so the slug tiebreak never fires; the priority-0.5 `context`
  trio (Domain/Marzipan/Product) must stay in title order. If pinning to `'en'`
  reorders anything (the orchestrator oracle will tell you), drop the `, 'en'`
  and keep the bare title compare + appended slug tiebreak, and say so in your
  report.

### T003 — llms-txt section sort + hub-children
- `src/lib/routes/llms-txt.ts` (~L99): the section sort `sectionRank(a) -
  sectionRank(b)` gains `|| compareCodeUnit(aKey, bKey)` on the section key.
- `src/lib/hub-children.mjs` `selectHubChildren` (~L63): pin the title
  `localeCompare` to `'en'` and append `|| compareCodeUnit(a.slug, b.slug)` (or
  the child's id if that is the available key). Import `compareCodeUnit` from
  `./vocabulary-core.mjs`. Keep the `.mjs` parity guard (`src/tests/hub-children.test.ts`) green.

### T004 — id/path/number sorts + inline glossary twins through the shared helper
- Route these through `compareCodeUnit` (byte-neutral; keys are ASCII/digit):
  `src/lib/sections.ts:87` `byOrderThenId` (id compare) and its twin
  `src/lib/vocabulary-loader.mjs:121`; `src/lib/catalog.ts:84` (bib id);
  `src/lib/metadata.ts:457` `resolveIndexEntries` (path compare) and its twin
  `src/lib/vocabulary-core.mjs:501`; `src/scripts/generate-adr-index.mjs:150,190`
  (ADR number).
- Replace the inline `a<b?-1:a>b?1:0` twins in `src/lib/glossary/generate.ts:200`
  and `src/lib/glossary/definitions-payload.ts:123` with `compareCodeUnit` imports.
- Keep the two `.ts`↔`.mjs` parity twins (`metadata.ts:457`↔`vocabulary-core.mjs`,
  `sections.ts:87`↔`vocabulary-loader.mjs`) identical in behaviour; the parity
  guards must stay green.

### T005 — Component read-paths (defer-with-note if it forces a cycle)
- `src/layouts/Hub.astro` (~L91) inlines the `collectDocEntries` map body over
  raw `getCollection('docs')`; route it through the shared slug-sorted collection
  helper so it inherits #85's baseline. `src/components/slots/{Audience,Related,
  OnThisPage}.astro` inline `buildDocsIndex` copies; call the shared
  `buildDocsIndex` instead. If importing the shared helper into a component forces
  an Astro import cycle or pulls a route-only module into a component in a way
  that breaks the build, dedupe only what is clean and REPORT what you deferred
  and why (it is byte-neutral / order-insensitive, so deferral is acceptable).

### T006 — Regression tests
- Shuffled-input tests (deterministic permutations, no `Math.random`): a tie case
  for `rankForAgents` (share section+priority; assert stable slug tiebreak and
  that a permuted input ranks identically), for the llms-txt section sort, and for
  `selectHubChildren`. Each must fail if its appended tiebreak is removed (verify
  by temporarily removing it; restore; say you did).
- Put ranker tests in `src/tests/metadata.test.ts` / `src/tests/metadata-sections.test.ts`
  as fits; hub-children in `src/tests/hub-children.test.ts`.

## Verify & report
- `cd src && ./node_modules/.bin/vitest run --project fast` → green (report count).
- `cd src && ./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | wc -l` → 30 baseline (the 2 in routes/shared.ts are pre-existing astro:content errors); none new in your files.
- `grep -rn "localeCompare" src/lib src/scripts` → only the pinned-locale title compares (rankForAgents, hub-children) remain; every id/path/number site now uses `compareCodeUnit`.
- `grep -rn "? -1 : " src/lib/glossary` → no inline twin remains (they import compareCodeUnit).
- `git diff --stat`; confirm no package.json.
- Report per-file changes, the shuffle-test-fails-without-tiebreak confirmation, whether you pinned `'en'` or fell back, and anything deferred in T005.
- Do NOT commit.
