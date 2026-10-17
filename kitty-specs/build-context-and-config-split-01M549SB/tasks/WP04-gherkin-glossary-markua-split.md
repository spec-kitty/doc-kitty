---
work_package_id: WP04
title: Move Gherkin, glossary and Markua out of config.ts; one integration-name constant
dependencies:
- WP03
requirement_refs:
- FR-007
- FR-009
- NFR-002
- NFR-004
- C-005
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: ae08c5e1654f4e0268108eeb0f6ed10cd1151228
created_at: '2026-10-17T07:27:21.722102+00:00'
subtasks:
- T011
- T012
- T013
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/
create_intent:
- src/lib/integrations/gherkin.ts
- src/lib/integrations/glossary.ts
- src/lib/integrations/markua.ts
- src/tests/helpers/integration-names.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/integrations/gherkin.ts
- src/lib/integrations/glossary.ts
- src/lib/integrations/markua.ts
- src/tests/markua-attributes.test.ts
- src/tests/deck-guard.test.ts
- src/tests/glossary-substrate-parity.test.ts
- src/tests/glossary-config.test.ts
- src/tests/helpers/integration-names.ts
role: implementer
---
# WP04 — Move Gherkin, glossary and Markua out of config.ts; one integration-name constant

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

Line numbers below are pre-WP02 (main); locate blocks by symbol.

Move the Gherkin (~1349-1665 on main), glossary (~1241-1348) and Markua (~1666-1713) blocks out of config.ts (out-of-map config.ts edit, record it), bringing `config.ts` to ≤ 1,000 lines (NFR-004), and replace the hard-coded integration-name lists in tests with one constant (FR-007).

## Subtasks
### T011 Move
Verbatim; re-export `SCENARIO_INDEX_MODULE_ID`, `hasOwnScenarioIndexPage`, `findOwnScenarioIndexPage` and everything else public. Watch file-relative paths (the scenario route injection, the gherkin results overlay).
### T012 Integration-name constant (FR-007)
Grep all of `src/tests` for `'doc-kitty:` lists (`grep -rln "'doc-kitty:" src/tests`, about nine files incl. config-invariants, draft-publication, route-shaping). `src/tests/helpers/integration-names.ts` exports the list DERIVED from what `defineDocKittyIntegrations(<minimal options>)` registers. A list used as INPUT (which integrations to filter, skip or look up) takes the derived constant; a list that is the EXPECTED value of an order or registration assertion keeps its literal (deriving it from the code under test would be tautological). Files you may not own: edit only the input lists, and record the out-of-map edits. List each file and your choice. No new test (C-005).
### T013 Gates
`wc -l src/lib/config.ts` ≤ 1,000; export list equals the snapshot; suites: gherkin-*, glossary-*, markua-*, deck-guard, scenario-index, config-invariants, import-guard suites; example build exit 0. eslint, tsc (29).

## Definition of Done
- Commits: `refactor(config): move the Gherkin, glossary and Markua integrations into their own modules (#115)`, `test: one integration-name list derived from the registered integrations (#115)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP04 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
