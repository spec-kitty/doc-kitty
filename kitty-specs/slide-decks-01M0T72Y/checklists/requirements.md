# Specification Quality Checklist: Slide Decks (reveal.js)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)*
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

\* This is a build-tooling mission on a fixed technical design of record (ADR-0012/0011/0004);
per house style (see the M3 spec), settled component/route/token names appear as anchors so the
spec is traceable. Requirements remain outcome-framed and testable.

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Requirement types are separated (Functional / Non-Functional / Constraints)
- [x] IDs are unique across FR-###, NFR-###, and C-### entries
- [x] All requirement rows include a non-empty Status value
- [x] Non-functional requirements include measurable thresholds
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (outcome-framed)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Four product/scope forks were resolved with the mission owner before authoring
  (deck model = docs-page routed out-of-frame; `###` vertical stacks IN v1;
  example ships a published deck; discovery honors `sections.yaml` — no RSS).
- Research locked the build choices (reveal 6.0.1, core+Notes, remark split, token
  mapping, Pagefind/CSS-leak assertions); grounding measured the delta with file:line
  evidence. Both are folded into the FR/NFR/C set.
- **Rev 2** folds a four-lens post-spec adversarial squad (`reviews/post-spec-squad.md`):
  the "Presentation anywhere" claim was infeasible and is amended to a **path+kind**
  switch (Astro route-override shadowing, not Starlight "exclusion"); a11y is split into
  axe (static) vs. a Playwright interaction test for keyboard/reduced-motion; discovery
  wiring + overview Hub are re-sequenced to keep the count pins single-computed; Pagefind
  narrowed to the speaker-note aside; a draft-deck fixture mandated; terminology
  canonicalized in a Domain Language section.
- Two genuine seams are deferred to plan by design, as gating ADRs authored **before**
  foundation: **ADR-0021** (routing seam — route-override wiring + deck-URL contract +
  sidebar exclusion) and **ADR-0022** (reveal integration — version pin + init contract +
  `--dk-*`→`--r-*` mapping). These are implementation decisions, not unresolved requirements.
