# Specification Quality Checklist: Adopter loader & migration

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-03
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — domain terms only (section index, redirect map); no code prescribed
- [x] Focused on user value and business needs — adopter migration friction
- [x] Written for non-technical stakeholders — adopter/maintainer actors, plain-language stories
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Requirement types are separated (Functional / Non-Functional / Constraints)
- [x] IDs are unique across FR-###, NFR-###, and C-### entries
- [x] All requirement rows include a non-empty Status value
- [x] Non-functional requirements include measurable thresholds (0 drift, green suite, deterministic, 0 dangling)
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined (Given/When/Then per story)
- [x] Edge cases are identified (both-files, missing registry, dead target, root index)
- [x] Scope is clearly bounded (C-003..C-006 out-of-scope constraints)
- [x] Dependencies and assumptions identified (Assumptions section; build order US1→US2→US3)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (three prioritized, independently testable stories)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation passed. A post-spec adversarial squad (analyst-annie completeness/testability + paula-patterns boundary/scope) surfaced two BLOCKERs and several MAJORs, all folded into the revised spec:
  - **B (paula)**: FR-004's sub-path rename could not be data-only against the hardcoded subtype switch while SC-002 forbade a code edit → resolved by pulling the registry `subtypes` field into scope (FR-005), backward-compatible table fallback, SC-002 reworded to "no per-rename derivation-code edit."
  - **B (annie)**: redirect gate accepted a redirect pointing at a dead page → FR-010 made target-aware + US3-AS4.
  - MAJORs folded: reconciled FR-003 "every surface" list with per-surface acceptance scenarios (incl. `.mjs` gate root-index exemption, `check-links`, `llms.txt`, new-doc); rename→redirect linkage (FR-011); committed URL baseline (FR-008/NFR-005); ADR-0029 sidebar-group survival (FR-007); both-index collision (FR-004).
  - MINORs folded: no-registry-entry fallback (US2-AS5), root-index (US1-AS4), case-insensitive basename (FR-001/US1-AS6), NFR-002 concrete ceiling, redirect chains (US3-AS4). C-006 narrowed (era-ADR typing already shipped via #41); C-007 now requires the ADR to state the ADR-0004 reversal.
