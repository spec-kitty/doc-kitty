# Mission Specification: Consumption Test + Consumer-Layer Proof

**Mission Branch**: `consumption-test-01M22ZF2`
**Created**: 2026-09-09
**Status**: Draft
**Input**: Prove the packaged `@commondocs-kitty/toolkit` (0.1.0) installs cleanly into a net-new consumer site, enforced by a CI "consumption test", and demonstrate the consumer theme layer at N=2 using a representative slice of the ars-rethorica book under a new editorial theme.

## Context

The doc-kitty MVP is feature-complete and cut at `0.1.0`. The adoption study
([`docs/architecture/research/spec-kitty-adoption-proof.md`](../../docs/architecture/research/spec-kitty-adoption-proof.md))
still flags two unproven claims about the toolkit's reusability:

1. **No install-provable release** — nothing verifies that what `npm pack`
   actually ships (the `files` allowlist + `exports` map) is sufficient to build
   a consuming site. Every existing gate runs against `example/`, which resolves
   the toolkit through the pnpm **workspace symlink** — so it exercises the
   source tree, never the packaged artifact.
2. **Reuse proven only at N=1** — only the `spec-kitty` brand theme is
   instantiated. The `consumer` layer of the `default → brand → consumer` token
   merge (ADR-0008/0011/0013) is a contract, not a demonstrated second consumer.

This mission closes both by building a consumer site that consumes the **packed
tarball** (never the workspace) and applies a genuinely distinct **editorial
consumer theme**, all enforced by a dedicated CI workflow that fails closed on a
packaging gap.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean-room consumption proof (Priority: P1)

As a doc-kitty maintainer, I want CI to pack the toolkit and build a net-new
consumer site from that tarball — with no access to the toolkit source tree — so
that a missing file in the `files` allowlist or a misdeclared `exports` subpath
fails the build instead of silently shipping a broken package to adopters.

**Why this priority**: This is the mission's core value. Without it, "the toolkit
is reusable" remains an unverified claim; with it, every release is install-proven
and packaging regressions are caught before an adopter hits them.

**Independent Test**: Run the consumption-test workflow on a branch. It packs the
toolkit, installs the `.tgz` into the fixture consumer, and builds the site. The
build succeeding — with the toolkit's source directory unavailable to the
consumer's module resolution — is the proof.

**Acceptance Scenarios**:

1. **Given** the toolkit at `0.1.0`, **When** CI packs it and installs the tarball
   into the fixture consumer and runs the consumer build, **Then** the build
   completes and produces a static site plus `rss.xml`, `llms.txt`, `sitemap.xml`,
   and the JSON agent-API.
2. **Given** the built consumer output, **When** the toolkit's own gates
   (frontmatter validation, link check, redirect-coverage, build-artifact
   assertions) run against the consumer's output directory, **Then** all pass.
3. **Given** a toolkit whose `files` allowlist omits a file the consumer imports,
   **When** the workflow runs, **Then** it fails with an error identifying the
   unresolved import (fail-closed, not a silent skip).

---

### User Story 2 - Consumer-layer proof at N=2 (Priority: P2)

As a doc-kitty maintainer, I want a second, visibly distinct consumer theme (an
editorial/press style over the ars-rethorica book) applied through the
`default → brand → consumer` merge, so that the consumer layer is demonstrated as
a working reuse point rather than an untested contract.

**Why this priority**: It converts the reuse-ceiling number the study calls out
(N=1) into a demonstrated N=2. It depends on US1's fixture existing but delivers
independent value: a worked example of theming as a consumer, not a brand author.

**Independent Test**: Inspect the built consumer HTML/CSS: a defined set of
`--dk-*` design tokens render with the editorial theme's values, not the default
or `spec-kitty` brand values.

**Acceptance Scenarios**:

1. **Given** the editorial consumer theme layered over defaults, **When** the
   consumer site builds, **Then** the built output carries the editorial theme's
   token values for a defined token set (color, type, spacing), overriding the
   defaults.
2. **Given** the book slice (Introduction, Preamble, Book I ch. 1–3, one persona,
   generated glossary), **When** it builds under the consumer theme, **Then**
   per-kind layouts (Persona, Hub, Default), Markua rendering, and glossary
   autolinking all render correctly in the consumer output.

---

### User Story 3 - Reproducible adopter path (Priority: P3)

As an external adopter, I want documentation of how to stand up a consumer site
on the packaged toolkit — install, configure, theme, build — so that I can
reproduce the consumption test's setup for my own docs tree without reading
doc-kitty's internals.

**Why this priority**: Documentation makes the proof transferable. It is lowest
priority because the mechanical proof (US1/US2) delivers value to the maintainer
even before the guide exists, but it is what turns the fixture into adopter-facing
enablement.

**Independent Test**: A reader follows the guide using only published toolkit
entrypoints (no repo-relative paths) and reaches a building consumer site.

**Acceptance Scenarios**:

1. **Given** the adopter guide, **When** a reader follows its install→configure→
   theme→build sequence, **Then** every step references a published toolkit
   entrypoint or a consumer-owned file — never a doc-kitty repo-internal path.
2. **Given** the reconciled roadmap "Where we are now" section, **When** the guide
   lands, **Then** the roadmap links to it as the realized consumer path.

### Edge Cases

- A file the consumer imports is present in source but **absent from the `files`
  allowlist** → the tarball install omits it → the consumer build fails closed
  with an unresolved-import error (this is the primary value, exercised as a
  focused negative test).
- An `exports` subpath the consumer uses is **undeclared or mis-targeted** → module
  resolution fails at the consumer → surfaced as a build error.
- The fixture **accidentally resolves the toolkit through the pnpm workspace
  symlink** instead of the tarball → this would mask packaging gaps. Because the
  fixture is nested under the repo's `pnpm-workspace.yaml`, exclusion is NOT
  automatic: it MUST be its own workspace root (own empty `pnpm-workspace.yaml`) and
  install with `--ignore-workspace`, with a `realpath`-not-symlink-not-under-`src/`
  assertion and a source-hidden build (NFR-001).
- Peer dependencies (`astro`, `@astrojs/starlight`) must resolve **at the
  consumer**, installed by the consumer, not inherited from the monorepo root.
- Book content requiring the **PlantUML service** is excluded from the slice to
  keep CI light; the slice is chosen so build-time diagram rendering does not gate
  the workflow.
- ars-rethorica content is reused under its **CC-BY-SA-4.0** license; attribution
  must travel with the fixture content.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Consumer fixture site | As a maintainer, I want a consumer-site test fixture that carries a representative slice of the ars-rethorica book (Introduction, Preamble, Book I ch. 1–3, one reader persona, the generated rhetoric glossary) and consumes the toolkit **only through its public `exports`**, so a realistic site exists to build from the packaged artifact. | High | Open |
| FR-002 | Editorial consumer theme | As a maintainer, I want a new editorial/press consumer theme (a `--dk-*` token set plus a few brand components) applied via the `default → brand → consumer` merge, so the consumer layer is exercised as a distinct second consumer. | High | Open |
| FR-003 | Pack + tarball install in CI | As a maintainer, I want CI to run `npm pack` on the toolkit and install the resulting `.tgz` into the fixture consumer (never a workspace symlink), so the build depends on exactly what adopters receive. | High | Open |
| FR-004 | Consumer build in CI | As a maintainer, I want the workflow to build the consumer site from the installed tarball and produce the static site plus `rss.xml`, `llms.txt`, `sitemap.xml`, and the JSON agent-API. | High | Open |
| FR-005 | Gates run against consumer output | As a maintainer, I want the toolkit's **tarball-portable** gates (frontmatter validation; `check-links` in base-relative mode; redirect-coverage; the portable `assert-no-broken-links` strict built-link check) plus one small consumer-owned artifact checker to run against the **consumer's** built output and pass. The corpus-pinned `assert-build-artifacts.mjs` is deliberately NOT reused (it hardcodes the repo layout + example corpus — see research D1); the consumer-owned checker covers feed/agent-API presence + shape. | High | Open |
| FR-006 | Fail-closed on packaging gaps | As a maintainer, I want the workflow to fail with a clear, identifying error when a consumer-imported file is missing from the tarball or an `exports` subpath is unresolvable — never a silent skip. | High | Open |
| FR-007 | Packaging-gap self-test | As a maintainer, I want a focused test that proves the fail-closed behavior (an allowlist omission is detected) against a crafted fixture, **without** leaving a standing red CI gate. | Medium | Open |
| FR-008 | Adopter consumer-path guide | As an external adopter, I want documentation of the install→configure→theme→build path using only published entrypoints, linked from the roadmap "Where we are now" section. | Medium | Open |
| FR-009 | Reused-content attribution | As a maintainer, I want the reused ars-rethorica slice to carry its CC-BY-SA-4.0 attribution, so the fixture respects the source license. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Tarball-only resolution | The consumer resolves `@commondocs-kitty/toolkit` **exclusively** from the installed tarball. Non-fakeable proof (all required): the fixture is its own pnpm workspace root and installs with `--ignore-workspace`; `realpath(node_modules/@commondocs-kitty/toolkit)` is inside the fixture, not a symlink, not under repo `src/`, at version `0.1.0`; the consumer has **zero** repo-relative toolkit-source imports (grep = 0); and the build succeeds with repo `src/` made unresolvable. | Reliability | High | Open |
| NFR-002 | CI time budget | The consumption-test workflow completes in **≤ 8 minutes** on the project's standard GitHub runner (excluding cache-cold dependency install, which is cached). | Performance | Medium | Open |
| NFR-003 | Zero tarball bloat | The fixture consumer and editorial theme add **0 files** to the published toolkit tarball: `npm pack --dry-run` file count and list are unchanged by this mission except for intended toolkit-source changes. | Maintainability | High | Open |
| NFR-004 | Deterministic dependency pin | The workflow consumes an **exact** toolkit version (the packed `0.1.0` tarball) with a committed consumer lockfile; no floating or `latest` toolkit resolution. | Reliability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Test-resource placement | The consumer fixture and editorial theme live as **test resources**, excluded from the pnpm workspace and from the toolkit `files` allowlist. They are not a shipped top-level example and not part of the published tarball. | Technical | High | Open |
| C-002 | Local tarball channel | Install channel is the **local `npm pack` tarball**. No npm-registry publish, no auth tokens, no network registry dependency for the toolkit itself. | Technical | High | Open |
| C-003 | Light CI (PlantUML optional) | Prefer slice content that does **not** require the PlantUML service, to keep CI light; build-time PlantUML rendering is optional and must not gate this workflow. | Technical | Medium | Open |
| C-004 | Reuse gate scripts where portable | Reuse the four tarball-portable gate scripts (`validate-frontmatter`, `check-links`, `check-redirect-coverage`, `assert-no-broken-links`) against the consumer output, invoked from the installed package. Add **one small** consumer-owned artifact checker (feeds + agent-API) and one theme-token verifier only where no portable script exists — the corpus-pinned `assert-build-artifacts`/`assert-markua-builds` are not reusable (research D1). Do not author parallel validators beyond these two. | Technical | Medium | Open |
| C-005 | License compliance | ars-rethorica content is reused under **CC-BY-SA-4.0** with attribution preserved in the fixture. | Regulatory | Medium | Open |

### Key Entities

- **Consumer fixture site**: a minimal but realistic docs site (test resource) that
  depends on the packaged toolkit and carries the book slice + consumer theme.
- **Editorial consumer theme**: a `consumer`-layer theme — a `--dk-*` token set and
  a few brand components — distinct from the default and the `spec-kitty` brand.
- **Toolkit tarball**: the `npm pack` artifact of `@commondocs-kitty/toolkit@0.1.0`;
  the sole channel through which the fixture obtains the toolkit.
- **Consumption-test workflow**: the GitHub Actions workflow that packs, installs,
  builds, and gates the consumer, failing closed on packaging gaps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A clean-room build of the consumer site from the packed toolkit
  succeeds in CI with the consumer resolving the toolkit only from the tarball
  (NFR-001 grep returns 0 repo-relative toolkit imports; build succeeds with the
  source tree unavailable).
- **SC-002**: The consumer's `rss.xml`, `llms.txt`, `sitemap*.xml`, and JSON
  agent-API are all generated and pass a corpus-agnostic well-formedness + shape
  check (`assert-consumer-artifacts.mjs`, asserting the shipped `pages[]` agent-API
  shape, `version === '2'`, `count === pages.length`, and per-page required keys),
  complemented by the portable `assert-no-broken-links` strict built-link check.
- **SC-003**: The editorial consumer theme is demonstrably distinct — an **automated**
  verifier (`assert-consumer-theme.mjs`) asserts that ≥5 named `--dk-*` tokens in the
  built token sheet carry the **press** value **and differ from the toolkit default**
  (and, where set, the brand) — `press === default` fails. Not manual inspection.
- **SC-004**: Removing a **statically-imported** file the consumer resolves from the
  toolkit's published set (an `exports`-mapped module in the `files` allowlist) causes
  the workflow to fail with an identifying error, verified by a two-arm focused
  packaging-gap test (positive control builds green; the removal fails closed). The
  favicon warn-path is a known non-module carve-out, covered instead by the
  favicon-output presence check in SC-002's checker.
- **SC-005**: An external adopter can reproduce the consumer setup by following the
  guide using only published toolkit entrypoints — every documented step
  references a published entrypoint or a consumer-owned file, none a doc-kitty
  repo-internal path.

## Assumptions

- The mission builds on the `0.1.0` release cut already committed on
  `feat/release-0.1.0-consumption-readiness` (roadmap reconcile + CHANGELOG +
  version bump + `publishConfig.access=public`); it bases on and merges into that
  branch.
- "Representative slice" = Introduction + Preamble + Book I chapters 1–3 + one
  reader persona + the generated rhetoric glossary. Exact extent may be trimmed in
  planning to hold the CI budget (NFR-002); the pillars it must exercise (Markua,
  glossary, persona, per-kind layouts) are fixed.
- The fail-closed packaging-gap check is realized as a **focused test against a
  crafted fixture** (mirroring the existing redirect-coverage failure-mode tests),
  not as a permanently-red gate in the standing workflow.
- The consumption-test workflow triggers on pull requests touching the toolkit or
  fixture and on manual dispatch; exact trigger matrix is a planning detail.
- npm registry publishing of the toolkit is **out of scope** and a separate
  operator decision; this mission proves buildability from the tarball only.

## Out of Scope

- Publishing `@commondocs-kitty/toolkit` to the npm registry.
- Org-wide fan-out of the toolkit across multiple real repositories.
- The design-only repository portals (mission-status, QA, ticketing).
- Selective/redacted publishing (projection, M8) and an in-tool book type.
- Migrating any real/production docs tree onto the toolkit.
