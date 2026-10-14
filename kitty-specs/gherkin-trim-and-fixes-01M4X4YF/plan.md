# Implementation Plan: Gherkin test trim and fixes

**Branch**: `issue-156-gherkin-trim-and-fixes` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/gherkin-trim-and-fixes-01M4X4YF/spec.md`

## Summary

Close five small Gherkin gaps test-first, then trim the Gherkin test suites so
each behaviour has one owning guard. Every fix enters through the existing
entry point (`parseMetadataTags`, `planFeaturePages`, `validateGherkinPages` /
`normalizeGherkinOptions`, the `doc-kitty:gherkin` integration hooks, and the
`generate-feature-pages.mjs` CLI), with the failing test committed before the
fix. The trim runs last and judges the final suite with planted breaks.

## Technical Context

**Language/Version**: Node 22, ES2022 modules: JSDoc-typed `.mjs` (`src/lib/gherkin/**`, `src/scripts/**`) and TypeScript 5 (`src/lib/config.ts`, tests)
**Primary Dependencies**: Astro 5 + Starlight (integration hooks), `@cucumber/gherkin` / `@cucumber/messages` (parser), `gray-matter`; no dependency is added, upgraded or removed
**Storage**: Files only: generated Markdown under `<docsDir>/<section>/`, committed in `example/docs/behaviour/`
**Testing**: Vitest (`pnpm test`: `fast` + serialized `build` projects), `pnpm validate:features` (drift gate), `assert-build-artifacts.mjs`, Playwright (`pnpm build:a11y && pnpm test:a11y`), consumption harness (`tests/consumption/`)
**Target Platform**: Static site build (Astro), Node CLI
**Project Type**: Single package (`src/` toolkit) + example site (`example/`)
**Performance Goals**: No measurable change; the #126 check reads one small file at build end
**Constraints**: Generation stays a pure function of sources + docs tree (risk R3); no injected route; ADRs immutable; no new ratchet gate; avoid sibling files (C-006)
**Scale/Scope**: About 15 source/test files touched for the fixes; 17 Gherkin test files judged for the trim

Supply chain: no dependency change, so DIRECTIVE_051 controls do not apply.

## Charter Check

| Charter rule | Status |
|--------------|--------|
| Decisions recorded as ADRs; accepted ADRs immutable | Pass: ADR-0052 records the #123 decision and amends ADR-0046 decision 3, its draft-hub "known limit", and decision 9's missing-route note. ADR-0046 is not edited. |
| Three separated axes (content / IA / presentation) | Pass: `titles` is information architecture for generated content; no theme change. |
| Living documentation: behaviour change updates docs in the same change | Pass: consumer guide (Gherkin section), architecture page, authoring guide and changelog land in the mission. |
| Frontmatter on every docs page | Pass: every touched page keeps `title`, `description`, `doc_status`, `updated` (bumped), `type`, `kind`. |
| Path-scoped CI, single `ci-ok` | Pass: no workflow change. |
| Tests: Vitest unit tests, example build asserts artifacts | Pass: red-first unit tests; example regenerated and drift-checked. |
| Writing style (sentence-case headings, no AI tells) | Pass: applies to ADR, guide and changelog text. |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/gherkin-trim-and-fixes-01M4X4YF/
├── spec.md
├── plan.md
├── research.md
├── research/code-grounding.md
├── data-model.md
├── quickstart.md
├── contracts/public-surface.md
└── tasks.md            # /spec-kitty.tasks
```

### Source Code (repository root)

```
src/lib/gherkin/feature-core.mjs     # #123 near-miss warning; hub frontmatter status (#124)
src/lib/gherkin/generate.mjs         # #124 draft hubs; #125 titles in dirTitles
src/lib/gherkin/options.mjs          # #125 titles validation (shared by CLI + integration)
src/lib/gherkin/scenario-index-check.mjs  # #126 new pure check (fs only)
src/lib/config.ts                    # gherkinIntegration: pass titles; astro:build:done check
src/scripts/generate-feature-pages.mjs    # --titles flag
package.json                         # validate:features / generate:features gain --titles hr=HR
example/astro.config.mjs             # titles: { hr: 'HR' }
example/docs/behaviour/**            # regenerated
src/tests/gherkin-*.test.ts          # red-first tests, then the trim
docs/adr/0052-*.md, docs/adr/README.md (generated index)
docs/guides/consumer-setup.md (Gherkin section), docs/guides/authoring.md,
docs/architecture/gherkin-pages.md, docs/changelog/, CHANGELOG.md
```

**Structure Decision**: existing layout; one new pure module for #126 so the
check is unit-testable without an Astro build.

## Implementation Concern Map

### IC-01 — Worked-example parity (#128)

- **Purpose**: one source of truth for `book-consignment.feature` before other changes touch the fixtures.
- **Relevant requirements**: FR-009
- **Affected surfaces**: `src/tests/gherkin-example.test.ts` (parity row), `src/tests/gherkin-feature-core.test.ts` (inline copy → fixture read; inert self-hash retired)
- **Sequencing/depends-on**: none
- **Risks**: none; test-only. Decision: a parity test over the file copies (keeps unit fixtures independent of the example site, as #128 recommends), plus removing the fourth, inline copy whose only guard hashed itself.

### IC-02 — Near-miss status shorthand warning (#123)

- **Purpose**: `@WIP` / `@Deprecated` warn with "did you mean `@wip`?"; matching stays exact.
- **Relevant requirements**: FR-001
- **Affected surfaces**: `feature-core.mjs` `parseMetadataTags`; rows in `gherkin-feature-core.test.ts`
- **Sequencing/depends-on**: none
- **Risks**: the example must stay warning-free (`gherkin-example.test.ts`); it uses `@wip` exactly.

### IC-03 — Draft hubs for draft-only directories (#124)

- **Purpose**: every directory that holds a feature gets a hub; a directory with no published feature below it gets a draft hub that no published hub links.
- **Relevant requirements**: FR-002, FR-003, NFR-003
- **Affected surfaces**: `generate.mjs` (hub planning), `feature-core.mjs` `serializeHubFrontmatter` (status), `gherkin-generate.test.ts`
- **Sequencing/depends-on**: none (touches `generate.mjs` like IC-04; sequence IC-03 before IC-04 in one lane)
- **Risks**: generation must not read `DK_PUBLISH_DRAFTS` (R3). The example has no draft-only directory, so no example page or baseline changes; an ad-hoc example build with `@wip` on `hr/request-leave.feature` checks the sidebar warning is gone (not committed).

### IC-04 — `gherkin.titles` (#125)

- **Purpose**: optional map from source-relative directory to hub title, validated once for CLI and integration.
- **Relevant requirements**: FR-004, FR-005, FR-006, FR-007
- **Affected surfaces**: `options.mjs` (`GHERKIN_PAGES_KEYS`, validator, the "only with sources" rule), `generate.mjs` (`dirTitles` + unknown-key warning), `generate-feature-pages.mjs` (`--titles <dir>=<title>`, repeatable), `config.ts` (thread `titles`, option type), `package.json` scripts, `example/astro.config.mjs`, regenerated `example/docs/behaviour/**`, `gherkin-options.test.ts`, `gherkin-generate.test.ts`, `gherkin-example.test.ts`
- **Sequencing/depends-on**: IC-03
- **Risks**: sidebar label "Hr" → "HR" may move a Playwright screenshot (sibling #112 also touches sidebar labels); `gherkin-example.test.ts` parses the config literal, so `titles` must stay a plain data literal.

### IC-05 — Advertised scenario index must exist (#126)

- **Purpose**: fail the build when `llms.txt` advertises `/api/scenarios.json` and the output lacks `api/scenarios.json`.
- **Relevant requirements**: FR-008, C-001
- **Affected surfaces**: new `src/lib/gherkin/scenario-index-check.mjs`; `config.ts` `gherkinIntegration` gains `astro:build:done`; `gherkin-integration.test.ts`
- **Sequencing/depends-on**: none
- **Risks**: only sites with `gherkin.sources` run the check. A site that removed the option but kept frozen pages is not covered; recorded in ADR-0052 as a residual.

### IC-06 — Trim the Gherkin suites (#156)

- **Purpose**: KEEP / RETIRE / SPLIT-BY-KIND / MERGE verdict per test; retire only proven duplicates.
- **Relevant requirements**: FR-010, FR-011, FR-012, NFR-002, NFR-004, C-008
- **Affected surfaces**: `src/tests/gherkin-*.test.ts`; verdict tables in `kitty-specs/.../research/test-verdicts.md` and the PR
- **Sequencing/depends-on**: IC-01..IC-05 (judges the final suite)
- **Risks**: "coverage disguised as a duplicate". Every RETIRE names its covering guard and records the planted-break run that turns that guard red.

### IC-07 — Records and adopter docs

- **Purpose**: ADR-0052, consumer guide (Gherkin section only), authoring guide, architecture page, changelog.
- **Relevant requirements**: FR-007, FR-013, C-002, C-006, C-007
- **Affected surfaces**: `docs/adr/0052-*.md`, `docs/adr/README.md` (via `generate-adr-index.mjs`), `docs/guides/consumer-setup.md`, `docs/guides/authoring.md`, `docs/architecture/gherkin-pages.md`, `docs/changelog/`, `CHANGELOG.md`
- **Sequencing/depends-on**: IC-02..IC-05
- **Risks**: consumer-setup.md is shared with sibling #153: keep to the Gherkin section and the one scenario-route sentence in step 5.

## Complexity Tracking

None.
