# Implementation Plan: Gate config hardening

**Branch**: `fix/gate-config-hardening` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/gate-config-hardening-01M55KMR/spec.md`

## Summary

Three PR #171 landing follow-ups:

1. **#173: the draft gates read the evaluated config.** The child-process config evaluator that `check-links` already uses (`src/scripts/site-index-names.mjs`, Vite `runnerImport`, cached per config path, with a timeout) gets one shared owner. `assert-build-artifacts` and the path of `check-redirect-coverage` without `--docs` call it. A config that exists but fails or times out makes the gate exit 2. `--env-dir` skips evaluation. The config-text regex and the `configEvaluated` parameter go.
2. **#172: `assert-build-artifacts --index-path <dist-relative path>`.** The flag moves every index check (the pinned count, the Specification cross-check and the `_links` walk). The base is derived from `self`. The default is `api/index.json`.
3. **#174: `sitemapDraftFilter` moves to `src/lib/integrations/route-shaping.ts`.** It stays re-exported from `./config`, and a test pins the export list of `./config`.

## Engineering alignment

The operator settled these decisions, which are recorded as Decision Moments at specify:

- Fail closed with exit 2 when a config fails to evaluate.
- `--index-path` is a flag only.
- The `updateConfig` case stays a documented limit.
- The filter's new home is `route-shaping.ts`.

The post-spec squad's defaults are folded into spec rev 2:

- `--index-path` is dist-relative.
- A mode-branching config is a documented limit.
- `--astro-config` overrides the config on both gates.

No planning question remains open.

## Technical Context

**Language/Version**: Node.js ESM (`.mjs` gate scripts) and TypeScript 5 (`src/lib/**`), the Node version pinned in `.nvmrc`/CI
**Primary Dependencies**: Astro 5 / Starlight, and Vite 6 (`runnerImport`, already used by `site-index-names.mjs`). No new dependency.
**Storage**: N/A (files under `dist/` and the site's `.env*`)
**Testing**: vitest in `src/tests/`, using the existing gate tests (`draft-publication.test.ts`, `draft-publication.env.test.ts`, `example-adopter.test.ts`, `agent-links-gating.test.ts`, `config-invariants.test.ts`, `sitemap-feeds.test.ts`), with red-first evidence per fix
**Target Platform**: The local CLI and GitHub Actions CI (`.github/workflows/ci.yml` lines ~213/229/262 invoke the gates without `--docs`)
**Project Type**: single (the pnpm workspace: the `src/` package plus `example/`)
**Performance Goals**: config evaluation runs once per gate run and adds ≤2 s (NFR-001)
**Constraints**: byte-identical example `dist/` (NFR-002); public exports unchanged (C-002); no build or network needed to evaluate (C-005)
**Scale/Scope**: about 6 source files, about 6 test files, ADR-0058, the consumer guide and the CHANGELOG

## Charter Check

- **DIRECTIVE_041 (test economy):** strengthen existing tests, delete the text-search error tests, and add at most one focused test per change. **PASS** by design (C-003).
- **DISCIPLINED_REFACTORING (#174):** move only, with an export-list guard and no behaviour change. **PASS.**
- **Fail-closed gates (the charter's quality and delivery section):** FR-002 tightens a fail-open path. **PASS.**
- **Documentation policy:** the ADR-0058 amendment, the consumer guide and the CHANGELOG are in scope (FR-008, FR-011). **PASS.**
- **Supply chain (DIRECTIVE_051):** no dependency is added or changed. **N/A.**

No violations, so there is no Complexity Tracking.

## Project Structure

### Documentation (this mission)

```
kitty-specs/gate-config-hardening-01M55KMR/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md            # /spec-kitty.tasks
```

`contracts/`: the mission defines no network or API interface. Its CLI flags are documented in data-model.md. `meta.json` records `contracts: none`.

### Source Code (repository root)

```
src/
├── scripts/
│   ├── site-index-names.mjs        # evaluator today; extract evaluateSiteConfig() here or to a sibling module
│   ├── assert-build-artifacts.mjs  # #173 evaluation + #172 --index-path
│   ├── check-redirect-coverage.mjs # #173 the path without --docs
│   └── check-links.mjs             # consumer of the shared evaluator (unchanged behaviour)
├── lib/
│   ├── draft-publication.mjs       # resolveDraftPublicationForGate: drop the text search and configEvaluated
│   ├── config.ts                   # #174 re-export only
│   ├── integrations/route-shaping.ts  # #174 new home of sitemapDraftFilter
│   └── routes/agent-index.ts, agent-page.ts  # JSDoc only
└── tests/                          # strengthen the existing suites
docs/adr/0058-*.md, docs/guides/consumer-setup.md, CHANGELOG.md
```

**Structure Decision**: single package. All changes go into existing modules, apart from at most one extracted evaluator module.

## Implementation Concern Map

### IC-01 — Shared config evaluator and the fail-closed draft gates

- **Purpose**: one owner evaluates `astro.config.*`, and both draft gates use it, failing closed when evaluation fails.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-012, NFR-001, C-001, C-004, C-005
- **Affected surfaces**:
  - `src/scripts/site-index-names.mjs` (:32, :51-101, :165-178)
  - `src/lib/draft-publication.mjs` (:253 `findSiteRoot`, :322-349)
  - `src/scripts/assert-build-artifacts.mjs` (:1972-1980)
  - `src/scripts/check-redirect-coverage.mjs` (:417-425)
  - `.github/workflows/ci.yml` invocations
- **Sequencing/depends-on**: none
- **Risks**:
  - CI now evaluates `example/astro.config.mjs`, which imports the workspace package. It must resolve without a build.
  - `check-links` behaviour must not change.
  - Watch the cache-key aliasing between `--docs` and `--site-root`.

### IC-02 — `--index-path` on the artifact gate

- **Purpose**: a site with a custom agent-API index path can pass every index check.
- **Relevant requirements**: FR-006, FR-007, FR-008
- **Affected surfaces**:
  - `src/scripts/assert-build-artifacts.mjs` (`INDEX_RELPATH` :479, :373-397, :2112-2121, :2291)
  - the JSDoc in `agent-index.ts`/`agent-page.ts`
  - `docs/guides/consumer-setup.md`
  - `src/tests/agent-links-gating.test.ts`, `example-adopter.test.ts`
- **Sequencing/depends-on**: after IC-01 (same file; avoids conflicts)
- **Risks**: the base derivation when `self` doesn't end in `/<flag>`, and refusing a path that contains `..`.

### IC-03 — Move `sitemapDraftFilter` and pin the export surface

- **Purpose**: finish the `config.ts` split with an export-list guard.
- **Relevant requirements**: FR-009, FR-010, C-002
- **Affected surfaces**: `src/lib/config.ts` (:402, :722), `src/lib/integrations/route-shaping.ts`, `src/tests/config-invariants.test.ts`, `src/tests/sitemap-feeds.test.ts`
- **Sequencing/depends-on**: none (independent)
- **Risks**: an import cycle if the helpers come from `../config`.

### IC-04 — ADR-0058 amendment and CHANGELOG

- **Purpose**: record the decision and the user-facing changes.
- **Relevant requirements**: FR-008, FR-011
- **Affected surfaces**: `docs/adr/0058-*.md` (:110-111, :121-128, :162-165), `CHANGELOG.md [Unreleased]`
- **Sequencing/depends-on**: IC-01, IC-02
- **Risks**: the 180-character ADR description gate, and the 1,200-character limit on a changelog entry.
