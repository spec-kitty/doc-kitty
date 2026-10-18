---
work_package_id: WP03
title: Move the diagram integrations out of config.ts
dependencies:
- WP02
requirement_refs:
- FR-009
- NFR-002
- NFR-004
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: 4ec2fa170a228fa2c5e1cd9b24f91c3a1559294f
created_at: '2026-10-17T07:18:44.148752+00:00'
subtasks:
- T009
- T010
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/diagrams.ts
create_intent:
- src/lib/integrations/diagrams.ts
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/lib/integrations/diagrams.ts
role: implementer
---
# WP03 — Move the diagram integrations out of config.ts

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

Move the diagram block (config.ts ~675-1216 on main: fence transform, mode, beoe, PlantUML, sentinels, `diagramsIntegration`) into `src/lib/integrations/diagrams.ts`. `config.ts` edits are an out-of-map edit for this WP (WP02 owns it; this WP runs after WP02) — record it.

## Subtasks
### T009 Move
Verbatim move; fix the file-relative `injectScript` entry path (~1067) and any `import.meta.url` for the new directory. Re-export from config.ts: `mermaidFenceTransform`, `DiagramMode`, `resolveDiagramMode`, `DIAGRAM_SENTINELS`, `SENTINEL_THEME_VARIABLES`, `BUILD_MERMAID_CONFIG`, `BUILD_SVGO_CONFIG`, `BUILD_MERMAID_OPTS`, `DEFAULT_PLANTUML_SERVER_URL`, `resolvePlantumlServerUrl`, `sentinelThemeRewrite`, and anything else public.
### T010 Gates
Export list equals `research/config-exports-before.txt`. Suites: every `src/tests/*diagram*`, `*mermaid*`, `*plantuml*`, `markua-*` that touches diagrams, deck-guard, config-invariants, import-guard suites; one example build (exit 0). eslint, tsc (29).

## Definition of Done
- Commit: `refactor(config): move the diagram integrations into their own module (#115)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP03 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
