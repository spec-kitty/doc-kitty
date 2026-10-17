---
work_package_id: WP01
title: Draft gates read the evaluated config (#173)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-012
- NFR-001
- C-001
- C-004
- C-005
- SC-001
- SC-002
planning_base_branch: fix/gate-config-hardening
merge_target_branch: fix/gate-config-hardening
branch_strategy: Planning artifacts for this mission were generated on fix/gate-config-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/gate-config-hardening unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gate-config-hardening-01M55KMR
base_commit: de35e301b2f7e7afea04989d0ddd0fa5ce921804
created_at: '2026-10-17T19:25:40.318093+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- at: '2026-10-17T19:30:00Z'
  event: created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/scripts/site-config-eval.mjs
execution_mode: code_change
model: sonnet
owned_files:
- src/scripts/site-index-names.mjs
- src/scripts/site-config-eval.mjs
- src/scripts/check-redirect-coverage.mjs
- src/lib/draft-publication.mjs
- src/tests/draft-publication.test.ts
- src/tests/draft-publication.env.test.ts
- src/tests/redirect-coverage.test.ts
- src/scripts/assert-build-artifacts.mjs
- src/scripts/check-links.mjs
- src/tests/check-links-tightened.test.ts
- src/tests/draft-publication-workflows.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP01 — Draft gates read the evaluated config (#173)

## ⚡ Do This First: Load Agent Profile

Load the `node-norris` profile with the `/spk-charter-profile-load` skill before you read anything else. Then run `spec-kitty charter context --action implement --json`.

## Objective

`assert-build-artifacts` and `check-redirect-coverage` (run without `--docs`) must learn `vite.envDir`/`vite.envFile` by **evaluating** `astro.config.*` through the evaluator `check-links` already uses, instead of searching the config's text. When a config exists but fails to evaluate, the gate **fails closed with exit 2**. `--env-dir <dir|false>` skips evaluation. With no config file, behaviour is unchanged. Spec: FR-001..FR-005, FR-012, NFR-001, C-001, C-004, C-005.

## Branch strategy

- Planning branch: `fix/gate-config-hardening`. Final merge target: `fix/gate-config-hardening`. The mission PR then targets `main`.
- The execution worktree is allocated per computed lane from `lanes.json`. Run `spec-kitty agent action implement WP01 --agent claude --mission gate-config-hardening-01M55KMR`.

## Test economy (read first)

Follow DIRECTIVE_041 and the KEEP/RETIRE/SPLIT rubric in `development-assist-test-cleanup`. Strengthen existing test cases, and delete the tests of the retired text-search error. Add at most one focused case per change, with realistic fixtures. Red-first evidence that isn't worth keeping goes in your report (the command plus its failing output), not in a commit. **Report a table of every test you added, changed or removed: subtask | test | regression caught | existing coverage.**

## Subtasks

### T001 — Extract the shared evaluator

- `src/scripts/site-index-names.mjs:51-77` holds `namesFromConfig`: a child `node` process that calls Vite's `runnerImport(configPath, { configFile: false })`, resolved from the site's own `astro`, with a timeout and an `evaluated` cache keyed by path (:32). Config discovery is at :79-101, and `--astro-config` overrides it.
- Extract `evaluateSiteConfig({ siteRoot, astroConfig })` into `src/scripts/site-config-eval.mjs`, or keep it exported from `site-index-names.mjs` if extracting would churn too much; say which you chose. It returns `{ configPath | null, config }`, where `config` is the evaluated default export, or `null` when no config file exists.
- It throws a typed error, `ConfigEvalError` with `.configPath`, on a load failure, a non-zero child exit or a timeout (ETIMEDOUT at :62-63).
- `check-links` keeps exactly its current behaviour and calls the shared function, so the cache is shared within one process.
- The child must not need a built `dist` or network access (C-005). It needs only the workspace install, because `example/astro.config.mjs` imports `@spec-kitty/doc-toolkit/config`.

### T002 — `assert-build-artifacts`

- At `src/scripts/assert-build-artifacts.mjs:1972-1980` the gate calls `resolveDraftPublicationForGate(..., configEvaluated: false)`. Replace this:
  - With `--env-dir` given: use it and do not evaluate.
  - Otherwise: call `evaluateSiteConfig`.
  - On a `ConfigEvalError`: print `assert-build-artifacts: could not evaluate <configPath> (<reason>). Fix the config, or pass --env-dir <dir|false> to skip evaluation.` and exit 2.
- Read `vite.envDir` and `vite.envFile` from the result. `envFile === false` means no files. Resolve a relative `envDir` against the site root.
- Add `--astro-config <file>` with the same meaning as on `check-links`.
- NOTE: WP02 edits this same file afterwards (the index-path work). Keep your change confined to the env/draft resolution block and the argument parsing for these two flags.
- WP01 owns this file. WP02 edits it afterwards in the same sequential chain, for the index-path work only.

### T003 — `check-redirect-coverage`

- `src/scripts/check-redirect-coverage.mjs:417-425`: the `--docs` path already evaluates the config, prefers `site.envDir ?? indexNames.envDir`, and exits 2 on a load failure. Give the path without `--docs` the same behaviour through `evaluateSiteConfig`, with one evaluation per run.
- When `--docs` and `--site-root` are both given and resolve to different site roots, exit 2 with a message naming both.
- With `--env-dir` and `--docs` both given: `--env-dir` decides the env files, and the config is still evaluated for index names, as it is today.

### T004 — Retire the text search

- `src/lib/draft-publication.mjs:322-349`: remove the `/\b(envDir|envFile)\b/` text search over `astro.config.*`, its error, and the `configEvaluated` parameter and its JSDoc.
- `resolveDraftPublicationForGate` now takes the already-resolved env source (`dir | false`). Update every caller you own; for the out-of-map caller in assert-build-artifacts, see T002.

### T005 — Tests

- In `src/tests/draft-publication.test.ts`, strengthen the existing case "a gate reads vite.envDir…" (it holds the envDir/envFile guard fixtures added in PR #171):
  - (a) An imported base config (`astro.base.mjs` exporting `{ vite: { envDir: 'env' } }`, spread by `astro.config.mjs`) resolves to `env/` with no flag. It must fail red on main.
  - (b) A config that throws on import makes the gate exit 2, and the message names `--env-dir`.
  - (c) The same throwing config with `--env-dir false` passes. This is the same-fixture positive control.
- Delete the assertions about the text-search refusal error. They are now dead.
- In `redirect-coverage.test.ts`, add one case only if cheap: conflicting `--docs`/`--site-root` gives exit 2.
- Run only the touched files: `cd src && node_modules/.bin/vitest run tests/draft-publication.test.ts tests/draft-publication.env.test.ts tests/redirect-coverage.test.ts tests/check-links-tightened.test.ts`.
  - If node_modules is missing, run `pnpm install --offline --frozen-lockfile` in the root and in `src/`.
  - Run build-backed suites one at a time, because they race over dist.

## Definition of Done

- FR-001..FR-005 and FR-012 are demonstrated by the tests above. Red-first evidence for (a) and (b) is in your report.
- `node src/scripts/assert-build-artifacts.mjs` on a freshly built example passes with no new flags. CI invokes it this way at `.github/workflows/ci.yml` ~213/229/262.
- Evaluation runs once per run: show it with a counter or debug log in your report, not as a committed test. Timing goes in the report (NFR-001).
- `check-links` behaviour is unchanged: `check-links-tightened.test.ts` is green.
- Every commit is a Conventional Commits commit, `fix(gates): …` / `refactor(gates): …` / `test(gates): …`, ending with the Co-Authored-By and Claude-Session lines from the orchestrator brief.

## Risks / reviewer guidance

- A fail-open regression: any path where evaluation fails and the gate still reads the site root.
- A cache key aliasing `--docs` and `--site-root` to different configs.
- The child process inheriting `--mode` or the env: it deletes `ENV_NAME` (:54). Mode-branching configs are a documented limit (C-004), so don't add mode support.

## Addenda from the post-tasks and brownfield squads (binding)

The line references are against `a76c5563`.

### Seam map
- **`site-index-names.mjs`:**
  - `EVALUATE_TIMEOUT_MS` :28, `CONFIG_NAMES` :29 (only mjs/ts/js), the cache :32 (`{names, envDir}`);
  - `namesFromConfig` :51-77, `resolveSiteIndexBasenames` :94-150, the child `evaluate()` :166-179.
- **Callers of `resolveSiteIndexBasenames`:**
  - check-links :87, check-redirect-coverage :75, assert-build-artifacts :32;
  - new-doc :34, generate-feature-pages :59, validate-frontmatter :46, scaffold :27.

  Those four must keep working.
- **`draft-publication.mjs`:**
  - `resolveEnvSource` :228-231, `ASTRO_CONFIG_NAMES` :234 (6 names, Astro order), `findSiteRoot` :253;
  - `takeSiteFlags` :293-314, `resolveDraftPublicationForGate` :332-360 (parameter :338-341, regex :343).
- **Callers of `resolveDraftPublicationForGate`:** assert-build-artifacts :1973, check-redirect-coverage :418, **check-links :420 and :433**. Migrate all of them off `configEvaluated`.
- `assert-build-artifacts.mjs` already imports `resolveSiteIndexBasenames` (:32). **Reuse that one evaluation; never add a second** (NFR-001). Its arguments go through `takeSiteFlags` (:1955), its usage text is at :1962, and the env block is at :1970-1984.
- **check-redirect-coverage** already parses `--astro-config` (:338). Honour it on the path without `--docs` too, and add it to the usage text (:8, :368-369).

### Design rules
1. **One discovery owner.** Unify the config names on `ASTRO_CONFIG_NAMES`, with all 6 names, in Astro's lookup order. The evaluator takes its site root from `findSiteRoot`, unless `--astro-config` or `--docs` decides it. Otherwise an `astro.config.mts`/`cjs` site picks a root the evaluator never evaluates, which is fail-open.
2. **Return extracted fields only.** The child returns `{ names, envDir, envFile }`, never the raw config: plugins don't survive JSON. Extend the cache entry the same way.
3. **Resolve `envDir` only through the existing `resolveEnvSource`/`viteEnvDirOf`.** Add no third relative-path resolver.
4. **The check-links two-roots refusal must not fail open.** The case is pinned at `draft-publication.test.ts:1076-1082`: a nested root whose config sits above it, which was previously caught by the sniff. Evaluate the config `findSiteRoot` finds for each root. If that config is not the one being evaluated, exit 2. Say which approach you implemented.

### Tests
- In `draft-publication.test.ts`, rewrite :1061-1063 and :1069-1072 (the sniff-regex pins) to the new exit-2 or evaluation behaviour. **Keep the `--env-dir` positive controls at :1064-1067.**
- Add the T005 (a)/(b)/(c) scenarios. Split them into separate `it`s if one shared `it` would make a failure ambiguous.
- `draft-publication-workflows.test.ts:143` runs every gate with `node`. Keep it green.

### Definition of Done additions
- **US1-6:** show in the report that `check-redirect-coverage --docs … --env-dir …` evaluates the config once and that `--env-dir` wins.
- **US1-7:** after building the example, run the three CI gate invocations exactly as `ci.yml` writes them and paste the results:
  - :213 `pnpm assert:artifacts example/dist`;
  - :229 `check-redirect-coverage`;
  - :262 `assert-build-artifacts example/dist-nodrafts`.

  Evaluation currently takes about 1.1 s on the example (`check-links example/docs`); report the before and after.
