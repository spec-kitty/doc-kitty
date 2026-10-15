# Implementation Plan: One owner for DocKitty's internal process.env handoffs

**Branch**: `chore/internal-env-owner` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/internal-env-owner-01M4ZNK1/spec.md` (issue #167)

## Summary

Add one dependency-free module, `src/lib/internal-env.mjs`, that names the five internal handoffs, exports their list, and owns their lifecycle: `clearInternalEnv()` at the start of `defineDocKittyIntegrations`, and setters/removers for the two values published at setup time. The four modules that define names today re-export them from the owner, so call sites need not change. The never-cleared `DK_PUBLISH_DRAFTS_RESOLVED` is fixed by the define-time clear. One test helper replaces three restore patterns. A short ADR (ADR-0057) records the seam; the consumer guide and CHANGELOG are updated. Built output stays byte-identical.

## Technical Context

**Language/Version**: TypeScript 5 and plain ESM `.mjs` (with JSDoc types) on Node 20+
**Primary Dependencies**: Astro 5.18, Starlight 0.32.6, Vite SSR (no new dependency)
**Storage**: N/A (process environment only)
**Testing**: vitest, run serially from `src/` (`src/node_modules/.bin/vitest run`); parallel runs clash on `example/` fixtures
**Target Platform**: Node build-time integration (`@spec-kitty/doc-toolkit`)
**Project Type**: single library package with an example site
**Performance Goals**: none beyond NFR-003 (no I/O, no spawn in the owner)
**Constraints**: C-001..C-004; `process.env` remains the transport (Vite SSR separate module graphs)
**Scale/Scope**: 1 new module, ~7 source files edited, ~14 test files re-plumbed, 1 ADR, 2 docs edits

## Charter Check

- DIRECTIVE_041 (tests as scaffold): one new focused test (two-config lifecycle); everything else is restore plumbing on existing tests. PASS.
- Deep-module design: a small interface (list + clear + per-name set/delete) over a hidden lifecycle rule. PASS.
- Brownfield / extract-then-publish: names are extracted to the owner first, old exports kept as re-exports. PASS.
- Byte-neutral change: NFR-001 example `dist/` diff. PASS (gate in WP03).

## Design

### Owner module `src/lib/internal-env.mjs`

- Exports one constant per name (`DK_INDEX_BASENAME_ENV`, `DK_GHERKIN_RESULTS_ENV`, `DK_GHERKIN_ROUTE_ENV`, `DK_PUBLISH_DRAFTS_RESOLVED_ENV`, `DK_DOCS_ROOT_ENV`) and `INTERNAL_ENV_NAMES` (frozen array).
- `clearInternalEnv(env = process.env)` deletes every listed name.
- `setInternalEnv(name, value, env = process.env)` and `deleteInternalEnv(name, env = process.env)`; both throw on a name not in the list (keeps the list authoritative).
- No imports; no module-level copies of values (FR-004, NFR-004). A comment table records the writer and write time of each name.

### Wiring

| Name | Write time | Writer (after) | Readers (unchanged) |
|---|---|---|---|
| DK_INDEX_BASENAME | define | `config.ts` define, after `clearInternalEnv()` | `schema.ts`, `site-index-names.mjs` |
| DK_GHERKIN_RESULTS | define | `config.ts` define | `schema.ts`, `routes/scenario-index.ts` |
| DK_DOCS_ROOT | define | `config.ts` define | `routes/shared.ts` |
| DK_GHERKIN_ROUTE | setup (fence stage) | `config.ts` fence `config:setup` via set/delete | `routes/scenario-index.ts` |
| DK_PUBLISH_DRAFTS_RESOLVED | setup (draft publication) | `config.ts` draft `config:setup` via set | `draft-publication.mjs` |

`clearInternalEnv()` is the first statement touching env in `defineDocKittyIntegrations`, replacing the scattered `delete` lines (`config.ts` ~2056, ~2058). Old definition sites become re-exports: `vocabulary-core.mjs:733`, `gherkin/options.mjs:77`, `gherkin/include-scan.mjs:130`, `draft-publication.mjs:32`, `config.ts:103`, `routes/shared.ts:64`.

### Tests

- New helper `src/tests/helpers/restore-internal-env.ts`: snapshot every listed name before each test, restore after; replaces `restore-index-env.ts` (deleted) and ad-hoc `delete`/`vi.stubEnv` for these names in the ~14 suites listed in research.
- One focused test (in an existing suite, e.g. `draft-publication.test.ts`): define config A with drafts on, run its setup, define config B with defaults → `DK_PUBLISH_DRAFTS_RESOLVED` absent; B's setup publishes B's value; route value present after setup (SC-001 + FR-003 merged, C-004).

### Docs

- ADR-0057 "Internal env handoff seam"; ADR-0050/0055/0056 get a one-line "See ADR-0057" pointer (decisions unchanged).
- `docs/guides/consumer-setup.md`: the five names, "DocKitty sets these; never set them by hand".
- CHANGELOG `[Unreleased]` Fixed: stale draft setting in a second config in the same process.

## Work Package Sketch

- **WP01 Owner module and wiring** (code): `internal-env.mjs`, re-exports, define-time clear, setup-time setters, the focused lifecycle test. Red first: the two-config test fails on `main`.
- **WP02 One test restore helper** (code, tests only): `restore-internal-env.ts`, adoption across the suites, delete `restore-index-env.ts`. Depends on WP01.
- **WP03 ADR, guide, CHANGELOG, byte-identical check** (docs): depends on WP01, WP02.

## Risks

1. A define-time clear moved into a hook would wipe setup-time values: keep it in define; the lifecycle test pins it.
2. A suite still deleting a name by hand hides a leak: WP02 greps `process.env` for every listed name in `src/tests`.
3. Plain-Node import of the owner: `node --check` and run `site-index-names.mjs` against the example.
4. Interleaved defines across configs: out of scope (spec assumption).
