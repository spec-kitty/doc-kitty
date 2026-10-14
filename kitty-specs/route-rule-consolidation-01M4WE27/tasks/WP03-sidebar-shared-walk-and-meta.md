---
work_package_id: WP03
title: Sidebar on the shared walk and route rule, _meta excluded
dependencies:
- WP02
requirement_refs:
- FR-009
- FR-010
- C-005
planning_base_branch: fix/route-rule-consolidation
merge_target_branch: fix/route-rule-consolidation
branch_strategy: Planning artifacts for this mission were generated on fix/route-rule-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/route-rule-consolidation unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-route-rule-consolidation-01M4WE27
base_commit: 46122b0455cc474c153be125f52ea5a76a718bb3
created_at: '2026-10-14T06:56:33.425077+00:00'
subtasks:
- T013
- T014
- T015
- T016
- T017
agent: claude
history:
- timestamp: '2026-10-14T06:16:49Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/config.ts
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/config.ts
- src/lib/docs-walk.mjs
- src/tests/sidebar-build-html.test.ts
role: implementer
---
# WP03 — Sidebar on the shared walk and route rule, `_meta` excluded

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

The sidebar decides what a folder's index page is with the shared route rule, and reads the docs tree through the shared walk. The shared walk excludes `_meta` folders at any depth and `_meta.md`/`_meta.mdx` files, so nothing under `_meta` reaches the loader, the route table, the link check or the sidebar, while the registry YAML files in `docs/_meta/` still load through their catalog loaders.

Requirements: FR-009, FR-010 (spec User Story 4, scenarios 1 to 4; edge cases `_meta.md`, `guide/_meta/`). Plan: IC-03. Decision `01M4WE30W61BS7CG5D0KH99T0T`. Data model: "Docs walk", invariant 4.

## Why this is broken today

- `src/lib/config.ts:1447-1495` `directoryMetaInputs` has its own `readdirSync` walk (skips `_meta` and dot-folders at any depth, `log.md`), separate from `walkMarkdownPaths`.
- `isIndex` is `slug !== rel.replace(/\.mdx?$/i, '')`: "the id differs from the path". With names `['index']`, a draft `x/README.md` and a published `x/index.md`, the published `x/index.md` has id `x/index` (served at `/x/` by `routeOfSlug`), so `isIndex` is false and the folder shows its raw directory name (issue 138).
- `src/lib/docs-walk.mjs:23` `walkMarkdownPaths` does not exclude `_meta`, so `docs/_meta/x.md` gets a route in the loader, route table and link check.
- `config.ts:284-295` `topLevelContentDirs` skips `_meta` with its own check (`:295`).

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

## Allowed out-of-map edits

- **`src/lib/schema.ts` `DEFAULT_DOCS_PATTERN` (`:307`)**: add `'!**/_meta/**'` and `'!**/_meta.{md,mdx}'` so the loader's glob and the walk agree. The pattern-equality guard right below it compares against this constant, so it moves with it automatically. Reason: FR-010 loader side; WP01 owns `schema.ts` and has landed.
- **`src/tests/route-table.test.ts`** (WP02 owns, landed): one case that `buildRouteTable(walkMarkdownPaths(tmp))` gives no route for `_meta/x.md`, `guide/_meta/y.md`, `_meta.md`, with an ordinary `guide/z.md` keeping its route (positive control). Reason: the walk is the route table's only input.
- **`src/tests/route-shaping.test.ts`** (WP04 owns; WP04 now depends on you, so this never races): the sidebar index-rule cases of T013. It already drives `directoryMetaInputs` through `routeShapingSource` (`:483-581`, `data.directoryMeta`). Reason: strengthen the existing test that reaches the code (C-005 rule 2). Add a new test file only if no existing test reaches `directoryMetaInputs`, and justify it in the hand-off.
- **`src/tests/check-links-tightened.test.ts`** (WP01 owns, landed): the T014 `_meta` link-check case. Reason: FR-010 check surface.

## Subtasks

### T013 — Red first: sidebar and `_meta`

**Purpose**: show both symptoms today.

**Steps**: add the cases to `src/tests/route-shaping.test.ts`, through `routeShapingSource` (`config.ts:1513`, the seam that calls `directoryMetaInputs` at `:1518`), next to the existing `directoryMeta` cases (`:483-581`). Do not export `directoryMetaInputs`. Put case 3 in `route-table.test.ts`. Fixtures in temp folders:

1. Names `['index']`, draft `x/README.md`, published `x/index.md` (title "Index title"), drafts off: the folder's index input is `x/index.md` with its title. Red today.
2. Names `['README']`, draft `x/README.md`, published `x/other.md`, drafts off: no index input titled from the draft README; matches the route table's view of `/x/` (no page at `/x/`).
3. `_meta/x.md`, `guide/_meta/y.md`, `_meta.md`, `guide/z.md`: only `guide/z.md` appears (in the walk, and so in the route table). Red today for the walk.
4. Positive control: published `x/README.md` with names `['README']` is the folder index, unchanged.

**Validation**: cases 1 and 3 red; keep the output.

### T014 — The walk excludes `_meta`

**Steps**: in `docs-walk.mjs`, skip any folder named `_meta` at any depth and any file whose stem is `_meta` (`_meta.md`, `_meta.mdx`). Keep the existing dot-name and `log.md` rules. Update the module's doc comment with the reason (decision `01M4WE30W61BS7CG5D0KH99T0T`). Then the `schema.ts` pattern edit above.

**Validation**: T013 case 3 green. In `check-links-tightened.test.ts`, one fixture tree holds `_meta/x.md` with a broken link and `guide/y.md` with a broken link: `check-links --strict` reports `guide/y.md` and reports nothing for `_meta/x.md`. Catalog loaders still load: run the tests that read `docs/_meta/bibliography.yaml` / `tools.yaml` (grep `src/tests` for `bibliography` and run those files) as the positive control.

**Edge cases**: match `_meta` exactly (not `_metadata`); case: match the name as written (folders are author-created).

Other walks in the tree, decided here (state each in the hand-off as done):

- `src/scripts/check-links.mjs:141` `walk`: keep. The non-strict mode checks links as GitHub renders them, a deliberately different view (comment at `:139`), and GitHub renders `_meta` Markdown, so the non-strict walk keeps scanning it. `--strict` uses the shared walk and so skips `_meta`.
- `src/scripts/assert-no-broken-links.mjs`: keep. It walks the built `dist/` output, not the docs tree (verify by reading its walk and say so).
- `src/scripts/validate-frontmatter.mjs:238`: moved to `walkMarkdownPaths` by WP02 (verify it is).
- `src/lib/gherkin/load.mjs:113-155` `walkFeaturePaths`: keep. It walks `.feature` sources, not docs Markdown, with its own `SKIP_DIRS`.

### T015 — `directoryMetaInputs` on the shared walk and rule

**Steps**:

1. Replace the private `walk` with `walkMarkdownPaths(root)`, then read frontmatter for each returned path.
2. Compute the slug with `resolveIndexEntries` (no demotion after WP02) and `isIndex` as "this page's route is its folder's route": `routeOfSlug(slug)` equals `routeOfSlug(folderSlug)`, where `folderSlug` is the folder containing `rel` (`''` for root files, giving `/`). Both sides go through `routeOfSlug`; no hand-built route string (the FR-003 guard of WP04 scans `config.ts` after you land).
3. Keep the published-only filter (`unpublishedPaths`) after ids are resolved, as today.
4. `topLevelContentDirs` (`:284-295`): keep skipping `_meta`, with a comment pointing at the same decision, so both rules visibly agree.
5. Update the doc comment at `:1436-1446`: it no longer has "its own walk", and there is no "demoted" page.

**Validation**: T013 cases 1, 2, 4 green.

**Edge cases**: the bundle root: `README.md` at the root has slug `''` / id `index`; its route is `/`, the root folder route, so `isIndex` is true as today. A file `x.md` next to folder `x/` is not the index of `x/` (route `/x/` equals folder route `/x/`!). Check: today `x.md` has slug `x`, route `/x/`, and its own folder is the parent (`/`), so compare with the containing folder, not with a same-named folder. Add this as a case.

### T016 — Output stays the same for the example

**Purpose**: NFR-001 for sidebar markup.

**Steps**: run `sidebar-build-html.test.ts` (build suite; needs PlantUML locally). In addition, and required whether or not that suite runs: build the example without the change (`git stash`) and with it, and diff the sidebar markup of every `dist/**/index.html`. Put the diff result (empty, or each change with its reason) in the hand-off. Research S4 predicts no label change for the example.

**Validation**: no unexpected label change; any change is listed with its reason.

### T017 — Clean up readers of the old model

**Steps**: `grep -rn "demoted\|winner\|isIndex" src/lib/config.ts` and fix stale comments. Run `route-shaping.test.ts`, `draft-publication.test.ts`, `relative-md-links.test.ts`, `section-type-parity.test.ts`, `config-invariants.test.ts` and the docs-root test (all call into `config.ts`).

## Test strategy

Strengthened: `route-shaping.test.ts` (cases 1, 2, 4 plus the `x.md`-next-to-`x/` case), `route-table.test.ts` (walk case 3), `check-links-tightened.test.ts` (`_meta` link case with its outside-`_meta` control). No new test file. Build-level check: `sidebar-build-html.test.ts`. Restore `DK_INDEX_BASENAME` in `afterEach` if your test calls `defineDocKittyIntegrations`.

## Definition of Done

- Sidebar index decision uses `routeOfSlug`; the walk is `walkMarkdownPaths`; `_meta` excluded everywhere; registry YAML still loads.
- Owned and named tests green; `tsc --noEmit` clean.
- Hand-off: tests table, out-of-map edits, sidebar output comparison result.

## Risks

- Playwright a11y baselines cover sidebar markup; an unintended label change shows there in CI.
- `route-shaping.test.ts` is WP04's file; your cases land first and WP04 builds on them.

## Reviewer guidance

- No second walk left in `config.ts` for Markdown files.
- `isIndex` derives from routes, not from comparing ids with paths.
- The `_meta` YAML positive control ran.

## Branch Strategy

Planning base branch and merge target: `fix/route-rule-consolidation`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP03 --agent <name> --mission route-rule-consolidation-01M4WE27
```
