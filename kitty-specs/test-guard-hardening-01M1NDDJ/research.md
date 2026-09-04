# Research: Test-Guard Hardening

**Mission**: test-guard-hardening-01M1NDDJ · **Phase**: 0 · **Date**: 2026-09-04

Brownfield audit + decisions for two small quality guards (#53, #54). Both verified still-real on `main` at mission start.

## Current state (verified)

- **#53**: `src/layouts/Hub.astro` builds `children` from `getCollection('docs')` and filters `parentOf(slug) === currentSlug && isPublished(entry.data)` inline, then sorts (section-rank → ADR-number for the ADR group via `buildAdrHubCards`, else title). The only Hub-touching test (`src/tests/hub-adr-card.test.ts`) **replicates** this filter in a `hubAdrCards` helper rather than importing Hub's own selection — so deleting `isPublished` from `Hub.astro` leaves the suite green (mutation-confirmed by the pre-PR squad). `isPublished` is `metadata.ts` `(doc_status ?? 'draft') !== 'draft'`.
- **#54**: `src/vitest.config.ts` sets no `fileParallelism`/`poolOptions`. `example-adopter.test.ts` and `glossary-build-warning.test.ts` each spawn a full `astro build`; under default worker parallelism they race on build resources and intermittently fail (green when serialized).

## Decision D1 — #53 guard mechanism: extract a testable predicate (not an a11y-DOM assertion)

- **Decision**: Extract Hub's child-selection (published ∧ parent-of-current ∧ kind/sort) from the inline `Hub.astro` frontmatter into a **pure, importable unit** (e.g. `src/lib/hub-children.mjs` exporting `selectHubChildren(entries, currentSlug, order)`), have `Hub.astro` import and use it, and add `src/tests/hub-children.test.ts` that: (a) asserts a draft child (numbered ADR + non-ADR) is **excluded** by `selectHubChildren`; (b) asserts published children remain; (c) is mutation-true — removing the `isPublished` branch makes it red.
- **Rationale**: This is the smallest change that makes the guard exercise Hub's **real** predicate (the same function `Hub.astro` calls), satisfying SC-001/SC-002. It stays a fast node-only unit test — no new dependency, no build, and crucially **no new a11y visual snapshot**, so it does not touch the flaky a11y lane that #54 exists to stabilize (C-003). Keeps `Hub.astro`'s rendered output byte-identical (pure extraction; C-001).
- **Alternatives considered**: add a draft numbered ADR + draft non-ADR to `example/docs/` and assert their absence in the **built-hub DOM** in the example-build/a11y gate — **rejected**: slower, couples the guard to a full build, adds fixtures to the shipped example tree, and lands the assertion in the flaky lane #54 is fixing. (The user's steer confirmed this preference.)

## Decision D2 — #54 flake fix: narrowest effective isolation

- **Decision**: Change `src/vitest.config.ts` so the two `astro build`-spawning suites do not race. Preferred: keep general file-parallelism but **isolate the build-spawning suites** (e.g. a `poolMatchGlobs`/project split or `test.sequence`/`fileParallelism` scoping) so only they serialize; if a clean per-suite isolation isn't available in the installed vitest, fall back to `fileParallelism: false` (or `poolOptions.forks.singleFork`) for the whole suite.
- **Rationale**: Removes the race with minimal blast radius, keeping CI runtime bounded (NFR-003). The implementer picks the narrowest option the installed vitest (v2.1.9) supports; if only the coarse `fileParallelism:false` is clean, that is acceptable (the suite is ~10–27s).
- **Alternatives considered**: mocking the `astro build` in those two suites — rejected (they intentionally exercise a real build; that's their value). Splitting them into a separate CI job — rejected as heavier than a config change.

## Supply-chain / adversarial note

No dependency added/upgraded/removed (config + test only). No supply-chain surface. No security-impacting decision → no supply-chain adversarial pass required. A post-tasks anti-laziness squad + a pre-PR squad are planned per the mission steer.
