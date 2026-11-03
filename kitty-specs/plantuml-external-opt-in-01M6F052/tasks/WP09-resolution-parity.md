---
work_package_id: WP09
title: Resolution parity between build and include check (NFR-003)
dependencies:
- WP04
- WP11
requirement_refs:
- NFR-003
- FR-013
- FR-003
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: b16b951f7af982704fa0346babbf2c97b91d769a
created_at: '2026-11-02T23:12:21.046291+00:00'
subtasks:
- T044
- T045
- T046
- T047
- T048
- T049
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/fixtures/plantuml-opt-in-site/
create_intent:
- src/tests/plantuml-resolution-parity.test.ts
- src/tests/fixtures/plantuml-opt-in-site/astro.config.mjs
- src/tests/fixtures/plantuml-opt-in-site/no-integration.config.mjs
execution_mode: code_change
model: sonnet
owned_files:
- src/tests/plantuml-resolution-parity.test.ts
- src/tests/fixtures/plantuml-opt-in-site/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP09 – Resolution parity between build and include check (NFR-003)

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Measure NFR-003: for all 9 combinations of source (site configuration only, environment only, both) × value (unset, allowlist, internet), plus one E5 case, the build and the include check given `--astro-config` report the **identical** `{ mode, entries, source }`: 10 of 10. Prove the real `defineDocKittyIntegrations` ran (the `names: ['PARITY']` proof, post-plan N8). Assert the FR-003 notice per source and its absence on unset cells (US4 AS3). Show a forged `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` in the parent env is ignored (A2b), and the env-only (no `--astro-config`) behaviour.

This is the parity concern (IC-11), deliberately separate from the matrix (WP07). It adds tests and a fixture site only.

## Context

- data-model.md §7 (the grid, exact cell definitions, E5 extra case), §1 (child-answer table: object / `null` / `ok:false`).
- research.md R2 (option E, `--astro-config`, `null` fallback, forged handoff), R13 "Parity proof (N8)".
- spec NFR-003 (amended; decision `01M6F1VS8XWTR7A7KAC42ZWAE0`, `01M6F21BY4VJVWE4VY889F80CP`): without the config path, the 6 env-only and unset combinations match; declared paths say "site configuration not read"; unset prints nothing new.
- WP04: `defineDocKittyIntegrations({ plantumlAllowExternal })`, the notice text, `site-config-eval.mjs` returning `plantumlAllowExternal` and `names`.
- WP11: the CLI's `--astro-config` (pinned `evaluateSiteConfig` contract: `result.config.plantumlAllowExternal`, `null` → env-only, missing file → exit 2) and `--print-declared`.
- `src/lib/config.ts:542` publishes `DK_INDEX_BASENAME` from `indexBasename`; `site-config-eval.mjs` returns it as `names`.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.

## Subtasks

### T044 – Fixture site

**Steps**:
1. Create `src/tests/fixtures/plantuml-opt-in-site/astro.config.mjs` that imports the **real** `defineDocKittyIntegrations` from the toolkit source (relative import into `src/lib/config.ts` via whatever path other fixture sites in `src/tests/fixtures/` use — check e.g. `src/tests/fixtures/valid/` or `docs-root` fixtures for how they import the toolkit; `site-config-eval` evaluates through Vite, so a `.ts` import works).
2. The config reads a **test-only** knob `DK_PARITY_SITE_VALUE` from `process.env`: `absent` → option key omitted; `undefined` → key present with value `undefined`; otherwise `JSON.parse` of the knob as the option value.
3. Sets `indexBasename: ['PARITY']` and the minimal other options needed for `defineDocKittyIntegrations` to run.
4. Add whatever minimal files the evaluation needs (a `package.json` only if required for module resolution; prefer none). The fixture must resolve `astro` from the workspace (`src/node_modules`).

**Validation**: `node src/scripts/assert-plantuml-no-remote-include.mjs --astro-config src/tests/fixtures/plantuml-opt-in-site/astro.config.mjs --print-declared` prints a JSON line.

### T045 – Build-side runner

**Steps**:
1. In the test, a helper `buildSide(cell)` that spawns (async) a child Node process which calls `evaluateSiteConfig({ siteRoot: dirname(astroConfig), astroConfig, tool: 'parity' })` from `src/scripts/site-config-eval.mjs` (returns `{ configPath, siteDir, config }`; read `config.plantumlAllowExternal` and `config.names`) and prints them as JSON; capture its stdout **and stderr** (the `[dk-plantuml]` notice is printed by `defineDocKittyIntegrations` inside the evaluation child; confirm where it surfaces and capture it from there — if `site-config-eval` swallows the grandchild's stderr, evaluate the config directly in a child with Vite the same way and document why).
2. Return `{ resolution: result.config.plantumlAllowExternal, names: result.config.names, notice: lines starting with '[dk-plantuml]' }`.
3. Env per cell: set `DK_PLANTUML_ALLOW_EXTERNAL` or delete it; set `DK_PARITY_SITE_VALUE`; delete `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED`.

### T046 – Check-side runner

**Steps**:
1. `checkSide(cell, { astroConfig: boolean })` uses WP02's `runCheck` with `['--astro-config', <fixture>, '--print-declared']` (or without `--astro-config`) and parses the single JSON stdout line.
2. Assert exit 0 and exactly one stdout line.

### T047 – The grid

**Steps**: `describe('NFR-003: 9 of 9 (+E5)')` with `it.each` over:

| Source \ Value | unset | allowlist `[A]` | internet |
|---|---|---|---|
| site only | knob `absent`, env absent | knob `["https://a.example/x/"]` | knob `"internet"` |
| env only | knob `absent`, env `""` | env `https://a.example/x/` | env `internet` |
| both | knob `undefined`, env `"   "` | knob `["https://b.example/y/"]`, env A → env wins | knob `["https://b.example/y/"]`, env `internet` → env wins |
| E5 extra | knob `["https://b.example/y/"]`, env `""` → `[B]` from site configuration on both sides | | |

For each row: `buildSide.resolution` deep-equals `checkSide(astroConfig: true)`; both equal the expected `{ mode, entries, source }`; `buildSide.names` equals `['PARITY']` (proof the real build code ran). Count passing rows in a final assertion (`expect(passed).toBe(10)`) only if it adds clarity; `it.each` already reports per row.

### T048 – Notice assertions (FR-003, US4 AS3)

**Steps**:
1. Allowlist cells: exactly one notice line; contains `declared PlantUML allowlist mode (from <expected source label>)`, the entries, and `--astro-config`.
2. Internet cells: one `WARNING: declared PlantUML internet mode` line with the source label.
3. Both-source cells: the notice names `environment DK_PLANTUML_ALLOW_EXTERNAL`.
4. Unset cells: **no** `[dk-plantuml]` line at all.

### T049 – Forged handoff and env-only cells

**Steps**:
1. Forged handoff (A2b): run the check side (with and without `--astro-config`) with `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED='{"mode":"internet","entries":[],"source":"environment"}'` in the **parent** env and the knob `absent`, env absent → result is sandbox / default. Also run the build side with the forged value and confirm the child deleted it (result is sandbox, not the forged value).
2. Without `--astro-config`: run the check side without the flag for every grid cell. Expected: it equals the build side in every cell **except** site-only allowlist and site-only internet, where it resolves `{ mode: 'sandbox', entries: [], source: 'default' }` (the spec's Limits: a site-configuration-only value is not seen without the config path). Assert both outcomes per cell, so the limit is pinned, not accidental. This covers the amended NFR-003 sentence (the environment-only and unset combinations match without the flag).
3. Declared paths without the flag: a real (non `--print-declared`) run's first line ends with `; site configuration not read (no --astro-config)` — run against a refusing fake from WP02's harness with env internet; assert only the first line (the verdict is WP07's / WP12's concern).
4. `null` child answer (A2a): a second tiny fixture config that does **not** call `defineDocKittyIntegrations` (`src/tests/fixtures/plantuml-opt-in-site/no-integration.config.mjs` exporting a plain `defineConfig({})`), with env `internet` → check side `--astro-config` resolves internet from environment (env-only fallback), not sandbox.

## Test Strategy

Black-box at both ends: the build side through the real config evaluation, the check side through the real CLI. The `names: ['PARITY']` proof makes a stubbed build side fail. Notice presence and absence are both asserted.

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-resolution-parity.test.ts`; config evaluation is slow, so set a generous per-test timeout (e.g. 60 s) and keep rows sequential if `site-config-eval`'s per-process cache interferes (each row spawns fresh children, so the cache does not leak).

## Definition of Done

- [ ] 10 parity rows green, each with the `names` proof.
- [ ] Notice asserted per source; absent on unset cells.
- [ ] Forged handoff ignored on both sides; `null` answer falls back to env-only; env-only cells and the site-only limit pinned.
- [ ] No change outside the owned files; `pnpm test` passes.

## Risks

- The fixture may fail to resolve `astro` if it sits outside the package's module resolution path; keep it under `src/tests/fixtures/`.
- Notice capture may be hidden by the evaluation child's stdio handling; find the real stream and document it rather than weakening the assertion.
- Slow tests: keep the grid to the specified rows.

## Reviewer Guidance

- Replace the build side with a stub returning the expected resolution and confirm the `names` assertion fails.
- Check every grid cell against data-model.md §7.
- Check unset cells assert absence of `[dk-plantuml]`.

## Requirement trace

| Requirement | Subtask |
|---|---|
| NFR-003 9 of 9 (+E5) with `--astro-config` | T047 |
| NFR-003 amended sentence (without the flag) | T049.2 |
| FR-013 one resolution, real build code ran | T047 (`names: ['PARITY']`) |
| FR-003 notice per source | T048 |
| US4 AS3 / FR-007 unset silence | T048.4 |
| A2a `null` answer → env-only | T049.4 |
| A2b forged handoff ignored | T049.1 |

## Files at a glance

| File | Action |
|---|---|
| `src/tests/plantuml-resolution-parity.test.ts` | create |
| `src/tests/fixtures/plantuml-opt-in-site/astro.config.mjs` | create |
| `src/tests/fixtures/plantuml-opt-in-site/no-integration.config.mjs` | create |
| `src/lib/config.ts`, `src/scripts/*` | **do not edit** (WP04, WP06, WP11) |

## Implement command

```bash
spec-kitty agent action implement WP09 --agent claude --mission plantuml-external-opt-in-01M6F052
```
