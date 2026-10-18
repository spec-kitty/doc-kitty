---
work_package_id: WP05
title: The env-file reader honours envDir and --mode
dependencies:
- WP02
requirement_refs:
- FR-010
- FR-010a
- SC-003
- C-006
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: 70a145062501d006ca1e397cb4383ddd42bc6783
created_at: '2026-10-17T07:19:10.274933+00:00'
subtasks:
- T014
- T015
- T016
- T017
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/draft-publication.mjs
create_intent:
- src/tests/draft-publication.env.test.ts
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/lib/draft-publication.mjs
- src/scripts/site-index-names.mjs
- src/scripts/check-links.mjs
- src/scripts/check-redirect-coverage.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/draft-publication.env.test.ts
role: implementer
---
# WP05 — The env-file reader honours envDir and --mode

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

## Objective
DocKitty reads env files from Vite's `envDir` for the active mode, in the build hook and in the gates (FR-010, FR-010a). Quoting rules unchanged (C-006).

Facts (design scout, Astro 5.18.2 / Vite 6.4.3): `astro:config:setup` gets no mode; Astro uses `inlineConfig.mode ?? 'production'|'development'` internally, so `--mode` is only visible in `process.argv`. `config.vite.envDir` is the raw user value; Vite resolves it against root and `false` means no env files; mode `local` throws. File order `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local` (matches `readEnvFiles`). Gates take `--mode` via `takeSiteFlags` (draft-publication.mjs ~230); `site-index-names.mjs` ~153-163 already `runnerImport`s the site config in a child.

## Subtasks
### T014 Pure resolvers (red first)
In `draft-publication.mjs`: `activeMode({ argv, command })` (`--mode x` / `--mode=x`; else `development` for dev, `production` otherwise; throw `[dk-drafts]` on `local`) and `resolveEnvSource({ root, envDir })` (`false` → null; relative → resolved against root; absent → root). `readEnvFiles` takes the resolved directory. One table test (`src/tests/draft-publication.env.test.ts`, it.each) covering: no flags (unchanged), `--mode staging`, `--mode=staging`, `local` rejected, envDir relative, envDir false, process.env still wins. Red first on the unchanged code for the envDir/mode rows.
### T015 Build hook
The draft-publication `astro:config:setup` (moved by WP02 into `src/lib/integrations/draft-publication.ts`; one-line out-of-map edit, record it) uses `activeMode({ argv: process.argv, command })` and `config.vite?.envDir` instead of `command === 'dev' ? 'development' : 'production'`. If `src/lib/integrations/draft-publication.ts` is absent, STOP: WP02 is not merged into your lane. Strengthen ONE existing draft-publication hook test (SC-003): with `config.vite.envDir='env'`, `--mode staging` in argv and `env/.env.staging` setting `DK_PUBLISH_DRAFTS=on`, drafts are emitted; without the flag they are not. The table test alone does not prove SC-003.
### T016 Gates (FR-010a)
`site-index-names.mjs`'s evaluate child returns `{ names, envDir }` (keep the old fields' meaning; check every caller). Gates that use it pass `envDir` to `resolveDraftPublicationForGate`. A gate that does NOT evaluate the config (check `check-redirect-coverage.mjs`, `assert-build-artifacts.mjs`) and whose config text contains `envDir` fails with `[dk-drafts] … set vite.envDir; pass --env-dir <dir|false> …` — add that `--env-dir` flag to `takeSiteFlags`. Strengthen the existing gate tests rather than adding files where one exists.
### T017 Gates
Suites: draft-publication*, check-links*, check-redirect-coverage*, assert-build-artifacts*, site-index-names*, the new env test, import-guard suites; example build exit 0 (no envDir → unchanged). eslint, tsc (29).

## Definition of Done
- With no `envDir` and no `--mode`, behaviour is byte-for-byte as before.
- Commit: `feat(drafts): read env files from Vite's envDir for the active --mode (#115)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP05 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
