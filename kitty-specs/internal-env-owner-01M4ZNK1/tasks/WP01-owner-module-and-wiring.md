---
work_package_id: WP01
title: Owner module and lifecycle wiring
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- SC-001
- NFR-003
- NFR-004
- C-001
- C-002
- C-003
planning_base_branch: chore/internal-env-owner
merge_target_branch: chore/internal-env-owner
branch_strategy: Planning artifacts for this mission were generated on chore/internal-env-owner. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/internal-env-owner unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-internal-env-owner-01M4ZNK1
base_commit: be181743aee0f9fecb11ce6de1675efb01360a9e
created_at: '2026-10-15T11:43:55.070403+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
agent: claude
history:
- timestamp: '2026-10-15T12:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/internal-env.mjs
create_intent:
- src/lib/internal-env.mjs
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/internal-env.mjs
- src/lib/config.ts
- src/lib/vocabulary-core.mjs
- src/lib/gherkin/options.mjs
- src/lib/gherkin/include-scan.mjs
- src/lib/draft-publication.mjs
- src/lib/routes/shared.ts
- src/tests/draft-publication.test.ts
role: implementer
---
# WP01 — Owner module and lifecycle wiring

## ⚡ Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill before reading anything else. Then load the action doctrine: `spec-kitty charter context --action implement`.

## Test economy (DIRECTIVE_041) — read before writing any test

Add a test only when it guards real behaviour through the existing entry point and fails on a real regression. No duplicate assertions, no shape pins, no tests that are inert once the fix lands. Prefer strengthening an existing test. A red-first demo that is not worth keeping goes in your hand-off as evidence (command + failing output), not in the commit. In your hand-off, give a table of every test you added or changed: regression caught, existing coverage.

## Environment notes

- Run vitest SERIALLY from `src/`: `cd src && ./node_modules/.bin/vitest run <files>`. Never `pnpm exec`. Parallel runs clash on `example/` fixtures.
- ESLint: `./node_modules/.bin/eslint <files>` from the repo root. `tsc --noEmit -p src` shows 29 known pre-existing errors; add none.
- The PlantUML figure assertion in `example-adopter.test.ts` fails locally (no PlantUML server); that is environmental.

## Objective

Create `src/lib/internal-env.mjs`, the one owner of DocKitty's five internal `process.env` handoffs, and route every write through it. Fix the never-cleared `DK_PUBLISH_DRAFTS_RESOLVED` by clearing all five names when a config is defined. Read `spec.md` and `plan.md` (Design section) in the mission directory first.

## Subtasks

### T001 Red first: the two-config lifecycle test
In `src/tests/draft-publication.test.ts` (an existing suite), add ONE focused test through the real entry points. Take the hooks from the integrations `defineDocKittyIntegrations(...)` returns, found by name (`'doc-kitty:draft-publication'`, config.ts ~1945/2257, and the fence stage), copying the pattern of the local `setup()` in `gherkin-results-render.test.ts` ~293. Do NOT build `draftPublicationIntegration(...)` directly: that skips the define-time clear. Define config A with drafts published and run its draft-publication `astro:config:setup` hook (see how the existing tests drive integration hooks); then define config B with default settings and assert `process.env.DK_PUBLISH_DRAFTS_RESOLVED` is undefined; then run B's setup and assert it holds B's resolved value. Also assert the fence stage's route value is present after its setup (FR-003 route half is a ratchet), and that after B's define `DK_GHERKIN_ROUTE` is undefined too (SC-001: no handoff leaks). Run it on the unchanged code: it must be RED on the stale value — paste the red vitest output; it must fail on the `DK_PUBLISH_DRAFTS_RESOLVED` assertion, not in setup (a hook that never ran is not red-first). Restore env in the test (WP02 will replace this plumbing with the shared helper).

### T002 Owner module
`src/lib/internal-env.mjs`, plain ESM with JSDoc, **no imports**, no I/O, no module-level value copies:
- one exported constant per name: `DK_INDEX_BASENAME_ENV`, `DK_GHERKIN_RESULTS_ENV`, `DK_GHERKIN_ROUTE_ENV`, `DK_PUBLISH_DRAFTS_RESOLVED_ENV`, `DK_DOCS_ROOT_ENV` (string values unchanged);
- `INTERNAL_ENV_NAMES` (frozen array of the five);
- `clearInternalEnv(env = process.env)`, `setInternalEnv(name, value, env = process.env)`, `deleteInternalEnv(name, env = process.env)`; set/delete throw a clear `[dk-config]` error for a name not in the list;
- a header comment table: name, write time (define or setup), writer, readers; and the rule "readers read process.env at call time — Vite SSR evaluates content config and routes in a separate module graph, so module state would arrive empty"; and "DocKitty sets these; adopters must never set them by hand".
`node --check src/lib/internal-env.mjs` must pass.

### T003 Re-export from the old definition sites
Replace each definition with a re-export from the owner, keeping every existing export name working: `vocabulary-core.mjs` (~733), `gherkin/options.mjs` (~77), `gherkin/include-scan.mjs` (~130), `draft-publication.mjs` (~32), `config.ts` (~103 `DK_DOCS_ROOT_ENV`), `routes/shared.ts` (~64 `DK_DOCS_ROOT_ENV`). Direction: these import from the owner, never the reverse. Check `src/scripts/site-index-names.mjs` still runs: it imports via `vocabulary-core.mjs`. Keep `config.ts` exporting `DK_DOCS_ROOT_ENV` and `DK_INDEX_BASENAME_ENV`: the public `./config` subpath exposes them. Keep the `[dk-config] ${DK_INDEX_BASENAME_ENV} is set by defineDocKittyIntegrations…` message at vocabulary-core ~752 byte-identical (pinned by docs-root-cross-surface.test.ts ~161).

### T004 Wire the lifecycle in config.ts
- Make `clearInternalEnv()` the FIRST statement of `defineDocKittyIntegrations` (before the destructuring ~2020): `resolveGherkinOptions` (~2040) and `validateIndexBasenames` (~2043) can throw before the first write, which today leaves the previous config's values in place, and remove the now-redundant scattered `delete process.env[...]` lines (~2056 else-branch, ~2058).
- Define-time writes (`DK_INDEX_BASENAME`, `DK_GHERKIN_RESULTS`, `DK_DOCS_ROOT` ~2069) go through `setInternalEnv`.
- Setup-time writes: the fence stage's `config:setup` (~1595-1596) uses `setInternalEnv`/`deleteInternalEnv` for `DK_GHERKIN_ROUTE`; the draft-publication `config:setup` (~1952) uses `setInternalEnv` for `DK_PUBLISH_DRAFTS_RESOLVED`.
- After: `grep -rnE 'process\.env(\[[^]]+\]|\.DK_[A-Z_]+)\s*=[^=]|delete process\.env' src/lib` matches only inside `internal-env.mjs` (paste it); readers are unchanged.
T001's test is now GREEN.

### T005 Gates
In-scope suites serially: `tests/draft-publication tests/scenario-index tests/gherkin-results-render tests/gherkin-integration tests/docs-root tests/docs-root-cross-surface tests/config-invariants tests/route-shaping tests/docs-loader-includes`. ESLint changed files. tsc (29 known). `node --check src/lib/internal-env.mjs`.

## Definition of Done
- The two-config test is red on the parent commit and green now (evidence in hand-off).
- Each of the five names is defined exactly once in `src/` (grep).
- Every env write in `src/lib` goes through the owner; readers unchanged.
- No existing assertion changed. Adopter settings untouched (C-001).
- Commit: `refactor(config): one owner for DocKitty's internal env handoffs (#167)` and a separate `fix(drafts): clear the resolved draft setting when a config is defined (#167)` if you can separate them cleanly; otherwise one commit.

## Reviewer guidance
Check the clear runs before any define-time write; setup-time values survive their own config's define; no module-level caching; old export names still resolve; `site-index-names.mjs` unaffected.

## Branch Strategy

Planning branch: `chore/internal-env-owner`. Final merge target: `chore/internal-env-owner`. Execution worktrees are allocated per computed lane from `lanes.json`; claim with:

```bash
spec-kitty agent action implement WP01 --agent claude --mission internal-env-owner-01M4ZNK1 --acknowledge-not-bulk-edit
```
