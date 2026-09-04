# Implementation Plan: Test-Guard Hardening

**Branch**: `feat/test-guard-hardening` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/test-guard-hardening-01M1NDDJ/spec.md`

## Summary

Two small, independent guards from the metadata-vocab-hub pre-PR squad. **#53**: extract Hub's inline child-selection into a pure importable `selectHubChildren(...)` unit and add a mutation-true test that reds when the `isPublished` draft-exclusion is removed and proves a draft child is excluded through Hub's real predicate. **#54**: adjust `src/vitest.config.ts` so the two `astro build`-spawning suites stop racing under file-parallelism. Test/config only — no runtime behavior change. See [research.md](./research.md) for decisions D1/D2.

## Technical Context

**Language/Version**: TypeScript 5.x + plain ESM (`.mjs`), Node ≥ Active LTS; Astro 4.x / Starlight; Vitest 2.1.9
**Primary Dependencies**: Astro, `@astrojs/starlight`, vitest (all present — none added/upgraded/removed)
**Storage**: Filesystem docs tree; no persistent store
**Testing**: Vitest unit (`src/tests/`); the change adds one unit suite (#53) and one config edit (#54)
**Target Platform**: Node build host + browser (docsite)
**Project Type**: single (toolkit `src/` + `example/` adopter)
**Performance Goals**: No runtime target; full vitest wall-clock must stay within CI budget (NFR-003, ≤ ~1.5× current)
**Constraints**: C-001 test/config only (Hub rendered output byte-identical); C-002 #53 and #54 touch disjoint files (separate WPs); C-003 no new a11y visual snapshot / no Pagefind regression
**Scale/Scope**: 1 extracted pure module + 1 new unit test (#53); 1 config file (#54); ~2 small WPs

## Charter Check

Charter present (compact). This mission **serves** the charter's testing doctrine — DIRECTIVE_041 (a test must fail exactly when the contract breaks; #53 closes a tautological-guard gap) and DIRECTIVE_030 (test/typecheck gate reliability; #54 removes CI flake). DISCIPLINED_REFACTORING: #53 is a behavior-preserving extraction of Hub's filter. No dependency change → DIRECTIVE_051 N/A. No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this mission)
```
kitty-specs/test-guard-hardening-01M1NDDJ/
├── plan.md · research.md · spec.md · checklists/requirements.md
```
(No `contracts/` — no API/event surface; the "contract" is `selectHubChildren`'s signature, captured below. `quickstart.md` optional for a 2-WP test mission.)

### Source Code (repository root)
```
src/
├── lib/
│   └── hub-children.mjs          # NEW (#53) — export selectHubChildren(entries, currentSlug, order):
│                                 #   published ∧ parent-of-current filter + sort (extracted from Hub.astro)
├── layouts/
│   └── Hub.astro                # EDIT (#53) — import + use selectHubChildren (inline filter removed; render byte-identical)
├── tests/
│   └── hub-children.test.ts     # NEW (#53) — draft-exclusion guard (mutation-true) + published-kept + edge rows
└── vitest.config.ts             # EDIT (#54) — isolate/serialize the two astro-build-spawning suites
```

**Structure Decision**: Single project. #53 is a pure extraction (`Hub.astro` keeps identical output; the predicate becomes importable so the test exercises the real code path). #54 is a config-only change. No new deps, no build step.

## Complexity Tracking
*No Charter Check violations — section intentionally empty.*

## Implementation Concern Map

### IC-01 — Guard Hub draft-exclusion (#53)
- **Purpose**: Make Hub's child-selection a testable unit and add a mutation-true guard so removing the draft-exclusion cannot ship green.
- **Relevant requirements**: FR-001, FR-002, NFR-002; C-001, C-003
- **Affected surfaces**: NEW `src/lib/hub-children.mjs`; `src/layouts/Hub.astro` (import + use); NEW `src/tests/hub-children.test.ts`
- **Sequencing/depends-on**: none
- **Risks**: keep `Hub.astro` render byte-identical (pure extraction); the ADR-group ordering (`buildAdrHubCards`) must remain wired; the guard must be mutation-true (reviewer removes `isPublished` and confirms red), not a replica.

### IC-02 — Remove CI vitest parallel-build flake (#54)
- **Purpose**: Stop `example-adopter` + `glossary-build-warning` racing on concurrent `astro build`.
- **Relevant requirements**: FR-003, NFR-001, NFR-003
- **Affected surfaces**: `src/vitest.config.ts`
- **Sequencing/depends-on**: none (independent of IC-01)
- **Risks**: don't inflate CI wall-clock materially (prefer isolating just the two suites; whole-suite serialization is the fallback); confirm the chosen mechanism is supported by vitest 2.1.9.
