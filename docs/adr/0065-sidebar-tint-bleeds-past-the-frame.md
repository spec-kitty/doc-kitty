---
title: "ADR-0065: The sidebar tint bleeds out to the viewport edge"
description: On a viewport wider than the frame cap, the sidebar panel's tint runs out to the viewport's start edge, as the header bar does; its navigation stays on the frame.
doc_status: active
updated: 2026-10-25T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0064-default-frame-cap
  - adr/0045-frame-width-token
  - guides/consumer-setup
---

# ADR-0065: The sidebar tint bleeds out to the viewport edge

## Status

Accepted (2026-10-25). Decided by the maintainer on issue #224.

Amends decision 4 of [ADR-0045](./0045-frame-width-token.md) for the sidebar
panel only: the sidebar still follows a capped frame, but only its navigation
does. The panel's tint does not stop at the frame edge.

## Context

[ADR-0064](./0064-default-frame-cap.md) caps the frame at 120rem by default, so
every viewport wider than 1920px now has a gutter on each side of a centred
frame. The header bar spans the viewport and only its content is inset to the
frame. The sidebar panel was moved in by the gutter as a whole.

At 2560px in light mode that gave a page-background gutter from x 0 to 319 and
then the sidebar's tint, rgb(244,242,237), the same tint as the header above
it, from x 320 to 607. The panel has a hairline on its end edge and none on
its start edge, so it read as a tinted block floating 320px in, under a header
that runs edge to edge. Dark mode showed the same, more faintly. Before
ADR-0064 only a site that opted into a cap saw this; the default made it the
look for everyone above 1920px. The geometry tests could not see it (#224).

## Decision

On a viewport wider than the frame, the sidebar panel starts at the viewport's
start edge and is wider by the frame gutter, which becomes its inline-start
padding. The navigation column stays exactly where it was, on the frame's start
edge; only the tint extends, the way the header bar's does.

In CSS (`dk-components.css`, from 50rem): the pane keeps Starlight's
`inset-inline-start: 0`, and gets
`width: calc(var(--sl-sidebar-width) + var(--dk-frame-gutter))` and
`padding-inline-start: var(--dk-frame-gutter)`. With the gutter at 0, which is
every viewport up to the default cap and every full-width frame, the geometry
is Starlight's own. Offsets are logical, so a right-to-left page mirrors it.

## Consequences

### Positive

- The navigation column and the header read as one piece of chrome on a wide
  screen, in both colour modes, with no new colour or line.
- Nothing moves at or below 1920px with the default cap, and nothing moves on a
  full-width frame.

### Negative

- The page background shows only in the gutter on the frame's end side. The
  layout is no longer symmetric outside the frame.
- The tinted strip is part of the sidebar pane, which scrolls. When the
  navigation is taller than the window, a wheel or trackpad scroll over the
  strip scrolls the navigation, not the article; over the gutter on the other
  side it still scrolls the article. Painting the tint with a separate fixed
  element that ignores the pointer would keep the old behaviour, at the cost
  of a second painted element per page.

### Risks

- A theme that styles `.sidebar-pane`'s inline padding or width would now meet
  the toolkit's rule. None in the toolkit does.

## Alternatives considered

### Option 2: a start-edge hairline on the panel

Makes the floating panel look framed on purpose. Rejected: the hairline token
is rgb(237,238,243) in light mode, against a page background of
rgb(251,250,247), so it is barely visible at 2560px and does little to change
how the panel reads.

### Option 3: accept the look

The consumer guide already said that the page background shows outside the
frame. Rejected now that the default cap shows it to every reader above 1920px.

## References

- Issue #224, with the 2560px comparison of the three options.
- Guards: `tests/a11y/layout-geometry.spec.ts` A2c (the panel starts at the
  viewport's start edge, its navigation on the frame), and the 2560px
  `wide-viewport chrome above the frame cap` visual baseline (`chrome-2560.png`)
  in `tests/a11y/visual.spec.ts`.
