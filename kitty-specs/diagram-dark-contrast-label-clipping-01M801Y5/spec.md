# Mission Specification: Readable build-time diagrams in both themes

**Mission Branch**: `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5`
**Created**: 2026-11-21
**Status**: Draft
**Input**: Dispatch brief for spec-kitty/doc-kitty #369 (items 1 and 2 only, per the 2026-11-21 triage) and #370.

## Intent Summary

A reader of a doc-kitty site, in either the light or the dark theme and at
desktop or phone width, opens a page with a build-time Mermaid or PlantUML
diagram. Every node and edge label must be fully visible, and every label and
edge must stand out from what is painted behind it. The rule that must always
hold: a label sits on the fill it is drawn on, so its colour follows that fill,
not the page theme, whenever the author fixed the fill.

Primary actors: the site reader, and the author who writes the diagram.
Trigger: a build that renders diagrams at build time (ADR-0040 dual mode).
Outcome: no clipped label; edges at least 3:1 and labels at least 4.5:1
against their backdrop, in both themes.

## Reproduction record (2026-11-21)

- **#369 item 1 (dark edges) does not reproduce.** On today's deployed
  consumer site, every Mermaid edge path and arrowhead resolves to the dark
  token `#8fb0f0` in dark mode, both on a fresh dark load and after a theme
  toggle; the light token `#33507f` appears only in light mode. The fixture
  build agrees. The consumer ships doc-kitty's default tokens only: its CSS
  re-declares no `--dk-diagram-*` token. This mission ratchets the behaviour
  with a browser check rather than changing it.
- **#369 item 2 (ArchiMate labels) reproduces.** PlantUML keeps the
  author's ArchiMate layer fills (`#FFC`, `#C9FFC9`, pale blue) in both
  themes, but the label text follows the themed `node-text` token, which is
  light in dark mode. The same happens to a Mermaid node whose author set a
  fill but no label colour.
- **#370 (clipping) reproduces.** A Mermaid diagram that sets its own font
  in an `%%{init}%%` directive renders with no `font-family` rule for its
  labels. Its labels are measured in the render page's default font and
  shown in the site's sans font, so they overflow their box. The fixture
  reproduces the consumer's numbers exactly ("appends events": box 98.86 px,
  text 105 px).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Labels on author-set fills stay readable (Priority: P1)

A reader in dark mode opens an architecture page with an ArchiMate view or a
Mermaid flowchart whose author coloured some nodes. Every label is dark on a
pale fill and light on a deep fill, whatever the page theme.

**Why this priority**: today most ArchiMate labels on the consumer site are
unreadable in dark mode (#369, P1).

**Independent Test**: build the fixture page, open it in both themes, and
measure each label's contrast against the pixels painted behind it.

**Acceptance Scenarios**:

1. **Given** an ArchiMate element with a pale layer fill, **When** the page is
   in dark mode, **Then** its label reaches at least 4.5:1 against that fill.
2. **Given** a Mermaid node with an author fill and no author label colour,
   **When** either theme is active, **Then** its label reaches at least 4.5:1
   against that fill.
3. **Given** a Mermaid node whose author set both a fill and a label colour,
   **When** the page renders, **Then** the author's label colour is kept.

---

### User Story 2 - No clipped labels (Priority: P2)

A reader opens a Mermaid diagram with long labels at 1280 px or 390 px wide.
No label is cut off, including in a diagram that sets its own font.

**Why this priority**: 21 of 100 labels are cut off on the consumer's
container view (#370, P2).

**Independent Test**: on the fixture page, compare each label's content width
with its box width at both viewport widths.

**Acceptance Scenarios**:

1. **Given** a diagram with an author font in an init directive, **When** it is
   shown at 1280 px or 390 px, **Then** no label's content is wider or taller
   than its box.
2. **Given** a diagram with no author font, **When** it is shown, **Then** no
   label overflows either.

---

### User Story 3 - Edges stay visible in both themes (Priority: P2)

A reader in either theme can follow every themed edge of a diagram.

**Why this priority**: the reported dark-edge defect does not reproduce; a
check pins the behaviour so it cannot regress.

**Independent Test**: measure every themed edge's contrast against its
backdrop at several points along the edge.

**Acceptance Scenarios**:

1. **Given** a themed Mermaid or PlantUML edge, **When** either theme is
   active, **Then** it reaches at least 3:1 against its backdrop along its
   length.

### Edge Cases

- An author edge colour (`linkStyle`) is the author's choice; it is reported by
  the check but not forced to a colour.
- A diagram whose `%%{init}%%` replaces the theme colours entirely keeps the
  author's colours: they no longer follow the page theme, so the author owns
  their contrast.
- A mid-tone fill gets whichever of black or white contrasts more; that choice
  always clears 4.5:1.
- The diagram copy in the lightbox follows the same font rule as the figure.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | ArchiMate labels contrast with their fill | As a dark-mode reader, I want each PlantUML element label on an author fill to reach 4.5:1 against that fill so that I can read an ArchiMate view. | High | Open | [build] | no — the fixture's ArchiMate labels fail in dark mode on `main` |
| FR-002 | Mermaid labels on author fills contrast with their fill | As a reader, I want a Mermaid node or cluster label on an author fill with no author label colour to reach 4.5:1 against the fill in both themes so that coloured diagrams stay readable. | High | Open | [build] | no — the fixture's pale-fill node fails in dark mode on `main` |
| FR-003 | Author label colours are kept | As an author, I want a label colour I set to stand so that the toolkit only fills a gap I left. | Medium | Open | [ratchet] | yes — paired with FR-002 on the same fixture diagram (fill-only node vs fill-and-colour node) |
| FR-004 | Labels are measured in the font they are shown in | As a reader, I want no Mermaid label cut off, at 1280 px and 390 px, including in a diagram with an author font so that I can read every label. | High | Open | [build] | no — the fixture's init-directive diagram clips three labels on `main` |
| FR-005 | Themed edges stay visible | As a reader, I want every themed edge to reach 3:1 against its backdrop in both themes so that I can follow the diagram. | Medium | Open | [ratchet] | yes — pins today's passing behaviour; paired with FR-001 in the same browser check, which fails on `main` |
| FR-006 | A browser check covers both themes | As a maintainer, I want one browser check over the fixture that asserts FR-001, FR-002, FR-004 and FR-005 in both themes so that a regression fails CI. | High | Open | [build] | no — the check is red on `main` |
| FR-007 | Changelog fragment | As an adopter, I want a changelog entry so that I know diagram labels changed. | Low | Open | [build] | no — `pnpm validate:changelog` sees the fragment |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Label contrast | Every measured label reaches at least 4.5:1 against its backdrop, in both themes. | Accessibility | High | Open |
| NFR-002 | Edge contrast | Every themed edge reaches at least 3:1 against its backdrop at every sampled point, in both themes. | Accessibility | High | Open |
| NFR-003 | No overflow | For every label box, content width and height exceed the box by at most 1 px, at 1280 px and 390 px. | Accessibility | High | Open |
| NFR-004 | No client cost | The fix adds zero client JavaScript; diagram pages ship the same scripts as before. | Performance | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Core only | Change doc-kitty only; report, never edit, the consumer site (spec-kitty/spec-kitty#6936). | Business | High | Open |
| C-002 | Stay off the PDF lane | Do not touch the files of PR #405 (operator ruling R36). | Business | High | Open |
| C-003 | No new dependency | Add no package and no font file. | Technical | High | Open |
| C-004 | Self-hosted PlantUML | PlantUML still renders only against a self-hosted server. | Technical | High | Open |
| C-005 | Theme contract intact | The six `--dk-diagram-*` tokens and their sentinel rewrite keep their meaning. | Technical | High | Open |

### Key Entities

- **Author fill**: a node or cluster fill set by the diagram author, which does
  not follow the page theme.
- **Themed colour**: a colour drawn from a `--dk-diagram-*` token, which follows
  the page theme.
- **Label box**: the box Mermaid sizes for a label at render time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the fixture page, 0 labels fall below 4.5:1 in either theme (today: every ArchiMate label and the pale-fill node fail in dark mode). — [build] · no-op passable: no
- **SC-002**: On the fixture page, 0 labels overflow their box at 1280 px or 390 px (today: 3). — [build] · no-op passable: no
- **SC-003**: On the fixture page, 0 themed edges fall below 3:1 in either theme. — [ratchet] · no-op passable: yes — paired with SC-001 in the same check

## Assumptions

- The toolkit owns diagram label typography: a font an author sets in an init
  directive is replaced for labels by one Arial-metric stack, so render-time
  and display-time widths match. This is reported to the dispatcher as a
  product call.
- An Arial-metric font (Arial, Helvetica, Liberation Sans or Arimo) is present
  on the build machine and on most reader devices. A device with none falls back
  to its own sans font, which can still be wider; that residual risk is noted.
- Item 3 and item 4 of #369 are out of scope (#370 owns clipping; #371 owns
  click-to-zoom).
