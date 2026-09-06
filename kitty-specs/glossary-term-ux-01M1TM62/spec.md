# Mission Specification: Glossary Term-Link UX Polish

**Mission Branch**: `feat/glossary-term-ux`
**Created**: 2026-09-06
**Status**: Draft
**Input**: Tracker #64 (2026-09-04 docsite review), grounded in `docs/architecture/glossary.md` + ADR-0025/0027/0028.

## Overview

Autolinked glossary terms currently read exactly like ordinary links, open in a new
tab unlike other internal links, and the hover popover lacks a caret and never flips
away from the viewport bottom. This mission polishes those three so a glossary term
reads as a distinct, quiet "hover-for-definition" affordance — without breaking the
shared-link-node invariant, the re-derive parity guard, the no-JS fallback, or
presence-gated dormancy.

Reproduction confirmed on current main: term anchors carry `data-glossary-*` but **no
class** (no `.dk-glossary-link` styling exists); `src/lib/remark/glossary-term.ts:123-124`
emits `target="_blank" rel="noopener"`; `src/lib/glossary/preview-popover.client.ts:157`
always positions `top = rect.bottom + scrollY + 6` (no caret, no upward flip). AFTER
verification is a required browser pixel pass in both themes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader can tell a definition term from a navigation link (Priority: P1)

A reader scanning a documentation page can distinguish a glossary term (hover for a
definition, stays on the page) from an ordinary link (navigates away), and hovering a
term shows a well-anchored preview that stays on-screen even near the bottom of the
viewport.

**Why this priority**: #64 — the affordance ambiguity (MAJOR) plus the new-tab surprise
and popover polish (MINOR). Term links today are indistinguishable and behave unlike
every other internal link.

**Independent Test**: On a glossary demo page in both themes, a term link is visibly
distinct-but-quiet from a normal link (and AA), clicking a term navigates in the same
tab, and hovering a term near the viewport bottom shows a caret-anchored popover that
flips upward. Testable in isolation from other features.

**Acceptance Scenarios**:

1. **Given** a page with autolinked glossary terms, **When** it renders, **Then** each
   term anchor carries a `dk-glossary-link` class and reads distinct-but-quiet (e.g.
   dotted underline + help cursor) — distinguishable from an ordinary accent link and
   meeting WCAG 2.2 AA contrast in both light and dark.
2. **Given** an autolinked term AND a `:term` directive link on the same page, **When**
   they render, **Then** both carry the identical class/markup (the "indistinguishable
   downstream" invariant holds; the re-derive parity guard stays green).
3. **Given** an internal glossary term link, **When** the reader clicks it, **Then** it
   opens in the SAME tab (no `target="_blank"`), like other internal links.
4. **Given** JavaScript is disabled, **When** the reader clicks a term, **Then** the
   click-through still navigates and the "On this page" list still renders (NFR-005).
5. **Given** a term hovered near the bottom of the viewport, **When** the popover opens,
   **Then** it flips above the term and shows a caret pointing at it; near the top it
   opens below with the caret pointing up; it stays hoverable/Esc-dismissible (WCAG 1.4.13).
6. **Given** a site with no `.contextive/definitions.yaml`, **When** it builds, **Then**
   the output is byte-identical to before this mission (presence-gated dormancy, NFR-002).

### Edge Cases

- A term that is also the FIRST occurrence per section (auto-linked) vs a `:term` link:
  both must get the class via the shared emitter, not one path only.
- The re-derive of "links used" at render must see the class too, so the "On this page"
  list markup matches the inserted links (no parity drift).
- Popover flip must handle a term near BOTH edges and a term taller than the space below.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Term-link class | As a reader, I want glossary term anchors to carry a `dk-glossary-link` class so they can be styled as a distinct affordance. | High | Open |
| FR-002 | Distinct-but-quiet styling | As a reader, I want term links styled distinct-but-quiet (dotted underline + help cursor) so I can tell them from ordinary links at a glance. | High | Open |
| FR-003 | Shared-emitter parity | As a maintainer, I want the class applied at the shared link-node shape so auto-links and `:term` links stay identical and the re-derive parity guard holds. | High | Open |
| FR-004 | Same-tab navigation | As a reader, I want internal term links to open in the same tab (no `target="_blank"`) like other internal links. | Medium | Open |
| FR-005 | Popover caret | As a reader, I want the hover popover to show a caret pointing at the term. | Medium | Open |
| FR-006 | Popover viewport flip | As a reader near the viewport bottom, I want the popover to flip above the term so it stays fully on-screen. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Term-link contrast | The `dk-glossary-link` treatment meets WCAG 2.2 AA contrast in both light and dark, and is visually distinguishable from an ordinary accent link; verified by axe + pixel pass. | Accessibility | High | Open |
| NFR-002 | Dormancy byte-identical | A glossary-free build (no `.contextive/definitions.yaml`) is byte-identical to pre-mission output. | Reliability | High | Open |
| NFR-003 | Re-derive parity | `src/tests/glossary-substrate-parity.test.ts` and the "On this page" re-derive stay green — inserted links and listed links match, class included. | Reliability | High | Open |
| NFR-004 | No-JS fallback | With JS disabled, term click-through and the "On this page" list still work (dropping `target="_blank"` keeps same-tab navigation). | Accessibility | High | Open |
| NFR-005 | Popover a11y preserved | The popover stays WCAG 2.2 1.4.13 (hoverable, Esc-dismissible, persistent) after the caret/flip change. | Accessibility | High | Open |
| NFR-006 | Browser-verified | Every visual change confirmed by a Playwright + chromium pixel pass in both themes, BEFORE and AFTER. | Verification | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Shared link node | The class + the `target` change land at the shared link-node shape (`glossary-term.ts` + `glossary-autolink.ts`), never one path only — the "indistinguishable downstream" invariant (glossary.md / ADR-0027). | Technical | High | Open |
| C-002 | Base sheet for CSS | `.dk-glossary-link` styling lives in a base global sheet (`src/styles/dk-components.css`) so it works unbranded AND survives a brand swap — not `brand-components.css`. | Technical | High | Open |
| C-003 | Internal-only tab change | Drop `target="_blank"` only for internal term links (all term links resolve to `/glossary/<context>/#anchor`, internal). | Technical | Medium | Open |
| C-004 | Architecture unchanged | No change to the loader/resolver/generator seams or the presence-gate; ADR-0025/0027/0028 stay authoritative. | Technical | High | Open |
| C-005 | Dated changelog | Record a dated fragment under `docs/changelog/` (description ≤180 chars — CI `validate:docs` caps it). | Process | Medium | Open |

## Success Criteria *(mandatory)*

- **SC-001**: A glossary term link is visibly distinct-but-quiet from an ordinary link and AA-legible in both themes (AFTER pixel pass).
- **SC-002**: Clicking an internal term navigates in the same tab.
- **SC-003**: The hover popover shows a caret and flips above the term near the viewport bottom, staying fully on-screen and Esc-dismissible.
- **SC-004**: Auto-link and `:term` links are byte-identical (class included); the re-derive parity guard is green.
- **SC-005**: A glossary-free build is byte-identical to pre-mission; all gates + axe AA green.
