# Mission Specification: Reveal-deck remediation

**Mission Branch**: `fix/reveal-deck-remediation`
**Created**: 2026-08-28
**Status**: Draft
**Input**: Remediate open GitHub issues #12 (reveal deck not rendering properly on the docsite) and #15 (deck diagrams render only on the first slide). GitHub #13 (build-time SVG pre-render pipeline) is explicitly out of scope.

## Overview

The slide-deck feature (mission `slide-decks-01M0T72Y`, M6) shipped a working out-of-frame reveal.js route and a presentations hub, but the deployed example decks have visible rendering defects, and diagrams authored beyond the first slide mis-render. This mission remediates those defects so hosted decks are presentable and usable, and adds brief on-page guidance so first-time readers can navigate and export them. It does **not** change the deck architecture: client-side Mermaid stays the diagram engine, reveal.js stays pinned, and the out-of-frame route seam is untouched.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hosted decks render correctly (Priority: P1)

A reader opens a published deck on the deployed example docsite. The deck is styled with the doc-kitty brand theme, the title slide shows only its intended title/content (not the front-matter `description` text), and the bottom banner/footer is present and correctly positioned. The deck is immediately presentable — it does not look broken or half-styled.

**Why this priority**: This is the core defect in #12. Broken CSS, a metadata line dumped onto the title slide, and a malfunctioning footer make the shipped feature look unfinished on the public example site — the first thing a prospective adopter sees.

**Independent Test**: Build the example site, open a published deck route, and confirm (by eye and by DOM assertion) that deck theme styles are applied, no `description` text appears as slide content, and the footer element is rendered and visible on every slide.

**Acceptance Scenarios**:

1. **Given** a published deck with a `description` in its front-matter, **When** the reader opens the deck, **Then** the title slide renders its intended heading/content and the `description` value does **not** appear as visible slide body text.
2. **Given** any slide of a published deck, **When** it is shown, **Then** the deck theme CSS is applied (branded colours/typography, not the raw unstyled reveal fallback) and the footer/bottom banner is present and positioned at the bottom of the frame.
3. **Given** the deck route loads, **When** the page renders, **Then** the reveal reset/core sheets and `dk-reveal-theme` are linked and take effect (no missing-stylesheet / unstyled flash that persists).

---

### User Story 2 - Diagrams render on every slide, not just the first (Priority: P1)

A deck author places a Mermaid diagram on slide 2 (or later). When the reader navigates to that slide, the diagram renders to a correctly sized figure — not a blank or zero-height box. Each diagram renders exactly once no matter how often the reader navigates to and from its slide.

**Why this priority**: This is #15. Today only diagrams on the active first slide render correctly; later slides are hidden (`display:none`) at load, so Mermaid renders them into a zero-box container and they mis-render. This silently breaks any multi-slide deck that puts a diagram past slide 1.

**Independent Test**: Author an example deck with a diagram on a non-first slide, navigate to that slide, and assert the rendered `<svg>` has a non-zero bounding box and there is exactly one `<svg>` for that diagram node.

**Acceptance Scenarios**:

1. **Given** a deck with a diagram on slide 2+, **When** the reader navigates to that slide for the first time, **Then** the diagram renders to a visible, non-zero-size figure.
2. **Given** a diagram has already rendered on its slide, **When** the reader navigates away and back to that slide, **Then** the diagram still shows exactly one `<svg>` (no duplicate render, no blank re-render).
3. **Given** a deck slide contains no diagram, **When** it becomes active, **Then** no diagram runtime work is triggered for it (the render owner no-ops on diagram-free slides).

---

### User Story 3 - Hub guidance for using and exporting decks (Priority: P2)

A first-time reader lands on the presentations hub. A concise instructional banner explains what the web-hosted decks are for and how to use them: navigating vertical slides, the key reveal.js hotkeys, and how to export a deck to PDF via the browser print dialog.

**Why this priority**: The QOL request in #12. Without it, readers do not discover vertical navigation, the overview/speaker-notes hotkeys, or the print-to-PDF path — the decks are less usable than they could be. It is valuable but secondary to the rendering defects.

**Independent Test**: Open the presentations hub and confirm the banner is present and contains a "How to use" section covering vertical-slide navigation, reveal.js hotkeys, and PDF-export steps.

**Acceptance Scenarios**:

1. **Given** the presentations hub, **When** the reader views it, **Then** a short instructional banner explains the purpose of the hosted decks.
2. **Given** the instructional banner, **When** the reader reads the "How to use" section, **Then** it describes vertical-slide navigation, reveal.js hotkeys (at least `Esc` overview and `S` speaker notes, plus fullscreen and arrow/space navigation), and how to export a deck to PDF via the browser print dialog (including enabling background graphics / print styles where applicable).

---

### Edge Cases

- **Diagram on a vertical (nested) slide**: a diagram on a vertically-stacked slide must render when that nested slide first becomes active, not only on the top-level horizontal slide.
- **Rapid navigation**: paging quickly through slides must not spawn overlapping render runs or leave a slide with two `<svg>`s for one diagram (the existing in-flight coalescing guard must be preserved).
- **Print / PDF view**: when the deck is opened in reveal's print view (`print-pdf` query), all slides become visible at once — diagrams on every slide must be rendered in that mode so the exported PDF is complete.
- **Theme toggle on a deck**: toggling light/dark must re-render diagrams in the new palette while keeping exactly one `<svg>` per node.
- **Deck with no diagrams**: must not pull the Mermaid runtime onto the route (footprint guard preserved).
- **Draft vs published deck**: the fixes apply to the published deck chrome; a draft/preview deck must keep its existing draft treatment.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Deck theme CSS applies on route | As a reader, I want the deck theme (reveal reset/core + `dk-reveal-theme`) to load and apply on the presentations route so that decks look branded and finished, not unstyled. | High | Open |
| FR-002 | No front-matter description on slides | As a reader, I want the deck's front-matter `description` to be used as page metadata only, so that it never appears as visible content on the title slide (or any slide body). | High | Open |
| FR-003 | Footer/bottom banner renders | As a reader, I want the deck footer/bottom banner to render and be correctly positioned on every slide so that deck chrome is complete and consistent. | High | Open |
| FR-004 | Diagrams render on non-first slides | As a deck author, I want a diagram on slide 2+ to render to a correctly sized figure when its slide becomes active, so that multi-slide decks with diagrams work. | High | Open |
| FR-005 | Exactly one render per diagram | As a maintainer, I want each deck diagram to render exactly once (single `<svg>` per node) across navigation and theme toggles, so that the single-render-owner invariant is preserved. | High | Open |
| FR-006 | Hub instructional banner | As a first-time reader, I want a concise banner on the presentations hub explaining the purpose of the web-hosted decks, so that I understand what they are. | Medium | Open |
| FR-007 | "How to use" guidance content | As a reader, I want the banner's "How to use" section to cover vertical-slide navigation, reveal.js hotkeys (`Esc` overview, `S` speaker notes, fullscreen, arrow/space), and PDF export via the browser print dialog (incl. the background-graphics/print-styles setting), so that I can operate and export a deck. | Medium | Open |
| FR-008 | Behavior assertions lock the fixes | As a maintainer, I want automated DOM/behavior assertions in the deck interaction suite covering FR-002/FR-003/FR-004/FR-005, so that these defects cannot silently regress. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Zero mis-rendered diagrams | Every diagram in the published example deck renders to a bounding box with width and height both greater than 0 once its slide is active; 0 blank/zero-size diagrams across the deck. | Reliability | High | Open |
| NFR-002 | Single render loop / footprint preserved | No second Mermaid render loop is introduced; exactly one `mermaid.run` code path drives deck diagrams, and a diagram-free deck route resolves 0 Mermaid runtime chunks (NFR-006/NFR-007 from M5 preserved). | Performance | High | Open |
| NFR-003 | Deck CSS stays route-scoped | Reveal/deck stylesheets remain linked only from the deck document; 0 reveal core-CSS rules leak onto non-deck documentation pages. | Maintainability | High | Open |
| NFR-004 | Accessibility stays green | The deck route and presentations hub continue to pass the existing a11y lane (axe) with 0 new violations after the fixes. | Accessibility | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Behavior-only verification | Verification is added as DOM/behavior assertions in the Playwright deck interaction suite only; no visual/a11y snapshot baselines are regenerated or added by this mission. | Technical | High | Open |
| C-002 | #13 out of scope | The build-time SVG pre-render pipeline (Mermaid + PlantUML, GitHub #13) is explicitly excluded; it remains a separate future mission. | Scope | High | Open |
| C-003 | Client-side Mermaid unchanged | Client-side Mermaid remains the deck diagram engine; no build-time / headless render is introduced (the M5 architecture is preserved). | Technical | High | Open |
| C-004 | Reveal pin unchanged | Reveal.js stays on the shipped 6.0.1 core + Notes plugin set; no version bump or additional plugins. | Technical | Medium | Open |

### Key Entities

- **Deck (presentation)**: a Markdown document under `presentations/` with front-matter (`title`, `description`, `doc_status`), split by the deck transform into one `<section>` per slide. Rendered by the out-of-frame `DeckLayout`.
- **Slide**: a `<section>` inside `.reveal > .slides`. May contain a diagram. Non-active slides are hidden (`display:none`) until navigated to — the root cause surface for #15.
- **Deck diagram**: a `pre.mermaid` node rendered client-side by the single render owner (`initDiagrams`), which `DeckLayout` drives.
- **Deck chrome**: the deck's footer/bottom banner and navigation controls owned by `DeckLayout` — the surface for the #12 footer defect.
- **Presentations hub**: the section index listing published decks (registry-driven `Hub` layout). Host of the new instructional banner (FR-006/FR-007).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of published example-deck slides render with the intended deck theme (branded styling + visible footer); 0 slides show the raw/unstyled reveal fallback.
- **SC-002**: The deck title slide shows 0 stray metadata lines — the front-matter `description` never appears as visible slide content.
- **SC-003**: 100% of diagrams in the example deck render to a visible, correctly sized figure regardless of slide position; a slide-2+ diagram is no longer blank or zero-size, and each renders as exactly one `<svg>`.
- **SC-004**: A first-time viewer can, using only the hub guidance, (a) navigate vertical slides, (b) open the overview and speaker views via hotkeys, and (c) export a deck to PDF — all three are documented on the presentations hub.
- **SC-005**: The full existing gate suite (unit tests, a11y lane, deck interaction spec) stays green, and the new behavior assertions for FR-002/FR-003/FR-004/FR-005 pass.

## Domain Language *(canonical terms)*

- **Deck** — the canonical term for a presentation; avoid "slideshow" / "presentation file".
- **Slide** — a single `<section>`; a **vertical/nested slide** is a slide stacked under a horizontal slide.
- **Render owner** — the single client module that renders Mermaid (`initDiagrams`); there is exactly one.
- **Presentations hub** — the section index page for decks; avoid "decks index" / "gallery".

## Assumptions

- The instructional guidance lives on the presentations hub only (not embedded inside each running deck); an in-deck help affordance is not required.
- "CSS not loading properly or underdeveloped" (#12) is remediated to the point that the example decks are presentable with the existing `dk-reveal-theme` token approach; a full visual redesign of the deck theme is not in scope.
- The reveal.js hotkeys documented are the standard set (`Esc` overview, `S` speaker notes, `F` fullscreen, arrows/space navigation); the exact list may be trimmed to what the shipped reveal build actually supports.
- PDF-export guidance targets the browser print dialog path already supported by reveal 6 (`print-pdf` view), including enabling "Background graphics" so deck styling is included.
