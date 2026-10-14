---
work_package_id: WP04
title: Address builders onto the shared route rule, with a guard
dependencies:
- WP03
requirement_refs:
- FR-001
- FR-002
- FR-003
- NFR-001
- NFR-002
- NFR-004
- SC-001
- C-001
- C-005
planning_base_branch: fix/route-rule-consolidation
merge_target_branch: fix/route-rule-consolidation
branch_strategy: Planning artifacts for this mission were generated on fix/route-rule-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/route-rule-consolidation unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-route-rule-consolidation-01M4WE27
base_commit: 7a5ed72e08d575d04e0ceeda37028639e9a8c07b
created_at: '2026-10-14T07:08:18.772730+00:00'
subtasks:
- T018
- T019
- T020
- T021
- T022
- T023
agent: claude
history:
- timestamp: '2026-10-14T06:16:49Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/metadata.ts
create_intent:
- src/tests/route-address-guard.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/metadata.ts
- src/lib/route-shaping.ts
- src/lib/routes/rss.ts
- src/lib/routes/llms-txt.ts
- src/lib/routes/scenario-index.ts
- src/lib/routes/shared.ts
- src/lib/with-base.ts
- src/layouts/Hub.astro
- src/components/slots/OnThisPage.astro
- src/components/slots/Related.astro
- src/scripts/assert-build-artifacts.mjs
- src/tests/route-feeds.test.ts
- src/tests/route-shaping.test.ts
- src/tests/scenario-index.test.ts
- src/tests/agent-api.test.ts
- src/tests/resolvers.test.ts
- src/tests/route-address-guard.test.ts
role: implementer
---
# WP04 — Address builders onto the shared route rule, with a guard

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Every surface that lists a page (RSS, `llms.txt`, related links, the Hub, the scenario index, the on-this-page block, the agent API) gives the address the site serves. A page with id `guide/index` is listed at `<base>/guide/`, the root page at `<base>/`, an ordinary `guide/setup` unchanged. A guard test stops anyone building `/${slug}/` by hand again.

Requirements: FR-001, FR-002, FR-003, NFR-001, NFR-002 (spec User Story 1, scenarios 1 to 3). Plan: IC-04. Data model: "Page address", invariant 1. Independent of WP01 to WP03.

## Why this is broken today

Each of these builds `/${slug}/` itself instead of calling `routeOfSlug` (`src/lib/vocabulary-core.mjs:935`), which strips a trailing `/index` and maps `''` and `index` to `/`:

- `src/lib/metadata.ts:331` `routeFor` (used by `toAgentRecord.route` at `:348` and `resolveRelated` at `:619`; `OnThisPage.astro` and `Related.astro` reach it through `resolveRelated`). Reserved id `index` gives `/index/`.
- `src/lib/routes/rss.ts:46`, `src/lib/routes/llms-txt.ts:145`, `src/lib/routes/scenario-index.ts:370`.
- `src/lib/route-shaping.ts:93` `indexHref`.
- `src/layouts/Hub.astro:58-60` `hrefFor`.

`vocabulary-core.mjs` is owned by WP02; you only **import** `routeOfSlug` from it. Do not edit it.

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

- **The non-address lines listed in T021 edge cases, in `src/lib/config.ts`, `src/lib/draft-publication.mjs`, `src/lib/favicon.ts`, `src/lib/deck/deck-slug.ts`**: only a rewrite of that expression so the guard does not match it, with identical output. Reason: FR-003 guard without an allow-list. WP02 and WP03 have landed before you.

`OnThisPage.astro:246` and `Related.astro:55` build `withBase(\`/${card.ref}/\`)` themselves; both are now in `owned_files` and move to `withBase(routeOfSlug(card.ref))` in T020.

You depend on WP03 because the guard (T021) scans `src/lib/config.ts`, which WP03 rewrites, and because WP03 adds sidebar cases to your `route-shaping.test.ts`. Start from WP03's merged state.

## Subtasks

### T018 — Red first: `/index` ids on every surface

**Purpose**: show each surface advertising an unserved address.

**Steps**: through each module's existing test entry point, add a fixture entry with id/slug `guide/index`, one with the reserved root id `index` where the surface can see it, and `guide/setup` as the positive control:

- RSS and `llms.txt`: `route-feeds.test.ts`.
- Scenario index: `scenario-index.test.ts`.
- `toAgentRecord.route` and `resolveRelated`: `agent-api.test.ts` / `resolvers.test.ts` (whichever already drives each).
- `indexHref`: `route-shaping.test.ts`; also assert `slugOfHref(indexHref(slug))` round-trips (`route-shaping.ts:225`) for `guide/index`, `index` and `guide/setup`.
- On-this-page block (`OnThisPage.astro`) and Related surface (`Related.astro`): move their href construction into the same tested helper as the Hub (T020) and test it there.
- Hub: `Hub.astro` has no unit seam; move `hrefFor` into a tested helper (see T020) and test the helper.

Assert `guide/index` -> `/guide/` (plus base/site), `index` -> `/`, `guide/setup` -> `/guide/setup/`. The root id `index` is asserted on every surface. If a surface cannot receive id `index`, say which and why in the hand-off.

**Validation**: the `/index` rows are red today on each surface; keep the output.

### T019 — `metadata.ts` onto `routeOfSlug`

**Steps**: delete `routeFor` (`:331`; C-001: not kept as a parallel rule). `toAgentRecord.route = routeOfSlug(slug)`; `resolveRelated` href `withBase(routeOfSlug(slug))`. Update the doc comments that cite `routeFor` in `metadata.ts:613`, `routes/shared.ts:123-124`, `with-base.ts:8`.

**Validation**: T018 agent/related rows green.

**Edge cases**: the agent API `route` is a base-less committed contract; it stays base-less, only the `/index` suffix goes away.

### T020 — Feeds, scenario index, route shaping, Hub

**Steps**: replace each hand-built address with `routeOfSlug(slug)` (wrapped in `absolute(site, ...)` for feeds/`llms.txt`/scenario index, `withBase(...)` for HTML). Remove the `entry.slug === '' ? '/' : ...` special cases; `routeOfSlug('')` is `/`. In `OnThisPage.astro` (`:246`) and `Related.astro` (`:55`), replace `withBase(\`/${card.ref}/\`)` with `withBase(routeOfSlug(card.ref))` through the same helper. In `Hub.astro`, replace `hrefFor` with `withBase(routeOfSlug(slug))` (or the existing helper `with-base.ts` exposes); keep the existing trailing-slash behaviour of `BASE_URL`.

**Validation**: T018 green on every surface.

**Edge cases**: `route-shaping.ts:157` builds a base prefix, not a page address; leave it, and make the guard (T021) not flag it.

### T021 — The guard (FR-003)

**Purpose**: issue 134 cannot come back.

**Steps**: create `src/tests/route-address-guard.test.ts`. Read every `.ts`, `.mjs`, `.astro` under `src/lib/`, `src/layouts/`, `src/components/` except `src/lib/vocabulary-core.mjs`; strip `//` and `/* */` comments (and `<!-- -->` in `.astro`); fail on any template literal of the shape `` `/${…}/` `` whatever identifier is inside (for example `entry.slug`, `p.slug`, `id`, `card.ref`). Report file and line. `src/lib/config.ts` is in scope (WP03 has landed).

Positive control in the same test: run the same scanner function over a planted string (an in-memory file with `` `/${entry.slug}/` ``) and assert it is flagged, plus a planted comment containing the pattern that is not flagged.

**Validation**: guard passes on the tree after T019/T020; fails if you revert one surface (try it).

**Edge cases**: these lines build something other than a page address: `route-shaping.ts:157` (base prefix), `config.ts:363` and `:1684` (`page.pathname`), `with-base.ts:41`, `draft-publication.mjs:358-359`, `favicon.ts:52`, and comments in `src/lib/deck/deck-slug.ts`. Handle them first by rewriting the line so it does not match (or by comment stripping for `deck-slug.ts`), so the guard has no allow-list. Re-read each line before deciding; the line numbers are from planning. If one entry is unavoidable, name it in the guard (file and the exact expression, not a line number) and add a test asserting that expression is not a page address (for example: its output is a base prefix or an existing `page.pathname`, not `routeOfSlug` of an id). Every line you rewrote outside `owned_files` is an out-of-map edit: record it in the hand-off. Note `config.ts` and `draft-publication.mjs` belong to WP03/WP02, which have landed.

### T022 — Example output and BA-3

**Purpose**: NFR-001, NFR-002; example-pin tests.

**Steps**:

1. NFR-001. The example's only `index.md`-indexed folder is `example/docs/plans/` (research S4). Build the example on the base (`git stash`) and on your head, then `diff -r` the two `dist/` folders and list every changed file in the hand-off, each with its reason. Do not reason it out instead. If no local build is possible, write "NFR-001 OPEN for CI" in the hand-off.
2. `src/scripts/assert-build-artifacts.mjs` (`EXPECTED_PAGE_KEYS` at `:176`, the `/adr/` README proof at `:208-223`; BA-3 reads agent-API `route`) and `agent-api.test.ts` pins: update any expectation that encoded `/plans/index/` or `/index/`, with a comment naming FR-001.
3. Determinism: the two-build gate must stay byte-identical; nothing here adds ordering.
4. NFR-004. On the same machine, time the example build 3 times on the base and 3 times on your head. Report both medians in the hand-off. Fail the work package if the head median exceeds the base median by more than 10%. If no local build is possible, write "NFR-004 OPEN for CI" in the hand-off.

**Validation**: `agent-api.test.ts`, `route-feeds.test.ts`, `scenario-index.test.ts`, `resolvers.test.ts`, `route-shaping.test.ts`, `hub-children.test.ts`, `llms-section-order.test.ts`, `sitemap-feeds.test.ts`, `absolute-url-base.test.ts` green (run each).

### T023 — Sweep

**Steps**: `grep -rn '\`/\${' src/lib src/layouts src/components` and confirm each remaining hit is not a page address. `tsc --noEmit` clean.

## Test strategy

Strengthened: `route-feeds.test.ts`, `scenario-index.test.ts`, `agent-api.test.ts`, `resolvers.test.ts`, `route-shaping.test.ts`. New: `route-address-guard.test.ts` with its planted positive control. Each `/index` assertion is paired with `guide/setup` on the same fixture.

## Definition of Done

- No module outside `vocabulary-core.mjs` builds a page address from an id; `routeFor` is gone.
- Guard test in place, failing on a planted example.
- Changed example outputs listed from a `diff -r` of two builds (NFR-001), or "NFR-001 OPEN for CI" stated.
- Build time: base and head medians of 3 runs each, growth at most 10% (NFR-004), or "NFR-004 OPEN for CI" stated.
- Every surface asserts the root id `index`, or the hand-off names the surface that cannot and why.
- Hand-off: tests table, changed-output list.

## Risks

- BA-3 and agent-API pins move; that is intended for `/index` ids only. Any other change is a regression.
- The guard must not match comments or base-prefix builders.

## Reviewer guidance

- Check every surface in spec US1 scenario 1 is covered by a red-first test.
- Confirm the guard's planted control runs the same function as the tree scan.

## Branch Strategy

Planning base branch and merge target: `fix/route-rule-consolidation`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP04 --agent <name> --mission route-rule-consolidation-01M4WE27
```
