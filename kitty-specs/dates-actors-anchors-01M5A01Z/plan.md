# Implementation Plan: Dates, actors and anchors: follow-ups from #181 and #218

**Branch**: `feat/dates-actors-anchors` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/dates-actors-anchors-01M5A01Z/spec.md`

Planning questions were settled before this plan: the operator's brief fixes the scope,
and two Decision Moments are resolved (#226 precedence, #229 scope). See
[research.md](./research.md) for the folded post-spec squad findings.

## Summary

- **#226**: export the two "last changed" rules side by side from
  `src/lib/generator-stamp.mjs` (`feedInstant` for RSS, `okfGenerated` for the OKF
  export). RSS keeps `updated → generated.at`. The OKF export keeps
  `generated.at → updated`, but only an ownership-producer stamp counts; any other stamp
  is treated as absent, so `by` and `at` stay coherent. One test pins both rules. Record
  it in ADR-0059 and the docs.
- **#227**: make `normaliseInstant` return `null` for a value that is not date-shaped
  (a number, or a non-ISO string without a month name plus a number or three numeric
  groups). Give `stampAt` (`generated.at`, `verified[].at`) the same instant check in
  both twins. The gate names the field and the accepted form.
- **#228**: strengthen the existing single-h1 test with the `# Title … ## Title` case,
  assigning heading ids as a real build does.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js 22 ESM (`.ts` in `src/lib`, `.mjs` cores and scripts)
**Primary Dependencies**: Astro 7.4, Starlight 0.42.6, Zod (schema twins), unified/remark/rehype, `@astrojs/markdown-remark` (`rehypeHeadingIds`, test only)
**Storage**: N/A (static build output: `rss.xml`, `api/*.json`, `api/content-graph.json`, `okf/`)
**Testing**: Vitest (`pnpm test`), the frontmatter gate (`node src/scripts/validate-frontmatter.mjs`), the example build plus `assert-build-artifacts.mjs`
**Target Platform**: Static-site build (Node 22+), GitHub Actions CI
**Project Type**: single (toolkit package `src/` plus the `example/` site)
**Performance Goals**: N/A (no hot path changes; parsing cost is unchanged)
**Constraints**: byte-deterministic outputs; no API/schema version bump; twin parity; DIRECTIVE_041 test economy
**Scale/Scope**: about 6 source files, 4 test files, 5 docs pages, 1 ADR note, 1 CHANGELOG section

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Metadata contract (ADR-0009, ADR-0059)**: the change tightens instant validation and
  corrects the export's `generated` block. Both are recorded in the ADR-0059
  implementation notes. That is an implementation note, not a new decision, because
  ADR-0059's decisions (UTC instants, OKF `generated.at`) are unchanged. PASS.
- **Living documentation**: every behaviour change updates its docs in the same change
  (FR-005). PASS.
- **Doc-sanity gates**: frontmatter, links, markdownlint and Vale run on edited pages;
  descriptions are 50–180 characters. PASS.
- **Path-scoped CI, `ci-ok`**: code and docs change together, so both lanes run. PASS.
- **DIRECTIVE_041**: strengthen existing tests; one focused test per issue at most. PASS.

Post-design re-check: no violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this mission)

```
kitty-specs/dates-actors-anchors-01M5A01Z/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md          # /spec-kitty.tasks
```

No `contracts/`: the mission adds no interface. `meta.json` records
`contracts: none` with the rationale.

### Source Code (repository root)

```
src/lib/
├── vocabulary-core.mjs      # #227 normaliseInstant: date-shape rule in the legacy branch
├── schema.ts                # #227 stampAt instant check (Astro twin)
├── generator-stamp.mjs      # #226 feedInstant + okfGenerated (the one module)
├── metadata.ts              # #226 feedDateMillis delegates to feedInstant; comment
├── okf-export/core.mjs      # #226 generatedFor delegates to okfGenerated
└── rehype/single-h1.ts      # #228 unchanged (test only)
src/scripts/
└── validate-frontmatter.mjs # #227 stampAt twin, field-named error, no double error on a retired stamp
src/tests/
├── vocabulary-core / schema-validator-parity.test.ts  # #227 rows (+ normaliseInstant rows)
├── okf-export.test.ts       # #226 the one precedence test (both rules, three inputs)
└── single-h1.test.ts        # #228 strengthened case
docs/
├── adr/0059-content-graph-and-okf-alignment.md   # implementation note
├── architecture/{gherkin-pages,generators,metadata-model}.md
└── guides/export-okf-bundle.md
CHANGELOG.md                 # [Unreleased]
```

**Structure Decision**: single-project layout. The precedence module is
`generator-stamp.mjs`: it already owns `PRODUCERS` and `isGeneratedStamp`,
`metadata.ts` and `validate-frontmatter.mjs` already import it, and
`okf-export/core.mjs` can import it without breaking its I/O-free contract.

## Implementation Concern Map

> Implementation concerns are not work packages. `/spec-kitty.tasks` decides the WPs.

### IC-01 — Date-shape rule in the one parser (#227)

- **Purpose**: make the single parser refuse non-date values so every reader and both
  twins reject them consistently.
- **Relevant requirements**: FR-006, FR-007, FR-008, FR-009
- **Affected surfaces**: `src/lib/vocabulary-core.mjs` (`normaliseInstant`,
  `legacyInstant`), `src/lib/schema.ts` and `src/scripts/validate-frontmatter.mjs`
  (`stampAt`, error wording), `src/tests/schema-validator-parity.test.ts`,
  `src/tests/vocabulary-core.test.ts` if it exists, otherwise the `normaliseInstant`
  rows in the parity test
- **Sequencing/depends-on**: none
- **Risks**:
  - other callers of `normaliseInstant` treat `null` as absent (`docs-index.ts`,
    `metadata.ts`, `generate-adr-index.mjs`, `Persona.astro`); confirm none throws;
  - a retired `sha256:` stamp must keep its single "regenerate" error;
  - a YAML number is currently parsed as epoch millis, and is now rejected.

### IC-02 — Per-output "last changed" rules in one module (#226)

- **Purpose**: define the RSS and OKF precedence side by side, fix the OKF rule for
  non-ownership stamps, and pin both with one test.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004
- **Affected surfaces**: `src/lib/generator-stamp.mjs`, `src/lib/metadata.ts`
  (`feedDateMillis`), `src/lib/okf-export/core.mjs` (`generatedFor`),
  `src/tests/okf-export.test.ts` (FR-025 describe block)
- **Sequencing/depends-on**: none. It is independent of IC-01, but both touch dates, so
  run the full suite after both.
- **Risks**:
  - RSS reads raw frontmatter, while the export reads graph nodes whose instants are
    already canonical strings, so the helpers take `{updated, generated, authors}` and
    use `normaliseInstant` only where they compare;
  - do not add a node to the shared `graph.json` fixture; test `generatedFor` directly.

### IC-03 — Anchor-collision test (#228)

- **Purpose**: pin the single-h1 alias skip when a later heading takes the id.
- **Relevant requirements**: FR-010
- **Affected surfaces**: `src/tests/single-h1.test.ts` (existing test only)
- **Sequencing/depends-on**: none
- **Risks**: the harness assigns no ids, so the test must run `rehypeHeadingIds` after
  the pass. A count of `id="title"` without it is vacuous.

### IC-04 — Decision record, docs and changelog

- **Purpose**: record the #226 decision and the #227 rule where readers look.
- **Relevant requirements**: FR-005, NFR-004
- **Affected surfaces**: ADR-0059 implementation notes; `gherkin-pages.md`,
  `generators.md`, `metadata-model.md`, `export-okf-bundle.md`; `CHANGELOG.md`
  `[Unreleased]`
- **Sequencing/depends-on**: IC-01, IC-02 (documents their final behaviour)
- **Risks**: the 1,200-character entry limit is checked by hand; edited page
  descriptions must stay 50–180 characters; `[Unreleased]` will conflict with PR #225's
  CHANGELOG edits (resolve by union at rebase).
