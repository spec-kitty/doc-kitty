# Mission Specification: Deck & Layout Polish

**Mission Branch**: `feat/deck-layout-polish`
**Created**: 2026-09-05
**Status**: Draft
**Input**: Three confirmed defects from the 2026-09-04 docsite review (GitHub #65, #66, #67), each re-verified reproducing on current `main` with a Playwright pixel pass.

## Overview

The published doc-kitty docsite carries three visible-quality defects a reader hits
directly. This mission remediates all three and proves each fix with an actual
browser pixel pass:

- **#65 (a11y BLOCKER)** — a showcase-deck slide is illegible.
- **#66 (deck UX)** — the deck title slide overflows and vertical stacks give no cue.
- **#67 (layout)** — reading content is marooned on wide monitors.
- **Persona polish (scope addition)** — the stakeholder-profile (Persona) layout kind renders a duplicated, broken identity.

Baseline evidence (BEFORE, `main` @ 7531919): the deck's forced-navy slide renders
near-black text at ~1.05:1 for **every** viewer (the out-of-frame deck has no theme
mechanism at all, so it is permanently on light tokens); the synthesized title slide
measures ~817px of content on reveal's ~700px logical stage, clipping the first
Mermaid diagram off the bottom; and on wide viewports the ~720px reading column stays
pinned by the left sidebar while the main pane grows unbounded (1312/1632/2272px at
1600/1920/2560), leaving a large one-sided empty gutter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deck demo slide is legible for every viewer (Priority: P1)

A reader opens the published showcase deck. On the slide that demonstrates a slide
background directive, the body text, heading, and fragment list are clearly readable
regardless of whether the reader's device prefers a light or a dark colour scheme.

**Why this priority**: This is the WCAG 1.4.3 accessibility blocker (#65). Text at
~1.05:1 is invisible; the defect affects the deck's flagship demo slide today for all
viewers.

**Independent Test**: Open the deck's directive slide with the browser emulating a
light colour-scheme preference and again emulating dark; the slide's body text meets
contrast in both. Fully testable in isolation from the title-slide and wide-screen work.

**Acceptance Scenarios**:

1. **Given** a viewer whose device prefers a light colour scheme, **When** they view the
   demo background slide, **Then** its body text, heading, and fragment list are legible
   (contrast ≥ 4.5:1) against that slide's background.
2. **Given** a viewer whose device prefers a dark colour scheme, **When** they view the
   same deck, **Then** the whole deck (not just this slide) presents in a dark palette
   and all slide text remains legible.
3. **Given** a reader on an in-frame documentation page who has explicitly chosen the
   Light chrome theme, **When** their device prefers dark, **Then** the documentation
   page still honours their explicit Light choice (the deck's colour-scheme following
   does not leak onto or override chrome theming).

---

### User Story 2 - Deck title slide fits the stage and stacks are discoverable (Priority: P2)

A reader lands on the deck's opening slide and sees a clean title slide — a title and a
single focal element — with nothing clipped off the edges. When a slide has content
stacked vertically below it, the reader gets a visible cue that they can descend.

**Why this priority**: #66. The overflow (MAJOR) makes the opening slide read like a
clipped, scrolled article; the missing affordance (MINOR) hides half the deck's
navigable content.

**Independent Test**: Screenshot the title slide at the deck's default stage — the
focal element is fully visible, nothing clipped. Screenshot a slide that owns a vertical
stack — a down/stack affordance is present. Testable independently of #65 and #67.

**Acceptance Scenarios**:

1. **Given** the deck's title slide, **When** it renders at the default stage, **Then**
   it shows the title and the hero image with no content clipped beyond the stage bounds.
2. **Given** the content that previously overflowed the title slide (intro paragraph +
   first diagram), **When** the deck is rebuilt, **Then** that content appears on its own
   following slide, fully visible, and the intro paragraph's search sentinel remains
   indexed on a published slide.
3. **Given** any slide whose active leaf belongs to a vertical stack, **When** the reader
   views it, **Then** a visible up/down (or stack) affordance indicates further slides
   below; **And** when the active slide has no vertical stack, no misleading vertical cue
   is shown.
4. **Given** any slide in the deck, **When** it renders, **Then** its content is bounded
   to the reveal stage (measured in stage units, not viewport units) so it does not
   overflow.

---

### User Story 3 - Reading content stays usable on wide monitors (Priority: P2)

A reader opens a documentation page on a wide monitor (1600–2560px). The reading column
and its navigation sit in a balanced, centered frame instead of being stranded against
the left sidebar with a large empty gutter on the right.

**Why this priority**: #67. At ≥1920px the current layout marooning is pronounced;
reviewers split MAJOR/MINOR, and the pixel pass confirmed the content is pinned far left.

**Independent Test**: Screenshot a documentation page at 1600/1920/2560px — the whole
content frame is capped and centered, with no large one-sided gutter. Testable
independently of the deck work.

**Acceptance Scenarios**:

1. **Given** a documentation page at 1920px or 2560px, **When** it renders, **Then** the
   whole reading frame is capped to a maximum width and centered in the viewport, so the
   empty space is balanced rather than a single large right-hand gutter.
2. **Given** a documentation page below the wide breakpoint (e.g. 1280px), **When** it
   renders, **Then** its layout is unchanged from today (the cap applies only on wide
   viewports).
3. **Given** the wide-screen cap, **When** applied, **Then** it targets the real
   Starlight frame element verified in the built DOM (not an assumed class name).

---

### User Story 4 - Stakeholder-profile (Persona) page reads as one clean identity (Priority: P2)

A reader opens a Persona (stakeholder profile) page and sees a single, coherent identity
card — the passport — with the person's name once, a correctly-sized avatar, and their
role/goals/responsibilities and status fields. They do not see a broken giant hero image,
the name repeated three times, or duplicated metadata.

**Why this priority**: Scope addition (user request, 2026-09-05). Confirmed on current main
with a pixel pass: a Persona page renders a full-bleed page-hero (the avatar blown up as a
black disc) + Starlight's `<h1>` + a metadata band, and THEN the passport card repeats the
name, avatar, status, updated, type, and tags — three identity renders, two `<h1>`s, and a
broken-looking hero. The layout's own intent is that the passport IS the identity header.

**Independent Test**: Screenshot a Persona page in both themes — one identity card, one
`<h1>`, no giant hero, no duplicated metadata; other layout kinds (Default/Hub) are
unchanged. Testable independently of the deck and wide-screen work.

**Acceptance Scenarios**:

1. **Given** a `kind: Persona` page, **When** it renders, **Then** the passport card is the
   single identity header (avatar + name + fields); there is exactly ONE `<h1>`; no
   full-bleed page-hero and no separate metadata band appear above it.
2. **Given** any non-Persona page (Default, Hub, Presentation), **When** it renders, **Then**
   its header (page-hero, title, metadata band) is byte-unchanged from current main.
3. **Given** the branded build, **When** a Persona page renders, **Then** the `.dk-passport`
   marker and its fields remain present (the branded-build proof is preserved).

### Edge Cases

- A deck viewed with no colour-scheme preference resolvable (older engine): falls back to
  the light palette (today's behaviour) and stays legible — the demo slide must not
  depend solely on the dark palette to be readable.
- A slide background expressed as a theme token must still resolve when reveal applies it
  (the demo slide must render a real background, not an empty/unstyled panel).
- Diagrams inside a slide render as `<figure>`/`<svg>`; stage-unit content capping must
  not clip or distort a legitimately-sized diagram, nor reintroduce a spurious scroll
  region, and must preserve the Mermaid accessible-name ordering (diagrams render after
  reveal readies).
- The no-JS / print fallback of the deck must remain a linear, readable document.
- Explicitly chosen chrome theme (Starlight Light/Dark) and the "Auto" setting must all
  continue to behave as before on in-frame pages.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Deck follows colour-scheme preference | As a deck viewer, I want the out-of-frame deck to present in my device's preferred light or dark colour scheme so that slides are legible and on-brand for me. | High | Open |
| FR-002 | Deck theme layer separable from chrome | As a toolkit consumer, I want the deck's theme/style mechanism to be created and selected independently of the docsite chrome so that deck styling and site chrome can vary separately. | High | Open |
| FR-003 | Legible demo background slide | As a deck viewer, I want the slide that demonstrates a background directive to remain legible in both colour schemes so that the demo teaches a correct, accessible pattern instead of a broken one. | High | Open |
| FR-004 | Reshaped title slide | As a deck viewer, I want the title slide to show a title plus one focal element (the hero) with the former overflow content moved to its own following slide so that the opening slide reads cleanly and nothing is clipped. | High | Open |
| FR-005 | Stage-bounded slide content | As a deck viewer, I want each slide's content bounded to the reveal stage so that no slide overflows or clips its content. | Medium | Open |
| FR-006 | Vertical-stack affordance | As a deck viewer, I want a visible cue when the current slide has a vertical stack so that I know I can descend to more slides. | Medium | Open |
| FR-007 | Wide-screen frame cap | As a reader on a wide monitor, I want the reading frame capped and centered on wide viewports so that content is not marooned in a large empty gutter. | High | Open |
| FR-008 | Search sentinel preserved | As a search user, I want the deck's indexed content (the intro paragraph's search sentinel) to remain resolvable to the deck after the title-slide reshape so that deck search still works. | Medium | Open |
| FR-009 | Single Persona identity header | As a reader of a stakeholder-profile page, I want one coherent identity card (the passport) instead of a duplicated giant hero + repeated name so the page reads cleanly. | High | Open |
| FR-010 | Persona layout gating is scoped | As a maintainer, I want the Persona header changes to apply ONLY to `kind: Persona` so every other layout kind is byte-unchanged. | High | Open |
| FR-011 | Single Persona h1 | As an assistive-tech user, I want a Persona page to expose exactly one `<h1>` (the passport name, carrying the top/skip target) so the document outline is correct. | High | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Deck text contrast | On the demo background slide, body/heading/fragment text achieves WCAG 2.2 AA contrast (≥ 4.5:1 for body text) against that slide's background in BOTH light and dark viewer preferences, confirmed by pixel/contrast check. | Accessibility | High | Open |
| NFR-002 | Title slide fits stage | The title slide's rendered content height is ≤ the reveal logical stage height at the deck's default stage (no focal content clipped); verified by a stage-relative measurement in the pixel pass. | Usability | High | Open |
| NFR-003 | Wide-frame centering | At 1600px, 1920px, and 2560px viewport widths, the documentation reading frame is width-capped (≈ ≤ 90rem) and horizontally centered, so left/right empty space differs by no more than a small margin; verified in the pixel pass. | Usability | High | Open |
| NFR-004 | No regression | All pre-existing verification gates remain green (vitest unit tests, `astro check` typecheck, Playwright/axe a11y, link / markua / build-artifact asserts), and in-frame Starlight theming (explicit Light/Dark and Auto) behaves exactly as before. | Reliability | High | Open |
| NFR-005 | Browser-verified | Every visual fix is confirmed by an actual browser pixel pass (Playwright + chromium): docs pages at 1600/1920/2560px, deck title slide and a vertical-stack slide, the demo slide's contrast in both light and dark schemes, and a Persona page in both themes — BEFORE and AFTER. | Verification | High | Open |
| NFR-006 | Persona non-regression | On a Persona page there is exactly one `<h1>`; non-Persona pages' headers are byte-identical to main; the `.dk-passport` marker + fields persist; a11y/axe stays green. | Accessibility | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Route-isolated deck theme | The deck's theme/colour-scheme mechanism is implemented ONLY in the route-isolated deck sheet(s) linked by DeckLayout — never in the shared global `theme.css`/chrome layer — so deck styles are selectable independently of docsite chrome. | Technical | High | Open |
| C-002 | Explicit chrome theme wins | The deck's `prefers-color-scheme` following must not override an explicit in-frame chrome theme choice; in-frame pages keep Starlight's Light/Dark/Auto behaviour unchanged. | Technical | High | Open |
| C-003 | Single-source dark tokens | Reuse the existing `--dk-*` dark token catalog for the deck's dark palette; do not fork a second colour source. | Technical | High | Open |
| C-004 | Demo slide keeps its purpose | The demo background slide must still demonstrate a real slide background directive — using a theme-flipping brand token, not a raw hex that fails a theme. | Technical | Medium | Open |
| C-005 | Verified selector | The wide-screen cap must target the real Starlight frame element verified in the built DOM, not an assumed class name. | Technical | High | Open |
| C-006 | Dated changelog fragment | Record the change as a dated fragment under `docs/changelog/` (the project uses dated fragments, not a `CHANGELOG.md`). | Process | Medium | Open |
| C-007 | Resizing out of scope | Sidebar/column drag-resizing is expected-absent Starlight behaviour and is explicitly out of scope; do not add a resize handle. | Scope | Low | Open |
| C-008 | Persona proof preserved | The `.dk-passport` marker class and its field rows must remain (WP08 branded-build proof); the Persona header gating must not alter Default/Hub/Presentation kinds. | Technical | High | Open |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The showcase deck's demo background slide renders body text at ≥ 4.5:1
  contrast in both light and dark viewer preferences (measured in the AFTER pixel pass).
- **SC-002**: The deck title slide shows its title and hero with zero clipped focal
  content; the relocated intro paragraph and pipeline diagram are fully visible on their
  own slide.
- **SC-003**: When a slide owns a vertical stack, a reader sees a visible up/down (or
  stack) affordance; when it does not, no misleading vertical cue appears.
- **SC-004**: At 1600/1920/2560px a documentation page's reading frame is capped and
  centered — the one-sided empty gutter present today is gone.
- **SC-005**: All pre-existing verification gates remain green and in-frame chrome
  theming (Light/Dark/Auto) is unchanged from `main`.
- **SC-006**: A Persona (stakeholder-profile) page renders one identity card, one `<h1>`,
  no broken giant hero, and no duplicated metadata — in both themes — while non-Persona
  layouts stay byte-unchanged.
