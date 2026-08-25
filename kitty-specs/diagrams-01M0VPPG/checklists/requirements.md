# Specification Quality Checklist: Diagrams (Mermaid)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)*
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

\* Build-tooling mission on a research-backed design (findings-D + locked decisions); per
house style (M6), settled package/token/seam names appear as anchors for traceability.
Requirements remain outcome-framed and testable.

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

- Four product/scope forks resolved with the owner before authoring: diagrams-in-decks IN
  v1; opt-in preset packaging; `%%` field set = title/description/attribution/source;
  `--dk-diagram-*` promoted to the Default catalog + light values.
- Research (findings-D topic 4) locked the build choices (astro-mermaid@2.1.0 +
  mermaid@11.17.1, the accTitle/accDescr self-naming mechanism, theme:'base' + token hook,
  no-JS = source + caption, CSP note); grounding measured the delta (orphan tokens, the
  deckSplit integration mirror, browser-free build-example, AXE_PAGES gating). Both folded
  into the FR/NFR/C set.
- Deliberate deferrals (issue #13): build-time static-SVG pre-render (both engines) and
  PlantUML. Glossary/Contextive (M4) shares findings-D but is a separate mission.
- **Rev 2** folds a four-lens post-spec squad (`reviews/post-spec-squad.md`): accessible
  name falls back `title`→`description` (a description-only diagram was nameless);
  contrast proven by vitest (axe doesn't evaluate SVG contrast) + a direct accessible-name
  assertion (axe's svg-img-alt may not fire); a non-vacuous render-gate + the deck fence
  co-landing its render-wait; the example flips `diagrams:true` in the transform WP; the
  `--dk-diagram-*` promotion also wires the brand `tokens.css` + retires the orphan; a
  single render owner (astro-mermaid autoTheme off); footprint via Playwright network; and
  the render/ordering/deck-script (ADR-0023) + token/brand (ADR-0024) seams authored in plan.
  Terminology tightened (accTitle/accDescr are "accessibility statements", not "directives").
