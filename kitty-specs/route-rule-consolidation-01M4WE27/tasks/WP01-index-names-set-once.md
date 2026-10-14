---
work_package_id: WP01
title: Index names set once
dependencies: []
requirement_refs:
- FR-007
- FR-008
- C-004
- NFR-005
- SC-003
- C-005
planning_base_branch: fix/route-rule-consolidation
merge_target_branch: fix/route-rule-consolidation
branch_strategy: Planning artifacts for this mission were generated on fix/route-rule-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/route-rule-consolidation unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-route-rule-consolidation-01M4WE27
base_commit: 2f03664305551c5cdc0fdc3d8a17698f74073929
created_at: '2026-10-14T06:31:18.864430+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
agent: claude
history:
- timestamp: '2026-10-14T06:16:49Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/scripts/check-links.mjs
create_intent:
- src/scripts/site-index-names.mjs
execution_mode: code_change
model: sonnet
owned_files:
- src/scripts/check-links.mjs
- src/scripts/site-index-names.mjs
- src/scripts/check-redirect-coverage.mjs
- src/scripts/generate-feature-pages.mjs
- src/scripts/new-doc.mjs
- src/scripts/scaffold.mjs
- package.json
- .github/workflows/ci.yml
- src/lib/schema.ts
- example/src/content.config.ts
- src/tests/check-links-tightened.test.ts
- src/tests/docs-root-cross-surface.test.ts
- src/tests/fixtures/consumer-sidebar/astro.config.mjs
- src/tests/fixtures/header-theme/astro.config.mjs
- tests/consumption/scripts/run-consumption-test.mjs
- tests/consumption/charter-cleanroom.test.ts
- tests/consumption/charter-governance.test.ts
role: implementer
---
# WP01 — Index names set once

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

A site author sets index names once, in `defineDocKittyIntegrations({ indexBasename })`. The docs loader and `dockitty-check-links` read that value without being told again. A loader value or a `--index-basename` flag that disagrees is an error that prints both values.

Requirements: FR-007, FR-008, C-004, NFR-005 (spec User Story 3, scenarios 1 to 6). Plan: IC-01. Research: S1 (env seam), S2 (check-links reads the site config with Vite `runnerImport`). Contracts: `contracts/index-basename-config.md`, `contracts/check-links-index-names.md`.

## Why this is broken today

- `src/lib/config.ts:1722` validates `indexBasename` only when `gherkin` is set, and never publishes the value anywhere the loader can see.
- `src/lib/schema.ts:307-347` (`docKittyDocsLoader`): `indexBasename` comes only from the loader's own options; default `README`.
- `src/scripts/check-links.mjs:88` `DEFAULT_CHECK_INDEX_BASENAMES = ['README', 'index']`, and `:284` makes it the default when no flag is given. The build's default is `README`. So the build and the check disagree on any site that sets nothing.
- `example/src/content.config.ts:18-25` repeats `['README', 'index']` with a comment saying it MUST match the integration. Three places, never compared.

## Shared context (all work packages)

- **Mission documents** (read before coding): `kitty-specs/route-rule-consolidation-01M4WE27/spec.md`, `plan.md` (your concern under "Implementation Concern Map"), `research.md` (spikes S1 to S4), `data-model.md`, `contracts/index-basename-config.md`, `contracts/check-links-index-names.md`, `contracts/collision-error.md`, `quickstart.md`. Operator decisions: `decisions/DM-*.md` (`_meta` excluded everywhere; flag comparison is order-insensitive; case-only route collisions fail).
- **Stack**: Node 24 in CI (package supports Node >= 20), TypeScript 5.9.3 and JSDoc-typed `.mjs`, Astro 5.18.2, Starlight 0.32.6, Vite 6.4.3 through Astro. Do not add, upgrade or remove a dependency (DIRECTIVE_051). If you believe one is needed, stop and report.
- **The shared route rule is the only authority (C-001).** Routes come from `routeOfSlug` / `buildRouteTable` / `resolveIndexEntries` in `src/lib/vocabulary-core.mjs`. Do not add a second rule anywhere.
- **Accepted ADRs are not edited (C-002).** Decisions go into the new ADR-0050 (WP06).

### Environment and tooling gotchas

- You work in a lane worktree that starts with no `node_modules`. Run `pnpm install --offline --frozen-lockfile` once at the worktree root. Never run `pnpm install` or `pnpm exec` in the main checkout: `pnpm exec` has install side effects. Run binaries directly.
- If `git status` shows mode-only changes under `src/scripts/` after installing, revert them with `git checkout -- src/scripts`.
- Run vitest from `src/` (where `vitest.config.ts` and `vitest.workspace.ts` live), one file at a time: `cd src && ./node_modules/.bin/vitest run tests/<file>.test.ts`. Typecheck: `cd src && ./node_modules/.bin/tsc --noEmit -p .` (`.mjs` is not type-checked; rely on tests for it).
- Build-level suites (`*-build-html.test.ts`) build the example site and need a PlantUML service locally; if one is not available, say so in the hand-off and leave them to CI rather than skipping them silently.
- Any test that calls `defineDocKittyIntegrations` now writes `process.env.DK_INDEX_BASENAME` (after WP01). Save the original value and restore it in `afterEach` (delete it if it was unset), as `src/tests/docs-root-cross-surface.test.ts:42-46` does for `DK_DOCS_ROOT`. The suite runs with `fileParallelism: false`, so a leaked value poisons the next file.
- Example-pin tests break when example output changes. Before you call a red pin a regression, read whether your change was meant to move it.
- In Markdown you write (comments in docs, ADR, changelog): never start a line with `#` followed by a number (markdownlint MD018 reads it as a heading). Write "issue 135" or put the reference mid-line.

### Test economy (read before writing any test)

DIRECTIVE_041 and the KEEP / RETIRE / SPLIT rubric (`development-assist-test-cleanup`) apply. Constraint C-005.

1. **Red first, through an existing entry point** (`buildRouteTable`, `docKittyDocsLoader`, `defineDocKittyIntegrations`, the `check-links` CLI, `generateFeaturePages`, the remark plugin, the route modules). Show the failing assertion before the fix; put the command and its output in the hand-off.
2. **Strengthen an existing test file before creating a new one.** A new file only where this prompt lists it in `create_intent`.
3. **Every refusal assertion has a positive control on the same fixture** (tactic `acceptance-criteria-non-vacuity`): the error case and the passing case differ by one file or one flag, so the test cannot pass because the fixture is broken.
4. **No shape pins.** Assert behaviour (route, exit code, the named paths in a message), not object layout or full message text. Assert the message names the files and the fix; do not snapshot it.
5. **Each new or changed test must fail when its fix is reverted.** Revert locally, watch it fail, restore.
6. A test that pins today's behaviour which this mission deliberately changes is **rewritten on purpose**, with a one-line comment naming the requirement that moved it. Never delete such a test silently; if you retire one, say why in the hand-off (RETIRE: duplicate of X / SPLIT: two behaviours in one).
7. **Hand-off table**: list every test file and case you added, changed or retired, with KEEP / RETIRE / SPLIT and the requirement it guards.

### Out-of-map edits

Stay inside `owned_files`. This prompt names the only allowed edits outside them, each with its reason. Record each one in the hand-off. Work packages WP01, WP02 and WP03 run strictly in sequence, so a named edit to a file another of them owns never races.

### Commits and style

Conventional Commits subjects (`fix(...)`, `feat(...)`, `test(...)`, `docs(...)`). Match the surrounding file; this codebase comments *why* a rule exists and which requirement it serves. If a commit hook fails for a reason unrelated to your change, report it; do not bypass it silently.

## Allowed out-of-map edit

- **`src/lib/config.ts`, inside `defineDocKittyIntegrations` only (around `:1722-1733`)**: (a) run `validateIndexBasenames(indexBasename, 'indexBasename')` always, not only when `gherkinOpts` is set; (b) write `process.env.DK_INDEX_BASENAME = JSON.stringify(normalizeIndexBasenames(indexBasename))` next to the `DK_DOCS_ROOT` write, and export the env name as a constant (`DK_INDEX_BASENAME_ENV`) beside `DK_DOCS_ROOT_ENV` (`:98`). Reason: the env seam is the publish side of FR-007; WP03 owns the rest of `config.ts`, and WP03 runs after you. Keep the edit to those lines plus the import.

- **`src/scripts/validate-frontmatter.mjs`, index-name resolution only (`:340`, `:547-551`)**: resolve the names with `resolveSiteIndexBasenames` (T004 step 6) instead of the hard-coded default; keep the `--index-basename` flag with the same agreement rule as check-links (T005). Keep the exported `DEFAULT_INDEX_BASENAME = ['README']` constant as the no-config value, so the `index-basename.test.ts` pin stays valid. Reason: FR-007 for every CLI that takes index names; WP02 owns the file and runs after you. Touch nothing else there (WP02 rewrites its collision code and walk).

Do **not** edit `src/lib/vocabulary-core.mjs` (WP02 owns it). Use its existing exports (`normalizeIndexBasenames`, `isPlainIndexName`).

## Subtasks

### T001 — Red first: the three disagreements

**Purpose**: show each symptom failing before any fix.

**Steps**:

1. In `src/tests/docs-root-cross-surface.test.ts` (it already calls `defineDocKittyIntegrations` and restores `DK_DOCS_ROOT` in `afterEach`), add a case: a temp docs tree with `x/index.md`; call `defineDocKittyIntegrations({ ..., indexBasename: ['index'] })`, then run `docKittyDocsLoader({ base })` through its load path (find how existing loader tests drive `load`; `draft-publication.test.ts` and `index-basename.test.ts` construct the loader) and assert the entry id for `x/index.md` is `x` (served at `/x/`). Today the loader ignores the integration and yields `x/index`.
2. In `src/tests/check-links-tightened.test.ts`: a temp site folder with an `astro.config.mjs` that calls `defineDocKittyIntegrations({ indexBasename: ['index'] })` and a `docs/` tree with `x/index.md` and a page linking to the folder `x/`. Run the CLI with `--strict` and no flag. Today it uses `README,index` and happens to pass, so pick the fixture that shows the disagreement: a folder `y/` holding only `y/README.md` linked as `y/`. With config `['index']` the build does not treat `README.md` as an index, so the check must report it; today it accepts it.
3. Same file: a disagreeing flag case (`--index-basename README` on that site) that today runs and exits 0.

**Validation**: each new assertion is red; keep the output for the hand-off.

**Edge cases**: the fixture config must import the toolkit by a path that resolves from the temp folder. Look at how `example-adopter.test.ts` and `src/tests/fixtures/consumer-sidebar/astro.config.mjs` reference the toolkit, and put the fixture under `src/tests/fixtures/` if a temp folder cannot resolve `astro`/`vite` (runnerImport needs `astro` resolvable from the site root). If you must add a committed fixture folder, list it in the hand-off as an out-of-map addition with its reason (test fixture for FR-007); keep it minimal.

### T002 — Publish the names from the integration

**Purpose**: the one place an adopter sets index names (operator decision 3).

**Steps**: the out-of-map edit above. Normalise with `normalizeIndexBasenames` so the env value is the same ordered `string[]` every consumer sees. Keep config order (determinism: the first name decides `generatedIndexBasename`).

**Files**: `src/lib/config.ts` (named lines only).

**Validation**: T001 case 1 still red until T003; a unit assertion that `process.env.DK_INDEX_BASENAME` equals `'["README"]'` after a call with no option, and `'["index"]'` with `['index']`. Restore the env in `afterEach`.

**Edge cases**: a bad entry (`'a/b'`) now throws even without `gherkin`; check `config-invariants.test.ts` and `glossary-config.test.ts` still pass (they call the function; you may need to add the env restore there; if so that is a test-only touch outside your map, record it).

### T003 — Loader reads the published names lazily

**Purpose**: FR-007 loader side, without an import cycle (C-004: `schema.ts` must never import `config.ts`).

**Steps**:

1. In `schema.ts`, read `process.env.DK_INDEX_BASENAME` inside `resolveIds()` (`:324`), not when the loader is constructed. Ordering is guaranteed: Astro evaluates the config (and so `defineDocKittyIntegrations`) before it loads `content.config.ts` (research S1, point 1).
2. Rules (contract table): option omitted and env set -> env value; omitted and unset -> `['README']`; option given and env unset -> option; given and equal after normalisation -> that value; given and different -> throw `[dk-loader] indexBasename [...] passed to docKittyDocsLoader does not match indexBasename [...] set in defineDocKittyIntegrations. Remove the option from docKittyDocsLoader in content.config.ts; the loader reads it from the integration.`
3. Equality: normalise both, compare as written (case-sensitive, order-sensitive) per `data-model.md`.
4. Use the resolved names everywhere the loader used `indexBasename`, including the `generateId` fallback at `:347`.
5. Use the env name string literally or a tiny constant local to `schema.ts`; do not import it from `config.ts`.
6. Mark the loader option deprecated in its JSDoc (`:272-278`).

**Validation**: T001 case 1 green. Add the mismatch case (loader `['index']`, integration `['README']` throws naming both) paired with the equal case (both `['README','index']`, loads) on the same tree.

**Edge cases**: unit tests that build the loader without the integration must see the env unset; restore in `afterEach`.

### T004 — check-links reads the site config

**Purpose**: FR-007 check side (research S2).

**Steps**:

1. For each strict root, find `astro.config.{mjs,ts,js}` in the root's parent folder (existing `ASTRO_CONFIG_NAMES` lookup near `:413`).
2. If found: delete `process.env.DK_INDEX_BASENAME`, resolve `vite` from the site's installed `astro` (`createRequire(join(siteRoot, 'package.json'))` then resolve `vite` from astro's location), call `runnerImport(configPath)` (Vite >= 6.1; the probe used `configFile: false`), then read the env value. Cache per config path.
3. A config that throws: exit 2 with `[dk-check-links] could not load <path>: <message>`. No silent fallback.
4. Print exactly one source line per strict root on stdout, before findings, in the four forms of `contracts/check-links-index-names.md`.
5. Remove `DEFAULT_CHECK_INDEX_BASENAMES` (`:88`); the default becomes `['README']`. Update `--help` text: the value is read from the site config; the flag is only for sites without one.
6. Put steps 1 to 3 in a new module `src/scripts/site-index-names.mjs` exporting `resolveSiteIndexBasenames(root)` → `{ names, source }` (`source` is the text for the source line). check-links imports it. A root with no site config resolves to the documented default `['README']`, and the source line reads `index names: README (default — no astro.config found for <root>)`. With two roots (`docs example/docs`), each root is resolved independently and prints its own line.

**Validation**: T001 case 2 green. A fixture with no config prints the default line. A config without `defineDocKittyIntegrations` prints the "does not call" line (US3 scenario 6). A two-root run (one root with a config, one without) prints two different source lines, each correct for its root.

**Edge cases**: non-strict roots keep working with the default `README`; this changes folder-link hints for this repository's `docs/` (repo-root `docs/` has no astro config and no `index.md` file, so `README` is correct for it). Run `node src/scripts/check-links.mjs docs example/docs` before and after, from the repo root, and put both outputs' summary in the hand-off (IC-01 risk). `validate:links` (`package.json:22`) must stay green with no flag. Performance: about 850 ms per config; evaluate each config once.

### T005 — The flag must agree

**Purpose**: FR-008.

**Steps**: compare the flag with the config value as sets (order-insensitive, decision `01M4WENQAJN2S0N7WXR12F7YY4`). Match: use the config's order. Mismatch: stderr message from the contract, exit 2, before any check runs. No config: the flag's value, source line `(from --index-basename)`.

**Validation**: T001 case 3 green; the same fixture with `--index-basename index` (matching) and with `index,README` against a `README,index` config both pass (positive controls).

### T006 — Example and callers on the single setting

**Steps**:

1. `example/src/content.config.ts`: drop `indexBasename` from `docKittyDocsLoader(...)` and replace the "MUST match" comment with one line saying the loader reads it from the integration.
2. Root `package.json` `validate:links` (`:22`, `check-links.mjs docs example/docs`) stays flag-less and green.
3. Every CLI that takes index names resolves them with `resolveSiteIndexBasenames(root)` and the T005 agreement rule; replace each hard-coded default: `validate-frontmatter.mjs:340/:547-551` (out-of-map edit above), `check-redirect-coverage.mjs:335/:420`, `generate-feature-pages.mjs:121`. `new-doc.mjs:76` and `scaffold.mjs:32` keep a literal `README` default only where they write a config file for a new site; state in the hand-off, per script, which applies. Otherwise they use the helper too.
4. Drop `--index-basename README,index` from `package.json:21`, `:24`, `:25` and `.github/workflows/ci.yml:276`: `example/astro.config.mjs:102` sets `['README', 'index']`, so each script now reads it. Run each changed script once and record exit 0 in the hand-off.
5. Fixtures that hard-code names keep agreeing with their own site config: `src/tests/fixtures/consumer-sidebar/astro.config.mjs:63` and `src/tests/fixtures/header-theme/astro.config.mjs:45` (both `['README','index']`; confirm the loader in each fixture's content config passes no different value). `tests/consumption/scripts/run-consumption-test.mjs:410-416` passes `--index-basename README`: drop the flag (the clean-room site sets nothing, so the default `README` applies) and update the comment at `:415`. Update `tests/consumption/charter-cleanroom.test.ts:192/:223` and `charter-governance.test.ts:74` where they expect that flag or the old `README,index` default.

**Validation**: `index-basename.test.ts`, `draft-publication.test.ts`, `example-adopter.test.ts`, `config-invariants.test.ts`, `gherkin-check-cli.test.ts`, `gherkin-generate.test.ts` green (run each); `node src/scripts/validate-frontmatter.mjs example/docs`, `node src/scripts/generate-feature-pages.mjs --root example --sources features --docs docs --section behaviour --check` exit 0. The consumption tests run in CI only: name them in the hand-off as CI-verified.

## Test strategy

Strengthened files: `docs-root-cross-surface.test.ts` (loader and env), `check-links-tightened.test.ts` (sourcing, source line, flag agreement). Each refusal has its positive control on the same fixture. Restore `DK_INDEX_BASENAME` in every file that calls `defineDocKittyIntegrations`.

## Definition of Done

- Index names are set in one place; the loader and the check read them; disagreements fail with both values printed.
- `DEFAULT_CHECK_INDEX_BASENAMES` is gone; the check's default is `README`.
- `resolveSiteIndexBasenames` is the only index-name resolution in `src/scripts/`; `grep -rn "'README'" src/scripts` hits are each the documented default or a config writer, listed in the hand-off.
- No `--index-basename` left in `package.json` or `ci.yml`.
- Owned test files and the files named in T006 are green; `tsc --noEmit` clean.
- `node src/scripts/check-links.mjs docs example/docs` exits 0 (output in hand-off).
- Hand-off: tests table, out-of-map edits, before/after `validate:links` comparison.

## Risks

- Env leakage between test files (restore every time).
- `runnerImport` with a site that has custom Vite aliases is unverified; if a real failure shows up, report it rather than adding a fallback parser.
- Evaluating a site config runs its top-level code; that is what `astro build` does too.

## Reviewer guidance

- `schema.ts` must not import `config.ts` (C-004). Grep for it.
- No index-name literal left in `check-links.mjs` except the documented default.
- Every refusal test has a passing twin on the same fixture.

## Branch Strategy

Planning base branch and merge target: `fix/route-rule-consolidation`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP01 --agent <name> --mission route-rule-consolidation-01M4WE27
```
