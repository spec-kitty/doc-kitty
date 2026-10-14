# Implementation Plan: Gherkin test trim, scenario-results follow-ups and a translatable Overview label

**Branch**: `chore/gherkin-trim-and-followups` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)
**Input**: `kitty-specs/gherkin-trim-and-followups-01M4XVCM/spec.md` (issues #161 and #166). Spike evidence is in [research.md](research.md).

## Summary

The headline is a test-only trim of the Gherkin and scenario-results suites. The baseline is 9,321 test lines and 2,784 fixture lines at `050b168c` ([research/baseline.md](research/baseline.md)). The target is at least 30% fewer test lines and at least 25% fewer fixture lines. The trim is driven by a behaviour-row coverage map that is written before any test is removed. Next to it come small production changes:
- report text cannot reach any built output (a guard, FR-005);
- a missing report fails when `CI` is set, with the opt-out `gherkin.results.required: false` (FR-006);
- a stale-report note on single-scenario includes (FR-007);
- a once-per-build warning for a hand-mounted scenario route that is not given `results` (FR-008);
- an Overview label that can be translated (`dockitty.sidebar.indexLabel`) and overridden (`sidebar.indexLabel`) (FR-009/010);
- ADR-0056 and the docs.

## Technical Context

**Language/Version**: TypeScript 5.x and ESM JavaScript (`.mjs` with JSDoc types) on Node 22 (the CI node). Astro 5, Starlight 0.32.6.
**Primary Dependencies**: existing ones only: `@astrojs/starlight` (route-data middleware, `locals.t`, plugin `i18n:setup`/`injectTranslations`) and `@cucumber/*` (already used). No new dependencies.
**Storage**: files only. Cucumber reports, CCK fixtures, `example/reports/cucumber.ndjson` (tracked).
**Testing**: vitest (unit tests and build tests through `spawnSync` astro build in `example/`), Playwright plus axe (`tests/a11y/gherkin.spec.ts`), and the dist tripwire `src/scripts/assert-build-artifacts.mjs`. Line counts come from `research/count-lines.mjs`.
**Target Platform**: static Astro sites built locally and on GitHub Actions (`CI=true`).
**Project Type**: single package (`@spec-kitty/doc-toolkit`) plus the `example/` site.
**Performance Goals**: in-scope vitest median after the trim ≤ before × 1.10 (NFR-005).
**Constraints**: the trim changes only tests and fixtures (C-004). CCK fixtures are byte-identical to upstream (C-002). ADR-0055 is not edited (C-003). The only guards of path confinement, the size cap and privacy are kept (C-006). The pinned a11y and example baselines do not change except where FR-007 or FR-009 intends it (NFR-006).
**Scale/Scope**: 26 test files, 5 shared helpers, 64 fixtures, and 558 cases.

## Charter Check

| Gate | Status | Note |
|---|---|---|
| DIRECTIVE_041 (test economy: KEEP/RETIRE/SPLIT, strengthen before adding) and the development-assist-test-cleanup procedure | PASS (by design) | Map first, then trim. Every RETIRE names its survivor and asserting line. Reviewers break ≥20% of RETIREd behaviours. New guards for FR-005 to FR-008 extend existing tests (results-build, mdast/results-render, scenario-index), not new files. |
| DIRECTIVE_051 (no new dependencies without justification) | PASS | No new packages. The Starlight plugin hook and `locals.t` are part of the installed Starlight. |
| ADR discipline (accepted ADRs immutable) | PASS | ADR-0056 amends ADR-0055 (C-003). |
| BDD / specification-by-example | PASS | Each FR has a paired positive and negative control (spec "no-op passable: no"). |
| Mutation testing to validate test quality | PASS | NFR-004: at least one KEEP per family is broken on purpose. FR-004: 20% RETIRE spot-checks. |
| Changelog style (C-005) | PASS (IC-08) | — |

No violations, so the Complexity Tracking section is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/gherkin-trim-and-followups-01M4XVCM/
├── spec.md
├── plan.md
├── research.md
├── research/
│   ├── baseline.md          # frozen counts + commit SHA
│   ├── count-lines.mjs      # counting script (planning artifact, not shipped)
│   └── coverage-map.md      # behaviour rows, filled by IC-01..IC-04
├── data-model.md
├── quickstart.md
└── contracts/
    ├── overview-label.md
    ├── results-required.md
    ├── stale-include-note.md
    └── hand-mounted-route-warning.md
```

### Source Code (repository root)

```
src/lib/
├── config.ts                      # checkResultsReport (FR-006), ownScenarioIndexPage + env (FR-008),
│                                  # sidebar.indexLabel option + doc-kitty:i18n Starlight plugin + routeShapingSource (FR-009/010)
├── route-shaping.ts               # shapeSidebar opts.indexLabel (FR-009/010)
├── route-middleware.ts            # label = option ?? locals.t(key)
├── vocabulary-core.mjs            # (if) DK_GHERKIN_INDEX_ROUTE_ENV const beside existing env names
├── gherkin/options.mjs            # GHERKIN_RESULTS_KEYS += required; normalizeResultsOption
├── gherkin/mdast.mjs              # stale note on result line (FR-007)
└── routes/scenario-index.ts       # once-per-build warning (FR-008)
src/scripts/assert-build-artifacts.mjs   # leak tripwire over all of dist (FR-005)
src/tests/…                        # trim (IC-02..IC-04) + strengthened guards
src/tests/fixtures/gherkin/**      # CCK replacement, shared features
tests/a11y/gherkin.spec.ts         # trim
docs/adr/0056-*.md, CHANGELOG.md, docs guides (IC-08)
```

**Structure Decision**: a single package. No new modules, only seams in existing files.

## Implementation Concern Map

### File ownership (binding for task slicing)

| File set | Trim owner | Later behaviour editors (must follow the owner) |
|---|---|---|
| `gherkin-results`, `gherkin-results-render`, `gherkin-results-build`, `scenario-index` tests; `fixtures/gherkin/results/**` | IC-02 | IC-05 (results-build), IC-06 (results-render, results-build, scenario-index) |
| `gherkin-parse`, `-feature-core`, `-view`, `-select`, `-scenario-anchors`, `-render`, `-mdast`, `-fence`, `-fence-build`, `-generate`, `-codegen-guard`, `-check-cli`, `-options`, `-load`, `-integration`, `-example`, `-fixture-parity` tests; `fixtures/gherkin/{render,load,generate}/**` | IC-03 | IC-06 (options, mdast) |
| `gherkin-include`, `docs-loader-includes`, `docs-loader-includes-build`, `agent-page-includes` tests; `fixtures/gherkin/include/**`; `tests/a11y/gherkin.spec.ts` | IC-04 | IC-06 (include, only if the stale note is tested there; prefer mdast) |
| `src/tests/helpers/*`, `tests/a11y/{mode,routes}.ts` | nobody (shared, frozen) | — |
| route-shaping / route-middleware / config tests (outside this scope) | — | IC-07 |

A shared feature fixture that IC-03 and IC-04 both use (for example `book-consignment.feature`) is moved by **IC-03 only**. IC-04 updates its imports after IC-03 lands, or IC-04 depends on IC-03 for that one move. Tasks decide which.

### IC-01 — Baseline, coverage map, timing

- **Purpose**: freeze what "the same behaviour" means before anything is removed.
- **Relevant requirements**: FR-004, NFR-001..005.
- **Affected surfaces**: `research/baseline.md` (counts already recorded; add the suite timing), `research/coverage-map.md` (rows for all 558 cases, by family), `research/count-lines.mjs`.
- **Sequencing/depends-on**: none. It blocks IC-02, IC-03 and IC-04.
- **Risks**: rows that are too coarse hide lost guards. Each row is one input class → one output. Mark the C-006 rows. Confirm the fixture-cut route (baseline.md "Fixture risk": the CCK swap alone only gives 20%).
- **Red-first**: n/a. The verification is that every baseline test name appears in the map. A grep of `it(`/`test(` names against the map must show none missing.

### IC-02 — Trim the results suites and replace the top-level report fixtures with CCK

- **Purpose**: the largest single cut: format matrix with `it.each`, review-regressions folded, CCK in place of `cucumber-js.json`, `cucumber-jvm.json` and `messages.ndjson`.
- **Relevant requirements**: FR-001, FR-003, FR-004, NFR-002, C-002, C-006 (size cap, privacy).
- **Affected surfaces**: the IC-02 file set above.
- **Sequencing/depends-on**: IC-01.
- **Risks**: a case that only a top-level fixture (real cucumber-js 13.3.0 output, `PROVENANCE.txt`) exercises. Keep that fixture with a provenance reason. Keep the size-cap and privacy guards (C-006). Pinned example and a11y baselines must not move.
- **Red-first**: for each family, break one behaviour and show a KEEP going red (NFR-004). Break ≥20% of RETIRE rows (FR-004).

### IC-03 — Trim the core Gherkin suites

- **Purpose**: the same moves across parser, render, generate and options, with layer-duplicate assertions collapsed.
- **Relevant requirements**: FR-002, FR-003 (shared features), FR-004.
- **Affected surfaces**: the IC-03 file set above.
- **Sequencing/depends-on**: IC-01. Can run in parallel with IC-02 and IC-04 (no shared files).
- **Risks**: `gherkin-fixture-parity` and `gherkin-example` pin example output. `gherkin-generate.test.ts` (1,034 lines) is the biggest file, so split its work package by `describe` if needed, but keep one owner.
- **Red-first**: as in IC-02.

### IC-04 — Trim the adjacent include and loader suites and the a11y spec

- **Purpose**: decision 3. These suites repeat include assertions already made at the mdast layer.
- **Relevant requirements**: FR-002, FR-004, C-006 (include path confinement).
- **Affected surfaces**: the IC-04 file set above.
- **Sequencing/depends-on**: IC-01. Depends on IC-03 only if it uses a feature fixture that IC-03 moves.
- **Risks**: path confinement is a C-006 guard and must keep at least one test. The a11y spec trim must not change the pinned baselines.
- **Red-first**: as in IC-02. Break include confinement on purpose.

### IC-05 — No report text in any built output

- **Purpose**: FR-005 / US2.
- **Relevant requirements**: FR-005, SC-004, C-006.
- **Affected surfaces**: `src/tests/gherkin-results-build.test.ts` (the fixture report gets message, stack and attachment sentinels; a walk over all of the out dir; a status positive control); `src/scripts/assert-build-artifacts.mjs` (the `GHERKIN_RESULTS_LEAKS` loop walks every text file in dist).
- **Sequencing/depends-on**: IC-02 (same test file).
- **Risks**: an attachment sentinel may sit inside base64. Use a `text/plain` attachment whose body is the sentinel, and also check the base64-decoded form is absent. The walk must include `.txt` and `.json`.
- **Red-first**: inject the sentinel into a rendered output path on purpose (for example, let the message through in `results-overlay`) and show the test going red. Then revert.

### IC-06 — Result-handling decisions (FR-006..008)

- **Purpose**: CI-fail on a missing report with the `required: false` opt-out, the stale note on includes, and the hand-mounted-route warning.
- **Relevant requirements**: FR-006, FR-007, FR-008; contracts `results-required.md`, `stale-include-note.md`, `hand-mounted-route-warning.md`.
- **Affected surfaces**: `config.ts` (`checkResultsReport`, `isCiEnv`, `ownScenarioIndexPage`, env publish/clear), `gherkin/options.mjs`, `gherkin/mdast.mjs`, `routes/scenario-index.ts`, `vocabulary-core.mjs` (env const). Tests: `gherkin-options`, `gherkin-results-build` (pin `CI` in the spawn env for **every** case, then add the three-state matrix), `gherkin-mdast` or `gherkin-results-render` (stale vs fresh), `scenario-index` (warns once / no warning with results / no warning without `gherkin.results`).
- **Sequencing/depends-on**: IC-02 and IC-03 (test files). IC-05 also edits `gherkin-results-build`, so put IC-05 → IC-06 in series, or merge them into one work package.
- **Risks**: **GitHub Actions sets `CI=true`. The existing "missing report warns" build test goes red in CI unless it pins `CI=''`.** Leaking the module-level `warned` flag between tests: export a `@internal` reset, or reset modules per test. The env published for the route must be cleared when no route is hand-mounted.
- **Red-first**: write the CI=true case first and show it is red (today it only warns). Write the stale-include case first and show it is red (today it renders nothing). Write the warning case first and show it is red. Each one is paired with its control.

### IC-07 — Overview label: translation and option (#161)

- **Purpose**: FR-009/010 per the S1 decision.
- **Relevant requirements**: FR-009, FR-010, SC-005; contract `overview-label.md`.
- **Affected surfaces**: `route-shaping.ts` (`shapeSidebar` opts.indexLabel), `route-middleware.ts`, `config.ts` (validate `sidebar.indexLabel`, add `doc-kitty:i18n` to `starlight.plugins`, `indexLabel` in `routeShapingSource`), the existing route-shaping and route-middleware tests (outside the trim scope), and the type declaration `route-shaping-module.d.ts`.
- **Sequencing/depends-on**: none (independent of the trim). It edits `config.ts` in different functions from IC-06. If both run at once, merge serially.
- **Risks**: an adopter who already lists Starlight `plugins` must have DocKitty's plugin appended, not replace theirs. A key missing in a locale must fall back to `en` (Starlight's behaviour; assert it). Prev/next must keep the page title (an existing guard; see the operator question in research.md S1). NFR-006: the example output is unchanged because the default is still "Overview".
- **Red-first**: a `shapeSidebar` unit test with `indexLabel: 'Aperçu'` (red: the function ignores the option today). A middleware test with a stub `locals.t` returning a translation (red). The option-wins test (red). The default control stays green.

### IC-08 — ADR-0056, CHANGELOG and adopter docs

- **Purpose**: FR-011, FR-012.
- **Relevant requirements**: FR-011, FR-012, C-003, C-005.
- **Affected surfaces**: `docs/adr/0056-*.md` (Amends ADR-0055: zero-step scenarios show Not run; the heading-order overlay when there is no `generated.at`; the report is produced in CI rather than committed; missing report + CI; the stale note; the route warning), `CHANGELOG.md` (root, canonical; call out `required: false` for preview jobs), the gherkin results guide, and the sidebar/i18n guide.
- **Sequencing/depends-on**: IC-05, IC-06, IC-07 (the docs describe the shipped behaviour). Its final line counts depend on IC-02, IC-03 and IC-04.
- **Risks**: C-005 (no line starting with `#` followed by a digit; entries under 1,200 characters). The ADR must match the code (reviewed against it).
- **Red-first**: n/a (docs). The doc sanity gate must pass.

### Dependency graph

```
IC-01 ──► IC-02 ──► IC-05 ──► IC-06 ──┐
   ├────► IC-03 ─────────────► IC-06  ├──► IC-08
   └────► IC-04 (─► IC-03 if a shared fixture moves)
IC-07 (independent) ──────────────────┘
```
