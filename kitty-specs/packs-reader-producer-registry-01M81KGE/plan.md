# Implementation Plan: Packs reader, charter contract snapshot and producer registry

**Branch**: `kitty/mission-packs-reader-producer-registry-01M81KGE` → `feat/330-packs-reader-producer-registry` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/packs-reader-producer-registry-01M81KGE/spec.md`

## Summary

Add `src/lib/packs/`: a vendored, lock-checked snapshot of the charter's packs
contract (tag `contract-packs-v0.1.0-rc.1`, commit `69ec326`), a classifier held
to the snapshot's own conformance cases, and a tolerant `readPack(dir) → PackModel`
(ADR-0079 D4). Add the `packs` option (`charterLock`, `contract`) and the
`dockitty-read-pack` CLI. Separately, replace the Gherkin and glossary special
cases with one producer registry (`src/lib/producers.mjs`) in which each producer
declares a role and an ownership scope. Record the registry in ADR-0083, which
extends ADR-0079.

## Technical Context

**Language/Version**: JavaScript ES modules (`.mjs`) with JSDoc types, plus TypeScript for `config.ts`; Node 22.22+
**Primary Dependencies**: existing only: `yaml` 2.9.1, `gray-matter`, `unified` and `remark-parse` (README headings), `node:crypto`, `node:fs`. No new dependency.
**Storage**: files: the vendored snapshot under `src/lib/packs/contract/`, read-only pack directories
**Testing**: Vitest (`src/tests/*.test.ts`, `fast` project); a new `packs-corpus` project for the open-packs corpus, fed by a CI step
**Target Platform**: Node CLI and Astro integration (build time)
**Project Type**: single (toolkit package `src/`)
**Performance Goals**: all 19 open-packs packs read in under 5 s in total (NFR-001)
**Constraints**: no network or Spec Kitty code at build time (C-001); no pack validation (C-002); never throw on pack content (FR-005)
**Scale/Scope**: about 766 files across 19 packs in the largest consumer

## Charter Check

| Charter rule | Plan |
|---|---|
| Decisions in ADRs; accepted ADRs immutable | ADR-0083 (Proposed) extends ADR-0079 with the registry. ADR-0079 is not edited. The number is provisional against open PRs (#405 holds 0081, #413 holds 0082). |
| Living documentation | `docs/architecture/packs.md` moves from "target design" to describing what is built; a consumer-setup section documents `packs.charterLock`, `packs.contract` and `dockitty-read-pack`; `docs/architecture/generators.md` gets the registry. |
| Changelog by fragment | `docs/changelog/unreleased/330-packs-reader-producer-registry.md`. |
| Tests: Vitest for the toolkit | Red-first unit tests for each concern; corpus test in CI. |
| Path-scoped CI, one `ci-ok` | The corpus step runs in `code-quality`, which already covers `src/**`. |
| Graceful degradation | The reader warns, never fails; the gate behaviour is unchanged for existing sites. |

No violations.

## Project Structure

### Documentation (this mission)

```
kitty-specs/packs-reader-producer-registry-01M81KGE/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/ (pack-model.schema.json, contract-lock.schema.json, producer-registry.md, cli-read-pack.md)
└── tasks/
```

### Source Code (repository root)

```
src/lib/producers.mjs                 # registry (fs-free): roles, scopes, page ownership
src/lib/producer-output.mjs           # generic owned/authored scan of a producer's output dir
src/lib/generator-stamp.mjs           # PRODUCERS, retired stamps and hints read from the registry
src/scripts/validate-frontmatter.mjs  # isGeneratedPage → registry
src/lib/gherkin/generate.mjs          # scanOutputDir → producer-output
src/lib/packs/
├── contract/                         # vendored snapshot + contract.lock.json
├── contract.mjs                      # loadContract(dir): lock check, parse, unknown-key warnings
├── classify.mjs                      # globs and the five-step classification
├── readme.mjs                        # pack-document parse (frontmatter, title, preamble, sections)
├── read.mjs                          # readPack(dir, options) → PackModel
├── options.mjs                       # resolvePacksOptions ([dk-packs])
└── index.mjs                         # public surface
src/scripts/read-pack.mjs             # dockitty-read-pack (bin)
src/scripts/packs-sync-contract.mjs   # pnpm packs:sync-contract
src/lib/config.ts                     # packs option wired, validated eagerly
src/tests/fixtures/packs/             # four fixture trees + lock fixtures
src/tests/packs-*.test.ts, producers.test.ts
src/tests/packs-open-packs.corpus.ts  # corpus project
src/tests/fixtures/packs/open-packs.pin.json
.github/workflows/ci.yml              # corpus step in code-quality
```

**Structure Decision**: the reader is a bounded module under `src/lib/packs/` (the ADR-0079 anti-corruption layer); the registry is a toolkit-wide module beside `generator-stamp.mjs`, because the gates, the Gherkin generator and the future pack and missions generators all read it.

## Implementation Concern Map

### IC-01 — Producer registry and ownership scopes

- **Purpose**: one registry of producers (role, scope, retired stamp, regenerate hint) behind `PRODUCERS`, `isGeneratedStamp`, `isRegenerableStamp`, `isGeneratedPage` and the Gherkin output scan.
- **Relevant requirements**: FR-015, FR-016, FR-017, NFR-004, SC-004
- **Affected surfaces**: `src/lib/producers.mjs` (new), `src/lib/producer-output.mjs` (new), `src/lib/generator-stamp.mjs`, `src/scripts/validate-frontmatter.mjs`, `src/lib/gherkin/generate.mjs`
- **Sequencing/depends-on**: none
- **Risks**: #410 edits `makeStamp` in `generator-stamp.mjs`; keep edits to the producer lookups. The Gherkin scope is "any one section" in the gate (decision D1). Existing tests must not be edited.

### IC-02 — Contract snapshot, lock and sync

- **Purpose**: vendor the contract files with a lock, verify it in tests and at load, and refresh it with a maintainer script.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-012 (lock check of another snapshot)
- **Affected surfaces**: `src/lib/packs/contract/**`, `src/lib/packs/contract.mjs`, `src/scripts/packs-sync-contract.mjs`, root `package.json`
- **Sequencing/depends-on**: none
- **Risks**: line-ending normalisation would change bytes; mark the snapshot `-text` in `.gitattributes` and keep it out of lint and formatting.

### IC-03 — Classifier

- **Purpose**: implement the contract's glob semantics and the five-step order, held to `classifier-cases.yaml`.
- **Relevant requirements**: FR-004, FR-010 (retired, unmodelled, unknown key and content form), SC-001
- **Affected surfaces**: `src/lib/packs/classify.mjs`
- **Sequencing/depends-on**: IC-02
- **Risks**: the retired-beats-files exception and the case-insensitive `ignored` step with its lower-case exception.

### IC-04 — Pack reader

- **Purpose**: `readPack` building `PackModel`: descriptor, README, presets, policy, manifest verification, inventory, problems and contract commits.
- **Relevant requirements**: FR-005 to FR-011, NFR-001, NFR-002, SC-002, SC-003
- **Affected surfaces**: `src/lib/packs/{read,readme,index}.mjs`, fixtures, `packs-open-packs.corpus.ts`, `vitest.workspace.ts`, CI step
- **Sequencing/depends-on**: IC-03
- **Risks**: real manifests carry kinds the pinned contract lacks (`routing_catalog`); these must warn, not throw.

### IC-05 — Option, CLI, ADR and docs

- **Purpose**: the `packs` option, `dockitty-read-pack`, ADR-0083, docs and the changelog fragment.
- **Relevant requirements**: FR-013, FR-014, FR-018, C-003, C-004
- **Affected surfaces**: `src/lib/packs/options.mjs`, `src/lib/config.ts`, `src/scripts/read-pack.mjs`, `src/package.json`, `docs/adr/0083-*.md`, `docs/architecture/{packs,generators}.md`, `docs/guides/consumer-setup.md`, changelog fragment
- **Sequencing/depends-on**: IC-01 (ADR), IC-04
- **Risks**: the ADR number may collide with a parallel PR; recheck before the PR.

## Complexity Tracking

No charter violations.
