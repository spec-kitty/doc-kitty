---
work_package_id: WP02
title: Route-keyed collisions stop the build and the strict check
dependencies:
- WP01
requirement_refs:
- FR-004
- FR-005
- FR-006
- NFR-003
- SC-002
- C-005
planning_base_branch: fix/route-rule-consolidation
merge_target_branch: fix/route-rule-consolidation
branch_strategy: Planning artifacts for this mission were generated on fix/route-rule-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/route-rule-consolidation unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-route-rule-consolidation-01M4WE27
base_commit: dfaff3a5047e45108d2fb6d617696c7c1bf4a809
created_at: '2026-10-14T06:42:39.042629+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
agent: claude
history:
- timestamp: '2026-10-14T06:16:49Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/vocabulary-core.mjs
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/vocabulary-core.mjs
- src/lib/gherkin/generate.mjs
- src/scripts/validate-frontmatter.mjs
- src/tests/route-table.test.ts
- src/tests/index-basename.test.ts
- src/tests/vocabulary-core.test.ts
- src/tests/gherkin-generate.test.ts
role: implementer
---
# WP02 — Route-keyed collisions stop the build and the strict check

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Two published source paths that produce the same route stop the build, the loader and `dockitty-check-links --strict`, with one message that names every file, the route, and a fix. A Gherkin `index.feature` is rejected on any index-name setting. Drafts count.

Requirements: FR-004, FR-005, FR-006, NFR-003 (spec User Story 2, scenarios 1 to 6; edge cases on root, `.mdx`, letter case). Plan: IC-02. Research: S3. Contract: `contracts/collision-error.md`. Decision `01M4WENRXTXVQ7MEFV7EQXFMB2` (case-only collisions fail).

## Why this is broken today

- `src/lib/vocabulary-core.mjs:859-886` `groupIndexCollisions` groups by **index name per folder**, picks a winner by configured rank and demotes the rest. A demoted `x/index.md` gets id `x/index`, which `routeOfSlug` (`:935`) still serves at `/x/`. So with names `README` only, `x/README.md` + `x/index.md` report **zero** collisions and both land on `/x/` (research S3 table, issue 135).
- `resolveIndexEntries` (`:902`) applies the demotion; `buildRouteTable` (`:977`) and `detectIndexCollisions` (`:~1101`) inherit it.
- `src/lib/schema.ts:328-338` only `console.warn`s; `src/lib/config.ts:478` ignores `collisions`; `src/scripts/check-links.mjs:425-431` ignores them.
- `src/lib/gherkin/generate.mjs:240-251` rejects a leaf only if it is in the configured index names, so `x/index.feature` on a `README` site generates a page served at its folder's route (issue 137).
- `src/scripts/validate-frontmatter.mjs:625-635` prints the winner/demoted warning.

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

WP01 owns `schema.ts` and `check-links.mjs` and has landed before you start; WP03 owns `config.ts` and starts after you. The edits below are the minimum that wires the new collision report into each surface:

- **`src/lib/schema.ts` `resolveIds()` (`:324-340`)**: replace the `console.warn` loop with `if (collisions.length) throw new Error(formatRouteCollisions(collisions, { docsDir: base }))`. Update the loader's JSDoc paragraph about E-05 (`:286-294`) to say collisions are fatal. Reason: FR-004 loader surface.
- **`src/lib/draft-publication.mjs` (`:308`, `:341`)**: a comment only (T012 step 3). Reason: record that these callers deliberately do not throw.
- **Test files named in T012 step 4 that you do not own** (`schema-validator-parity.test.ts`, `section-type-parity.test.ts`, `gherkin-check-cli.test.ts`): only the pins this change moves. Reason: C-005 rule 6.
- **`src/lib/config.ts` base-absolute-links `astro:config:setup` (`:~478`)**: take `collisions` from the existing `buildRouteTable` call and throw the same formatted error. Reason: FR-004 build surface. Nothing else in `config.ts`.
- **`src/scripts/check-links.mjs` strict path (`:~425`)**: when strict, print `formatRouteCollisions(...)` to stderr after the other findings and exit 1. Reason: FR-005.
- **`src/tests/check-links-tightened.test.ts`**: add the strict collision case, its draft variant and its positive control. Reason: FR-005 entry point lives in that file.

## Subtasks

### T007 — Red first: the collision fixtures

**Purpose**: prove each case passes silently today.

**Steps**: in `src/tests/route-table.test.ts`, through `buildRouteTable(paths, { indexBasename, unpublishedPaths })`, add a table of fixtures from research S3 and assert `collisions` reports each (route, every path):

| Fixture | Names |
|---------|-------|
| `x/README.md` + `x/index.md` | `README` |
| same | `README,index` |
| `README.md` + `index.md` (root) | `README` |
| `x/index.md` + `x/index.mdx` | `README` |
| `x/README.mdx` + `x/index.md` | `README` |
| `x/Guide.md` + `x/guide.md` | `README` (case-only, decision `01M4WENRXTXVQ7MEFV7EQXFMB2`) |
| draft `x/README.md` + `x/index.md`, passed as `unpublishedPaths` | `README,index` |

Positive controls on the same fixtures with one file removed: `x/README.md` alone -> no collision, `/x/`; `x/README.md` + `x/other.md` -> none.

**Validation**: rows 1, 3, 4, 5, 6 report zero today (red). Keep the output.

### T008 — Group by route

**Purpose**: one rule for one question (C-001; research S3 "alternatives").

**Steps**:

1. Rewrite `groupIndexCollisions` to: compute the id for each path with `readmeToIndexId` (no demotion), the route with `routeOfSlug`, key by `route.toLowerCase()`, keep groups with more than one path. Shape: `RouteCollision { route, paths }` (`data-model.md`): `route` is the route of the first path in code-unit order, `paths` code-unit sorted, groups sorted by route (code-unit). Update the JSDoc typedef; remove `IndexCollision`.
2. `resolveIndexEntries`: drop the rank-based demotion; `ids` is `readmeToIndexId` for every path. Keep returning `{ ids, collisions }`.
3. `buildRouteTable`: collisions computed over **all** paths, before `unpublishedPaths` are dropped (it already resolves ids first, `:977-987`), so drafts on or off report the same (US2 scenario 5).
4. `detectIndexCollisions`: return the route-keyed shape too (it is the bare-Node twin); rename only if every caller moves with it.
5. Update comments that describe "winner"/"demoted" (including the `routeOfSlug` JSDoc at `:~920` that mentions "an index.md demoted by a sibling README.md").

**Validation**: T007 table green; existing `route-table.test.ts` cases green.

**Edge cases**: route table keys must stay code-unit sorted (determinism, NFR-002). The case-insensitive key widens the check to ordinary pages; research S4 found none in either tree.

### T009 — One formatter

**Purpose**: NFR-003; the wording cannot drift between three surfaces.

**Steps**: add `export function formatRouteCollisions(collisions, { docsDir })` to `vocabulary-core.mjs`, producing the text in `contracts/collision-error.md`: header with count and `docsDir`, groups (route then indented `docsDir`-prefixed paths), the fix sentence naming the second path of the first group, the draft sentence. Base-less routes.

**Validation**: a test asserts the message contains every colliding path (with the prefix), the route, the words "Rename or remove", and the draft sentence. Not a snapshot.

**Edge cases**: a collision involving a generated glossary or Gherkin page keeps the existing ADR-0048 error (raised earlier by the generators). Add a test: an authored page at a generated glossary hub route and one at a generated Gherkin hub route each raise exactly one error, the ADR-0048 one; assert the route-collision text ("Rename or remove") is absent. Pair each with a positive control (the authored page renamed: no error).

### T010 — Wire the three surfaces

**Steps**: the three out-of-map edits above. Loader and integration throw `Error(message)`; check-links strict prints to stderr and exits 1 after other findings; non-strict check does nothing new.

**Validation**:

- Loader: a temp tree `x/README.md` + `x/index.md` throws naming both; `x/README.md` alone loads (positive control). Put this in `index-basename.test.ts`, which already drives the loader.
- check-links: `--strict` on the same tree exits 1 with both paths on stderr; without the second file, exit 0.
- check-links draft variant: repeat the strict collision with `x/README.md` marked `draft: true`; exit 1 with both paths named, the same as the published case (drafts count, US2 scenario 5).
- Integration: add a case that runs the base-absolute-links `astro:config:setup` hook through `defineDocKittyIntegrations(...)` (find the hook in the returned integration list and call it with a minimal `config`/`updateConfig` stub) and assert it throws on the collision tree and not on the control tree. Name that seam in the hand-off. If the hook cannot be called without a real Astro run, name the CI job that covers the throw instead (the example build job), and say which.

### T011 — Gherkin `index.feature`

**Purpose**: FR-006 (issue 137).

**Steps**: in `generate.mjs` near `:245`, also reject when the leaf slug is `index`, on any setting, with the message from the contract (`[dk-gherkin] reserved output name: ... which the site serves at its folder's address (/<section>/x/). Rename the feature file.`). Keep the existing configured-name rejection.

**Validation**: `gherkin-generate.test.ts`: `x/index.feature` on a `README`-only setting throws, naming the feature file; `x/other.feature` in the same source generates (positive control).

### T012 — Rewrite the winner/demote pins and the validator

**Purpose**: tests pinning today's behaviour move deliberately (C-005 rule 6).

**Steps**:

1. `index-basename.test.ts:68-100` and `:197+` and `vocabulary-core.test.ts:182-190` pin winner/demoted. Rewrite each to the route-keyed expectation with a comment `// FR-004: collisions are fatal and route-keyed; no winner`. Do not delete them silently; if two now assert the same thing, RETIRE one and say which in the hand-off.
2. `validate-frontmatter.mjs:625-635` (`detectIndexCollisions` at `:627`): report each collision as an error (non-zero exit) using `formatRouteCollisions`, matching the build. Feed it from `walkMarkdownPaths` (`src/lib/docs-walk.mjs`) instead of the validator's own walk at `:238`, which skips no dot-names, `log.md` or `_meta`; then the validator and the loader see the same paths. Index names arrive through `resolveSiteIndexBasenames` (WP01). Check `schema-validator-parity.test.ts` and `section-type-parity.test.ts` still pass; they may compare the validator and loader.
3. `src/lib/draft-publication.mjs:308` (`draftRoutesOf`) and `:341` (`unpublishedDraftPaths`) call `buildRouteTable`. Decision: they do not throw on collisions; the build's own check throws first. Leave them reading `routes` only, and add a comment at each call saying so.
4. Pins that move with this change, each rewritten deliberately with the FR-004 comment (rule 6): `index-basename.test.ts`, `vocabulary-core.test.ts`, `schema-validator-parity.test.ts`, `section-type-parity.test.ts`, `gherkin-generate.test.ts`, `gherkin-check-cli.test.ts`, `check-links-tightened.test.ts`, `route-table.test.ts`. List each in the hand-off with what moved, or "unchanged".
5. Search for other `winner`/`demoted` readers: `grep -rn "demoted\|winner" src/lib src/scripts src/tests`. Fix readers in your owned files; list any outside them in the hand-off (WP03 handles `config.ts` `directoryMetaInputs`).

**Validation**: all owned test files green; `draft-publication.test.ts`, `draft-publication-build.test.ts` (build suite: CI if no PlantUML locally, said in the hand-off), `schema-validator-parity.test.ts`, `section-type-parity.test.ts`, `gherkin-check-cli.test.ts` green.

## Test strategy

Strengthened: `route-table.test.ts` (fixture table), `index-basename.test.ts` (loader throw + control, rewritten pins), `vocabulary-core.test.ts` (rewritten pin), `gherkin-generate.test.ts` (index leaf + control), plus one case in `check-links-tightened.test.ts`. Revert each fix and watch its test fail.

## Definition of Done

- Every S3 fixture row fails the loader and `check-links --strict` with all paths named; each positive control passes.
- `index.feature` is rejected on any setting.
- No `winner`/`demoted` concept left in `vocabulary-core.mjs`.
- `node src/scripts/check-links.mjs docs example/docs` still exits 0 (research S4: no collisions in either tree); output in the hand-off.
- Hand-off: tests table, out-of-map edits, list of rewritten pins.

## Risks

- Tests pinning winner/demote are rewritten, not dropped.
- `config.ts` `directoryMetaInputs` uses `resolveIndexEntries`' ids to compute `isIndex`; with demotion gone, its result for a collision case is moot (the build throws first). Leave it for WP03.
- Case-insensitive grouping is broader than index files; mention it clearly in the hand-off for the ADR (WP06).

## Reviewer guidance

- Grouping keyed by `routeOfSlug(...).toLowerCase()`, not by folder or name.
- One formatter, three call sites; no copy of the message text elsewhere.
- Draft case reports the same with `unpublishedPaths` set or empty.

## Branch Strategy

Planning base branch and merge target: `fix/route-rule-consolidation`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP02 --agent <name> --mission route-rule-consolidation-01M4WE27
```
