# Mission Specification: Test-Guard Hardening

**Mission Branch**: `feat/test-guard-hardening`
**Created**: 2026-09-04
**Status**: Draft
**Input**: Two quality follow-ups (#53, #54) from the metadata-vocab-hub-consolidation mission (PR #55, merged), surfaced by its pre-PR review squad.

## Overview

Two small, independent test/infra guards. Neither changes shipped runtime behavior; both close a gap between "the suite is green" and "the suite would catch the regression."

- **#53** — Hub draft-exclusion (INV-1) is not regression-guarded. `Hub.astro` filters children by `isPublished` (drafts must never appear in a hub), but the only Hub test replicates that filter chain instead of exercising Hub's real predicate — so deleting `isPublished` from `Hub.astro` leaves the whole suite green while draft pages would leak into every hub.
- **#54** — CI vitest flakes under default file-parallelism. Two suites (`example-adopter`, `glossary-build-warning`) each spawn a full `astro build`; run concurrently they race on shared build resources and intermittently fail (observed ~3/769 red locally, green when run serially).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A dropped draft-exclusion filter is caught by a test (#53) (Priority: P1)

A maintainer refactors `Hub.astro` and accidentally removes (or weakens) the `isPublished` draft-exclusion from the child listing. Today every test still passes, so the regression ships and draft pages appear in published hubs. This story makes that mistake impossible to ship silently.

**Why this priority**: It closes a real INV-1 hole in the just-shipped #50 work; a broken draft-exclusion is user-visible (unpublished content leaks) and currently un-caught.

**Independent Test**: Remove/weaken the `isPublished` branch of Hub's child pipeline and confirm at least one test turns red (mutation check). Add a draft child (numbered ADR + non-ADR) and confirm it is absent from the rendered hub produced by Hub's real pipeline.

**Acceptance Scenarios**:

1. **Given** Hub's child-filter pipeline, **When** the `isPublished` (draft-exclusion) predicate is deleted, **Then** at least one test fails.
2. **Given** a docs tree containing a draft child page, **When** the parent hub is rendered through Hub's actual pipeline (not a test-local replica), **Then** the draft child does not appear in the listing.
3. **Given** the existing published children, **When** the hub renders, **Then** they still appear (no over-exclusion).

---

### User Story 2 - The test suite does not flake in CI (#54) (Priority: P2)

A maintainer opens a PR; CI runs `pnpm test`. Today two build-spawning suites can race under default file-parallelism and fail intermittently, producing red CI that is misattributed to the PR. This story removes that flake.

**Why this priority**: Flaky CI erodes trust in the gate and wastes re-runs (this exact flake was hit during the prior mission's PR). Lower priority than #53 because it is infra reliability, not a correctness hole.

**Independent Test**: Run the full vitest suite repeatedly (or under CI's concurrency) and confirm the two build-spawning suites no longer race — consistently green across consecutive runs.

**Acceptance Scenarios**:

1. **Given** the vitest configuration, **When** the full suite runs under CI's default invocation, **Then** the `example-adopter` and `glossary-build-warning` suites do not race on concurrent `astro build` and pass deterministically.
2. **Given** the configuration change, **When** the full suite runs, **Then** total wall-clock stays within the CI budget (no pathological slowdown).

### Edge Cases

- A draft page that is *also* a numbered ADR (the generator would include it; the hub must still exclude it as a draft) — the #53 guard must cover this, distinct from the number-less/Template exclusion already tested.
- A published non-ADR child must remain listed (guard must not over-exclude).
- The #54 change must not silently serialize the *entire* suite in a way that materially inflates CI time if a cheaper isolation of just the two build-spawning suites is available.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Hub child-filter is test-guarded | As a maintainer, I want a test that reds if Hub's draft-exclusion filter is removed so that the INV-1 hole cannot ship silently. | High | Open |
| FR-002 | Draft child excluded via the real pipeline | As a doc author, I want a draft child proven absent from a rendered hub through Hub's actual filter (not a replica) so that the assertion reflects production. | High | Open |
| FR-003 | Vitest build-suites do not race | As a maintainer, I want the two `astro build`-spawning suites to run without racing under CI parallelism so that CI is not flaky. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | No gate regressions | All pre-existing gates (vitest, `astro check`, eslint, `assert:artifacts`/`assert:chrome`, a11y, doc-sanity) remain green: 0 newly failing gates. | Reliability | High | Open |
| NFR-002 | Guard is a true regression guard | Mutation check: removing Hub's `isPublished` filter turns ≥1 test red (the guard is not tautological). | Correctness | High | Open |
| NFR-003 | CI runtime bounded | The #54 change keeps the full vitest suite within the current CI time budget (no more than a modest increase; target ≤ ~1.5× the current suite wall-clock). | Performance | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Test/config only | No change to Hub's rendered output or any runtime behavior on the current corpus; #53/#54 add a guard + adjust test config only. | Technical | High | Open |
| C-002 | Independent slices | #53 (`Hub.astro` + tests) and #54 (`src/vitest.config.ts`) touch disjoint files and are separate, independently shippable WPs. | Technical | Medium | Open |
| C-003 | Respect existing lane discipline | The #53 guard must not regress Pagefind/search coverage or the a11y lane; prefer a unit-level predicate test over a new a11y visual snapshot (which would touch the flaky lane). | Technical | Medium | Open |

### Key Entities *(include if feature involves data)*

- **Hub child-filter predicate**: the `published ∧ parent-of-current ∧ kind` selection Hub applies to `getCollection('docs')` before listing; currently inline in `Hub.astro` — to be made importable/testable.
- **vitest configuration**: `src/vitest.config.ts` — controls file-parallelism / pool isolation for the suite.
- **Example ADR corpus**: `example/docs/adr/` and siblings — where a draft fixture child may be added to exercise exclusion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Deleting Hub's `isPublished` draft-exclusion turns at least one test red (mutation-verified).
- **SC-002**: A draft child (numbered ADR and non-ADR) is provably absent from a hub rendered through Hub's real pipeline, while published children remain present.
- **SC-003**: The `example-adopter` and `glossary-build-warning` suites pass deterministically under CI's vitest invocation (0 flake across consecutive runs).
- **SC-004**: All pre-existing CI gates remain green (0 newly failing gates); full-suite wall-clock stays within budget.

## Assumptions

- #53 and #54 are independent; either can ship alone and still deliver value (each is its own WP / MVP).
- The `#53` approach (export Hub's predicate into a testable unit vs. add example-corpus fixtures + built-hub DOM assertion) is a plan-phase decision; the fixed outcome is a guard that reds on filter removal via the real predicate.
- The `#54` fix prefers the narrowest effective change (isolate/serialize the two build-spawning suites, or `fileParallelism:false`) that removes the race without materially inflating CI time.
- No dependency added, upgraded, or removed. Not a bulk edit.
