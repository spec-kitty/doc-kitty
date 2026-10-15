---
work_package_id: WP02
title: One test restore helper for the internal handoffs
dependencies:
- WP01
requirement_refs:
- FR-005
- NFR-002
- C-004
planning_base_branch: chore/internal-env-owner
merge_target_branch: chore/internal-env-owner
branch_strategy: Planning artifacts for this mission were generated on chore/internal-env-owner. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/internal-env-owner unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-internal-env-owner-01M4ZNK1
base_commit: 860cd08290722d4945e360821b4cf03283da003b
created_at: '2026-10-15T11:50:38.247840+00:00'
subtasks:
- T006
- T007
- T008
- T009
agent: claude
history:
- timestamp: '2026-10-15T12:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/tests/helpers/
create_intent:
- src/tests/helpers/restore-internal-env.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/tests/helpers/restore-internal-env.ts
- src/tests/helpers/restore-index-env.ts
- src/tests/check-links-tightened.test.ts
- src/tests/config-invariants.test.ts
- src/tests/deck-guard.test.ts
- src/tests/diagram-preset.test.ts
- src/tests/docs-loader-includes.test.ts
- src/tests/docs-root-cross-surface.test.ts
- src/tests/docs-root.test.ts
- src/tests/draft-publication-build.test.ts
- src/tests/gherkin-integration.test.ts
- src/tests/gherkin-results-render.test.ts
- src/tests/glossary-config.test.ts
- src/tests/glossary-substrate-parity.test.ts
- src/tests/llms-section-order.test.ts
- src/tests/markua-attributes.test.ts
- src/tests/relative-md-links.test.ts
- src/tests/route-shaping.test.ts
- src/tests/scenario-index.test.ts
- src/tests/slot-names-config.test.ts
- src/tests/theme-favicon.test.ts
role: implementer
---
# WP02 — One test restore helper for the internal handoffs

## ⚡ Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill before reading anything else. Then load the action doctrine: `spec-kitty charter context --action implement`.

## Test economy (DIRECTIVE_041) — read before writing any test

Add a test only when it guards real behaviour through the existing entry point and fails on a real regression. No duplicate assertions, no shape pins, no tests that are inert once the fix lands. Prefer strengthening an existing test. A red-first demo that is not worth keeping goes in your hand-off as evidence (command + failing output), not in the commit. In your hand-off, give a table of every test you added or changed: regression caught, existing coverage.

## Environment notes

- Run vitest SERIALLY from `src/`: `cd src && ./node_modules/.bin/vitest run <files>`. Never `pnpm exec`. Parallel runs clash on `example/` fixtures.
- ESLint: `./node_modules/.bin/eslint <files>` from the repo root. `tsc --noEmit -p src` shows 29 known pre-existing errors; add none.
- The PlantUML figure assertion in `example-adopter.test.ts` fails locally (no PlantUML server); that is environmental.

## Objective

Replace the three restore patterns for the internal handoffs (the `restoreIndexBasenameEnv` helper, `vi.stubEnv`/`unstubAllEnvs`, and ad-hoc `delete process.env[...]`) with one helper that loops over `INTERNAL_ENV_NAMES` from `src/lib/internal-env.mjs`. Only restore plumbing changes: **no assertion may change** (NFR-002).

## Subtasks

**Start only after WP01 is merged into this lane** (confirm `src/lib/internal-env.mjs` exists before T006).

Seam map (brownfield scout): hand-rolled save/restore in docs-root ~32, docs-root-cross-surface ~47, slot-names-config ~21, gherkin-integration ~125, relative-md-links ~31/~147, draft-publication ~248, helpers/restore-index-env.ts; delete-only in gherkin-results-render ~311, draft-publication-build ~96, check-links-tightened ~450. **Keep** every `vi.unstubAllEnvs()`: scenario-index stubs the adopter `BASE_URL` (~251, ~480) under the same cleanup. **Keep** the adopter `DK_PUBLISH_DRAFTS` restore in draft-publication (~362, ~902). Tests that set an internal name as input keep the set (docs-root ~147, docs-root-cross-surface ~160, docs-loader-includes ~327/469-524, draft-publication ~333/349, gherkin-results-render ~380, scenario-index ~429-444, llms-section-order ~118).

### T006 The helper
`src/tests/helpers/restore-internal-env.ts`: a function suites call at the top of a `describe` (or file) that registers `beforeEach` (snapshot every name in `INTERNAL_ENV_NAMES`) and `afterEach` (restore: set if it had a value, delete if it was absent). Mirror the call shape of the existing `restoreIndexBasenameEnv` so adoption is a rename where it was used.

### T007 Adopt it
In every test file that sets or deletes one of the five names, or calls `restoreIndexBasenameEnv`: use the new helper and remove the ad-hoc save/restore/delete code for THESE names only. Leave `vi.stubEnv` for adopter settings (e.g. `CI`, `DK_PUBLISH_DRAFTS`) alone. Where a test deliberately sets an internal name as its INPUT (e.g. stubbing `DK_GHERKIN_RESULTS` to drive a reader), keep the set; only the restore moves to the helper. Start from: `grep -rlnE "DK_INDEX_BASENAME|DK_GHERKIN_RESULTS|DK_GHERKIN_ROUTE|DK_PUBLISH_DRAFTS_RESOLVED|DK_DOCS_ROOT|restoreIndexBasenameEnv" src/tests` (≈20 files, incl. WP01's new test in draft-publication.test.ts — draft-publication.test.ts is WP01-owned; a one-line adoption there is an acceptable out-of-map edit, record it).

### T008 Retire the old helper
Delete `src/tests/helpers/restore-index-env.ts` once nothing imports it.

### T009 Gates
Run every touched suite serially, plus the WP01 suites. ESLint touched files. tsc (29 known). Then prove no assertion changed: `git diff <base> -- src/tests ':!src/tests/helpers' | grep -E '^[-+].*(expect|assert|\.to[A-Z]|\bit\(|\btest\()'` must be empty, where `<base>` is the WP01 tip merged into this lane (record the SHA); and the per-file vitest test count is the same before and after (paste both).

## Definition of Done
- The helper loops over `INTERNAL_ENV_NAMES`: `grep -E 'DK_(INDEX|GHERKIN|PUBLISH|DOCS)' src/tests/helpers/restore-internal-env.ts` is empty (SC-002).
- One helper; the old one deleted; `grep -rn "delete process.env" src/tests` shows no deletion of the five names outside the helper.
- All touched suites pass serially; 0 changed `expect(` lines.
- Commit: `test: one restore helper for DocKitty's internal env handoffs (#167)`.

## Reviewer guidance
Check no assertion changed, no adopter-setting stub was removed, and a test that sets an internal name as input still sets it.

## Branch Strategy

Planning branch: `chore/internal-env-owner`. Final merge target: `chore/internal-env-owner`. Execution worktrees are allocated per computed lane from `lanes.json`; claim with:

```bash
spec-kitty agent action implement WP02 --agent claude --mission internal-env-owner-01M4ZNK1 --acknowledge-not-bulk-edit
```
