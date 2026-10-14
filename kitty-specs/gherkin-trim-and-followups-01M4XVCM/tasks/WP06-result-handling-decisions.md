---
work_package_id: WP06
title: CI-required report, stale include note and hand-mounted route warning
dependencies:
- WP02
- WP03
- WP04
- WP05
requirement_refs:
- FR-006
- FR-007
- FR-008
- NFR-006
- NFR-007
- C-001
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-followups-01M4XVCM
base_commit: 6eb8a5accf7c894863e7ed2b222238a94fcc77ee
created_at: '2026-10-14T19:50:09.170794+00:00'
subtasks:
- T027
- T028
- T029
- T030
- T031
- T032
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/config.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/config.ts
- src/lib/gherkin/options.mjs
- src/lib/gherkin/mdast.mjs
- src/lib/gherkin/include.mjs
- src/lib/routes/scenario-index.ts
- src/lib/vocabulary-core.mjs
- src/lib/gherkin-scenario-index-module.d.ts
role: implementer
---
# WP06 — CI-required report, stale include note and hand-mounted route warning

## Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill (`implementer-ivan`). Apply its boundaries and directives for the whole WP and state in your hand-off which ones you applied.

## Behaviour-change rules

- **Red first** through the existing entry points (the integration, the remark plugin, the build). Write the failing test, show it red, then implement.
- **Strengthen existing tests** before adding files (DIRECTIVE_041). Each new assertion has a paired positive control so it cannot pass vacuously (tactic acceptance-criteria-non-vacuity).
- Test files owned by a trim WP that you edit are named out-of-map edits: list them in the hand-off with the rationale. You always run after that trim WP, never concurrently.

## Objective

FR-006..008 per `contracts/results-required.md`, `contracts/stale-include-note.md`, `contracts/hand-mounted-route-warning.md` (plan IC-06).

**GitHub Actions sets `CI=true`.** Every build spawned in tests must set `CI` explicitly (`''` or `'true'`). The existing "missing report warns" build test goes red in CI unless it pins `CI=''`.

Out-of-map test edits (you follow their trim owners): `gherkin-results-build.test.ts`, `gherkin-results-render.test.ts`, `scenario-index.test.ts` (WP02); `gherkin-options.test.ts`, `gherkin-mdast.test.ts` (WP03); `gherkin-include.test.ts` (WP04, a dependency) only if the stale note cannot be tested at mdast.

**Code facts (brownfield scout, 2026-10-14):**
- The detection function is `hasOwnScenarioIndexPage` (`config.ts:1426`), called only inside the gherkin generate integration (`:1364`): hand-mount detection runs only when `gherkin.sources` generates pages. Test it in that setup.
- The report is loaded in three places: `checkResultsReport` (`config.ts:1447`), `routes/scenario-index.ts:392`, `remark/gherkin-fence.ts:723`. The CI-required rule lives **only** in `checkResultsReport`; the other two stay quiet when the report is missing.
- `DK_GHERKIN_RESULTS` (`include-scan.mjs:130`; set/cleared `config.ts:1982-1983`; read `schema.ts:593`) keeps its current meaning. Reuse it unchanged or add a separate env var for the route warning.
- The CLI `generate-feature-pages.mjs` never reads results: no `required` twin there.
- `GHERKIN_RESULTS_KEYS` (`options.mjs:68`, validated `:158`): adding `required` changes the error text pinned by the gherkin-options tests; update those pins in the same commit.
- Stale-note seams: `mdast.mjs:406`; fence counterpart `gherkin-fence.ts:490`.
- The route has no logger: `console.warn` + module-level `warned` flag + `@internal` reset. Injected route: `scenario-index-injected.ts:11`.
- Tests that inherit `CI=true` in GitHub Actions: `gherkin-results-build.test.ts:139` and `gherkin-results-render.test.ts:441` (in-process setup hook: set `process.env.CI` there and restore it after). `scenario-index.test.ts:378+` is unaffected. The example has `reports/cucumber.ndjson` (`example/astro.config.mjs:129`).

## Subtasks

- **T027** Pin `CI` in the spawn env of **every** results-build case; add the three-state matrix (CI set + missing → fail; CI unset → warn; `required: false` → warn in CI). Red first: CI=true case. Add: Empty or malformed report with CI set throws (unchanged).
- **T028** `checkResultsReport`, `isCiEnv` in config.ts; `required` option validation in `options.mjs`.
- **T029** Stale note on a single-scenario include result line (mdast). Red first, paired fresh control. Add: A stale-note include whose scenario is missing from the report shows the note and does not throw.
- **T030** Hand-mounted route warning in `routes/scenario-index.ts` and `ownScenarioIndexPage`: warns once; no warning with results; no warning without `gherkin.results`. Export an `@internal` reset for the module-level `warned` flag. Clear the published env when no route is hand-mounted. Assert ONE warning across a build with ≥ 2 pages (once per build).
- **T031** Confirm the example's committed demo report exists in CI so the repo build stays green; example output unchanged (NFR-006).
- **T032** Hand-off: red/green evidence and out-of-map edits.

## Shared context (all work packages)

- **Mission documents**: `kitty-specs/gherkin-trim-and-followups-01M4XVCM/spec.md`, `plan.md` (Implementation Concern Map), `research.md`, `research/baseline.md`, `research/coverage-map.md`, `research/count-lines.mjs`, `data-model.md`, `contracts/*.md`, `quickstart.md`, `decisions/DM-*.md`.
- **Do not add, upgrade or remove a dependency** (DIRECTIVE_051). Stop and report if one seems needed.
- **Test economy (C-001, DIRECTIVE_041)**: strengthen existing tests before adding new ones; every new guard has a paired positive control (tactic acceptance-criteria-non-vacuity).
- **Frozen shared helpers**: `src/tests/helpers/*` and `tests/a11y/{mode,routes}.ts` are not edited by any WP.
- **Pinned baselines**: pinned a11y and example-output baselines must not change (NFR-006), except where FR-007/FR-009 intends it.

## Environment gotchas

- Run vitest from `src/` with `node_modules/.bin/vitest run <files>`. Do not use `pnpm exec` (it has install side effects). Run other bins directly too.
- If the default npm registry is unreachable, use `https://registry.npmjs.org/`.
- In markdown, never start a line with `#` followed by a digit (C-005; the doc sanity gate fails).
- The ADR index is generated: `node src/scripts/generate-adr-index.mjs`. Never edit it by hand.
- Example builds create directories relative to `example/`; delete any stray output dirs they leave before committing.
- PlantUML being absent locally is expected; related local reds are not yours. CI is the verifier.
- Commit only your owned files. A file outside `owned_files` is an out-of-map edit and must be named with a rationale in your hand-off.
