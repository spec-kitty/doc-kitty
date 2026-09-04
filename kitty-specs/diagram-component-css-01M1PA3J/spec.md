# Mission Specification: Diagram markup + component-CSS delivery fixes

**Mission Branch**: `fix/diagram-component-css`
**Created**: 2026-09-04
**Status**: Draft
**Input**: Closes #59, #60, #68. Grounded by a completed as-is research pass + a 4-lens adversarial squad (architect / debugger / patterns / researcher).

## Intent Summary

Readers and authors of a doc-kitty site currently see **malformed, unstyled diagrams**, and any site that applies a **brand theme** (the example does) silently ships **unstyled global components** (Markua callouts today, diagram figures next). Two root causes, one coherent goal — *the diagram figure must be well-formed, and global component CSS must survive brand theming on both in-frame docs and out-of-frame decks*:

- **#59** — every Mermaid figure is emitted inside a stray `<pre>` (a mdast→hast quirk: `hName` projected onto a still-`code`-typed node), so diagrams render inside a scrollable monospace code-card with a non-wrapping caption, and the wrapper is a spurious keyboard tab stop. All 6 diagrams across 3 pages are affected.
- **#60** — the figure/caption stylesheet the markup references was never written; captions render at browser defaults everywhere.
- **#68** — because an active brand theme *replaces* the base stylesheet (`customCss` slot 0) with a tokens-only generated sheet, global component CSS living in `theme.css` (`.dk-callout`, and any new `.dk-diagram`) is dropped from branded docs pages.

Both #59 and #60 sit in a **mutation-dead zone**: no existing gate would go red if either defect were re-introduced. Closing that gap is in scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Well-formed, legible diagrams on docs and decks (Priority: P1)

A reader opens a docs page or a slide deck that contains a Mermaid diagram. The diagram renders as a clean captioned figure — not boxed inside a code-card, its caption in normal wrapping prose — on both the in-frame docs shell and the out-of-frame deck shell.

**Why this priority**: This is the visible defect on every diagram page today (#59) and the reason the diagram feature looks unfinished (#60). It is the core user-facing value.

**Independent Test**: Build the example; confirm no diagram figure is wrapped in a `<pre>` and that captions are non-monospace, wrapping, muted — verified on `architecture/overview`, `architecture/diagram-demonstrator`, and a deck.

**Acceptance Scenarios**:

1. **Given** a docs page with a ```mermaid fence, **When** the site is built, **Then** the rendered `<figure class="dk-diagram">` is a block-level child of its content section and has no `<pre>` ancestor.
2. **Given** the same page in a browser, **When** the diagram renders, **Then** the caption text is not monospace, wraps normally, and is not inside a bordered code-card box.
3. **Given** a deck slide with a Mermaid diagram, **When** the slide is viewed, **Then** the figure is not boxed as a code-card and the caption is legible (the deck's `pre:not(.mermaid)` code-card and code-block `tabindex` still apply to *real* code blocks).

### User Story 2 - Styled components survive brand theming (Priority: P1)

An operator adopts doc-kitty with a brand theme (as the example does). Global components — Markua callouts and diagram figures — render fully styled on branded docs pages and on decks, not as unstyled default markup.

**Why this priority**: Branded docs currently ship unstyled callouts (#68), and the new diagram CSS (#60) would meet the same fate if placed in `theme.css`. Fixing delivery once covers both.

**Independent Test**: Build the branded example; confirm a docs page that renders a callout and a diagram links a stylesheet that actually contains `.dk-callout*` and `.dk-diagram*` rules; confirm a deck does too.

**Acceptance Scenarios**:

1. **Given** the branded example, **When** a docs page renders a `.dk-callout`, **Then** the page ships (links or inlines) the `.dk-callout*` rules.
2. **Given** the branded example, **When** any docs page or deck renders a `.dk-diagram` figure, **Then** the `.dk-diagram*`/`.dk-diagram__caption` rules are delivered to that surface.
3. **Given** no brand theme (default path), **When** the site is built, **Then** component CSS is still delivered and the default-path token/customCss contract remains intact.

### User Story 3 - Regressions are caught (Priority: P2)

A maintainer changes the diagram pipeline or component styling. If the double-`<pre>` returns, or component CSS stops reaching a branded page, a gate fails.

**Why this priority**: Both defects shipped precisely because nothing tested for them. Without gates the fix silently rots.

**Independent Test**: Re-introduce each defect on a scratch branch; confirm at least one gate turns red for each.

**Acceptance Scenarios**:

1. **Given** the corrected pipeline, **When** a change re-wraps a diagram figure in a `<pre>`, **Then** the build-artifact gate fails (checked across all 3 diagram pages).
2. **Given** the corrected delivery, **When** component CSS is removed from a branded page, **Then** a CSS-delivery gate fails.
3. **Given** the corrected caption styling, **When** the deck caption reverts to monospace/`white-space:pre`, **Then** a computed-style check fails on the deck shell.

### Edge Cases

- A real (non-diagram) fenced code block must keep its code-card styling and keyboard-focusable scroll region — the fix must not strip those.
- `architecture/overview` (a diagram page currently in no test lane) must be covered.
- A deck must actually contain a Mermaid diagram (none is published today) so the deck diagram path is exercised.
- Accessible figure semantics (`role="group"`, `accTitle`→name, `accDescr`→description) must be unchanged after the markup fix.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Well-formed diagram figure | As a reader, I want each Mermaid figure rendered as a block-level `<figure class="dk-diagram">` with no `<pre>` ancestor, so diagrams are not boxed in a code-card, on every diagram page and deck. (#59) | High | Open |
| FR-002 | Styled figure caption | As a reader, I want the figure caption/description/attribution rendered in legible, wrapping, non-monospace, muted text on docs and decks. (#60) | High | Open |
| FR-003 | Component CSS survives branding | As an operator of a branded site, I want global component styles (callouts and diagram figures) delivered to branded docs pages and out-of-frame decks. (#68, #60) | High | Open |
| FR-004 | Deck diagram fixture | As a maintainer, I want a published example deck that contains a Mermaid diagram so the deck diagram render + CSS path is exercised. | Medium | Open |
| FR-005 | Regression gates | As a maintainer, I want gates that fail on a re-introduced double-`<pre>` and on missing component CSS delivery, closing the current mutation-dead zone. | High | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Single render owner preserved | Exactly one `<svg>` is drawn per Mermaid node on both docs and deck shells after the fix (no double-render, no missing render); verified on the demonstrator + a deck. | Reliability | High | Open |
| NFR-002 | No gate regressions | All pre-existing diagram/deck/a11y/build gates remain green; the `.reveal … pre:not(.mermaid)` code-card rule and the code-block `tabindex` still apply to real code blocks. | Reliability | High | Open |
| NFR-003 | Accessible figure preserved | The figure keeps `role="group"`; the diagram's accessible name/description (`accTitle`/`accDescr`) are unchanged from today's output. | Accessibility | High | Open |
| NFR-004 | Default-path byte-contract | On the no-theme (default) path, the token/`customCss` contract stays intact (any invariant test asserting the default `customCss` shape is updated deliberately, not broken silently). | Compatibility | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Fix #59 at the remark seam | Correct #59 where it originates — retype the Mermaid mdast node off `code` so a single clean `<pre class="mermaid">` is emitted; leave `diagram-figure.ts` unchanged. Downstream unwrap is a fallback only if a downstream remark consumer breaks on the custom node type. | Technical | High | Open |
| C-002 | Standalone component sheet | Deliver global component CSS via a standalone stylesheet added as its OWN `customCss` entry (survives brand slot-0 replacement) AND explicitly linked by the deck layout; do NOT fold it into the brand-replaced base `theme.css`. | Technical | High | Open |
| C-003 | Caption token discipline | Caption typography uses general text tokens (`--dk-color-text-*`, `--dk-text-*`); the `--dk-diagram-*` tokens are Mermaid graph colors and must not drive caption typography. | Technical | Medium | Open |
| C-004 | Do not re-enable #31 asserts | Do not re-enable issue #31's deferred internal-node-geometry assertions. | Technical | Medium | Open |
| C-005 | Client-side render only | Keep client-side Mermaid rendering; do not introduce build-time SVG (that is deferred to #13). | Technical | Medium | Open |
| C-006 | Changelog convention | Record the change as a dated fragment under `docs/changelog/` (repo convention); there is no `CHANGELOG.md` and no Python docs/terminology gates in this JS/Astro repo. | Process | Low | Open |

### Key Entities

- **Diagram figure**: the `<figure class="dk-diagram">` wrapping `<pre class="mermaid">` plus `<figcaption>` (`.dk-diagram__caption`/`__desc`/`__attr`); must be a block child of its section, never inside a `<pre>`.
- **Component stylesheet**: the standalone sheet carrying `.dk-callout*` and `.dk-diagram*` rules, delivered on both the docs (`customCss`) and deck (`DeckLayout` link) surfaces.
- **customCss cascade**: default path ships the base sheet; branded path replaces slot 0 with a generated token sheet, so component CSS must live in a non-slot-0 entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 of 6 diagram figures across the 3 diagram pages are wrapped in a stray `<pre>` (was 6/6).
- **SC-002**: On the branded example, 100% of docs pages/decks that render a callout or diagram deliver the corresponding component rules (was 0% for callouts and diagrams).
- **SC-003**: Diagram captions render non-monospace, wrapping, and visually muted on both the docs and deck shells.
- **SC-004**: Re-introducing the double-`<pre>` OR removing component-CSS delivery turns at least one gate red (mutation-true), demonstrated for each.
- **SC-005**: All pre-existing diagram, deck, a11y, and build-artifact gates remain green, and real code blocks keep their code-card + focusable-scroll behavior.

## Issue Traceability

- **#59** → FR-001, NFR-001, NFR-003, C-001 (+ FR-005 markup gate)
- **#60** → FR-002, C-003 (+ FR-005 CSS-delivery/computed-style gate)
- **#68** → FR-003, NFR-004, C-002 (+ FR-005 CSS-delivery gate)
