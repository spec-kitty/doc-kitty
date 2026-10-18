---
work_package_id: WP02
title: One build-state owner; move route-shaping and draft-publication out of config.ts
dependencies: []
requirement_refs:
- FR-008
- FR-008a
- FR-009
- NFR-002
- C-001
- C-002
- C-003
- C-004
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: 4a1cd59c97b5eaf62f7c0991ccc67f7408ad6a1d
created_at: '2026-10-17T07:08:47.078178+00:00'
subtasks:
- T004
- T005
- T006
- T007
- T008
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/
create_intent:
- src/lib/build-state.ts
- src/lib/integrations/shared.ts
- src/lib/integrations/route-shaping.ts
- src/lib/integrations/draft-publication.ts
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/lib/config.ts
- src/lib/build-state.ts
- src/lib/integrations/shared.ts
- src/lib/integrations/route-shaping.ts
- src/lib/integrations/draft-publication.ts
- src/lib/route-shaping.ts
- src/tests/draft-publication.test.ts
- src/lib/route-middleware.ts
role: implementer
---
# WP02 — One build-state owner; move route-shaping and draft-publication out of config.ts

## ⚡ Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill before reading anything else. Then load the action doctrine: `spec-kitty charter context --action implement`. Read `spec.md` and `plan.md` in the mission directory.

## Test economy (DIRECTIVE_041) — read before writing any test

Add a test only when it guards real behaviour through the existing entry point and fails on a real regression. No duplicate assertions, no shape pins, no tests inert once the change lands. Prefer strengthening an existing test. A red-first demo not worth keeping goes in your hand-off as evidence, not in the commit. Hand-off includes a table of every test added or changed: regression caught, existing coverage.

## Environment notes

- Run vitest SERIALLY from `src/`: `cd src && ./node_modules/.bin/vitest run <files>`; never `pnpm exec`. Parallel runs clash on `example/` fixtures.
- ESLint from the repo root: `./node_modules/.bin/eslint <files>`. `tsc --noEmit -p src`: 29 known errors; add none.
- Import-guard suites: when you add an import to an existing module, also run `grep -rlE "importSpecifiers|import-scan|allow-list" src/tests` suites (an allow-list guard caught PR #169).
- Example build (≈10 s, no PlantUML server needed): `env -u BASE_URL DK_OUTDIR=<rel-dir> DK_PUBLISH_DRAFTS=off pnpm --filter example build` — DK_OUTDIR is relative to `example/`; `pnpm clean` first (cache trap). The PlantUML figure assertion in example-adopter.test.ts fails locally (environmental).
- Commits: author Stijn Dejongh <stijn.dejongh@sddevelopment.be>; end messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011sNPRykaeRFrS4AUqTP73f`.

### Split rules (all extraction WPs)
- Move code verbatim first; behaviour changes only where the WP says so.
- Every symbol the public `./config` entry exports today stays exported from `src/lib/config.ts` (re-export). Before the first edit, WP02 records the export snapshot: `cd src && node --input-type=module -e "const m=await import('tsx/esm/api').catch(()=>null)"` is not available — instead list them with `grep -nE '^export ' src/lib/config.ts` plus the `export { … } from` blocks, and write the sorted name list to `kitty-specs/build-context-and-config-split-01M549SB/research/config-exports-before.txt` (WP02 only). Each extraction WP re-checks the list.
- New modules import shared helpers from `src/lib/integrations/shared.ts`, never from `config.ts` (no cycles).
- Grep each moved block for `import.meta.url`, `fileURLToPath`, `new URL(` and `injectScript` — file-relative paths must be fixed for the new location.
- Test import paths do not change (they import from `config.js`; keep re-exports).

## Objective
Draft-publication build state gets one owner, created per `defineDocKittyIntegrations` call; the route-shaping and draft-publication integrations move into their own modules with shared helpers in a leaf module.

## Subtasks
### T004 Export snapshot (before any edit)
Write `name<TAB>typeof` per `./config` export to `kitty-specs/build-context-and-config-split-01M549SB/research/config-exports-before.txt`, produced by importing `src/lib/config.ts` at runtime (`cd src && ./node_modules/.bin/tsx -e …` if tsx is installed, else a throwaway vitest file run once and deleted). Type-only exports come from grep and are marked `type`; say which method you used. This is a planning-dir file you may create (out-of-map, record it).
### T005 Leaf module
`src/lib/integrations/shared.ts`: helpers used by more than one integration and by `defineDocKittyIntegrations` (`siteDraftRoutes` ~405, `normalizeBasePrefix` ~491, and any others the moved code needs). It must not import `config.ts`.
### T006 Build state (FR-008, FR-008a) — red first
Today `draftPublicationIntegration` (config.ts ~1907-2026) writes `routeShaping.unpublishedDirs` / `unpublishedPaths` (~1962-1963) into the options object `routeShapingIntegration` (~1714-1906) serves as `virtual:doc-kitty/route-shaping`; `src/lib/route-shaping.ts` ~423-436 keeps a `globalThis` `Symbol.for` warning sink because the middleware runs in the prerender bundle (a second module instance).
- `src/lib/build-state.ts` exports `createBuildState()`; `defineDocKittyIntegrations` creates ONE per call and passes it to both integrations; draft-publication writes, route-shaping reads at Vite load.
- Warning sink: KEEP it (planner review). The warnings are produced per page by the middleware from Starlight's `route.sidebar` (`route-middleware.ts` ~31-39, emitted at `route-shaping.ts` ~315), which the integration never sees; `astro:build:done` in `routeShapingIntegration` prints them. Move `WARNING_SINK`/`shapingWarningSink` into `src/lib/build-state.ts` as the ONE documented `Symbol.for` channel; keep a re-export from `route-shaping.ts` (C-004); no other module touches `globalThis`. The channel is per process, not per config: document that, and clear it at the start of each build's `astro:config:setup` so a second config cannot see the first one's warnings.
- FR-008a red first: strengthen the existing #167 two-config test in `src/tests/draft-publication.test.ts` (or the closest existing route-shaping test) so config B's virtual-module payload carries no `unpublished*` from config A. Show it red on the parent if the current mutation leaks (if it does not leak today, say so and make the assertion a ratchet).
### T007 Move the two integrations
`src/lib/integrations/route-shaping.ts` and `src/lib/integrations/draft-publication.ts` take the code verbatim apart from the T006 wiring; `config.ts` re-exports `ROUTE_SHAPING_MODULE_ID`, `ROUTE_MIDDLEWARE`, `RouteShapingOptions`, `routeShapingSource`, `routeShapingIntegration`, `draftPublicationIntegration`, `sitemapDraftFilter` and everything else public.
### T008 Gates
Export list equals the snapshot (paste a diff). `grep -rn "globalThis" src/lib` shows only the build-state channel (or nothing). Suites serially: route-shaping, draft-publication, draft-publication-build is CI's (skip locally if > 5 min), sidebar-build-html, config-invariants, docs-root, gherkin-integration, slot-names-config, and the import-guard suites. eslint, tsc (29).

## Definition of Done
- One owner per config; no options mutation; `globalThis` only in build-state.ts or nowhere.
- Two integrations moved; exports unchanged; suites green.
- Commits (one per concern): `refactor(config): move route-shaping and draft-publication into their own modules (#115)`, `fix(drafts): one build-state owner per config (#115)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP02 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
