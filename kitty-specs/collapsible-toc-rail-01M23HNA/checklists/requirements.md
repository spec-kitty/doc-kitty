# Specification Quality Checklist: Collapsible on-this-page TOC side rail

**Purpose**: Validate specification completeness and quality before planning
**Created**: 2026-09-09
**Feature**: [spec.md](../spec.md)

## Content Quality
- [x] No implementation details beyond the domain-necessary chrome vocabulary (Starlight PageSidebar / tokens / localStorage are the acceptance semantics, not incidental tech)
- [x] Focused on user value (reclaim article width; remembered; accessible)
- [x] Written for stakeholders (reader-facing scenarios)
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements testable and unambiguous
- [x] Types separated (FR / NFR / C)
- [x] IDs unique across FR-### / NFR-### / C-###
- [x] Every requirement row has a Status (all Open)
- [x] NFRs have measurable thresholds (0 flash frames, 0 hard-coded hex, 0 mobile/left-nav rules, tests pass)
- [x] Success criteria measurable
- [x] Success criteria technology-agnostic where the outcome allows
- [x] All acceptance scenarios defined
- [x] Edge cases identified (no-TOC, below-breakpoint, blocked storage, client-nav double-bind, click-stealing, scroll/clip)
- [x] Scope bounded (explicit Out of Scope)
- [x] Dependencies and assumptions identified

## Feature Readiness
- [x] Every FR has acceptance criteria (US1-US3 scenarios + SC-001..005)
- [x] User scenarios cover primary flows (collapse/restore, persistence, a11y/scoping)
- [x] Feature meets measurable Success Criteria
- [x] No implementation leak beyond domain-necessary chrome terms

## Notes
- Comprehensive brief (7 acceptance criteria) supplied by the operator; discovery minimized per explicit direction to drive.
- One domain-specificity: FR/NFR name Starlight PageSidebar, --sl-* tokens, localStorage, html[data-toc-collapsed]/[data-has-toc]. These are the chrome contract under test, not premature choices.
