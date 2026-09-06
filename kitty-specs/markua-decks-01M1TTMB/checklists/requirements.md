# Specification Quality Checklist: Markua-capable decks

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — technical seam names (pass names, `guardDeck`) appear only in Constraints/Entities as boundary anchors, not as prescribed implementation
- [x] Focused on user value and business needs (deck authors get the same authoring shortcuts as the docsite)
- [x] Written for non-technical stakeholders (Intent Summary + user stories are plain-language)
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain (decision verify: clean, 0 markers)
- [x] Requirements are testable and unambiguous
- [x] Requirement types are separated (Functional / Non-Functional / Constraints)
- [x] IDs are unique across FR-###, NFR-###, and C-### entries
- [x] All requirement rows include a non-empty Status value (all `Open`)
- [x] Non-functional requirements include measurable thresholds (zero violations, byte-identical, same slide count, CI-serial green)
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (outcomes: rendered construct, zero a11y violations, boundary preservation, gates green)
- [x] All acceptance scenarios are defined (Given/When/Then per story)
- [x] Edge cases are identified (wrapper straddling boundary, attr-on-heading, hero, unknown directive, Markua-free deck, off-deck corpus)
- [x] Scope is clearly bounded (full surface deck-capable; `markuaTocDemote` stays agnostic; deck route only)
- [x] Dependencies and assumptions identified (ADR-0030 amendment supersession, PR #33 hero conflict, direct-to-feat)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (aside/callout, figure+hero, attributes)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification (mechanism of ordering left to /plan)

## Notes

- The concrete pass/`deckSplit` ordering mechanism (before vs after split, wrapper-boundary handling) is deliberately left to `/spec-kitty.plan` + research; the spec fixes the *requirement* (constructs render within a slide, no boundary swallowed), not the mechanism.
- All items pass on first validation iteration.
