---
title: "ADR-0045: The page frame is full width by default; --dk-width-frame caps it"
description: The fixed 90rem wide-screen cap gives way to a public frame-width token that defaults to 100%. Sidebar, header content and rail follow a capped frame.
doc_status: active
updated: 2026-10-13
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0044-header-carrier
  - adr/0013-m1-chrome-substrate-single-layer
  - architecture/theming
  - architecture/collapsible-toc-rail
---

# ADR-0045: The page frame is full width by default; `--dk-width-frame` caps it

## Status

Accepted (2026-10-13).

Withdraws two statements made by the wide-screen cap of the deck-layout-polish
work (issue #67, its acceptance contract C-WIDE-1, and the
[2026-09-05 changelog entry](../changelog/2026-09-05-deck-layout-polish.md)):

- "Below the breakpoint the layout is unchanged." The layout between 72rem and
  100rem changes with this record; see [Trade-off](#trade-off-below-84rem).
- "Header investigated, NOT capped", the note in that rule's comment in
  `src/styles/dk-components.css`. Capping the header bar itself detached it from
  the sidebar, which had not moved. Both now move together: the bar stays
  full-bleed and its content follows a capped frame.

## Context

Since #67 the toolkit capped Starlight's `.main-frame` at 90rem from a 100rem
viewport up, and centred it. Measured on the published site at five widths, that
rule and the layout around it had four defects.

| Measure | 1152px | 1280px | 1600px | 1920px | 2560px |
|---|---|---|---|---|---|
| Frame width | 1152 | 1280 | 1056 | 1056 | 1056 |
| Gap between sidebar and reading pane | 0 | 0 | 272 | 432 | 752 |
| Reading column width | 600 | 664 | 552 | 552 | 552 |
| Toggle centre, distance from the rail's inner edge | 88 | 24 | 136 | 296 | 616 |

All values are CSS pixels.

1. **The frame did not fill its cap.** Starlight's `.page` is a column flex
   container. `margin-inline: auto` on a flex item turns off the default
   stretch, so the frame shrank to its content: 1056px, not 1440px.
2. **The sidebar and header stayed at the viewport edge.** Both are
   `position: fixed`, so they ignored the frame's centring. That is the gap.
3. **The rail had no definite width.** Starlight sizes the rail column as the
   sidebar width plus half the spare width, so it grew with every pixel of
   viewport, and the reading column got narrower as the window got wider.
4. **The collapse toggle was positioned against the viewport**, not the rail,
   so it sat over article text at 1152px and 1280px and inside the rail from
   1600px.

The layout guard ran at 1280px only, where the frame happened to be full width
and the toggle was 24px off. None of this was caught.

## Decision

1. **The frame is full width by default.** A cap is something a site opts into.
2. **One public token, `--dk-width-frame`, sets the frame's width.** Default
   `100%`. It accepts a length or a percentage:

   ```css
   :root { --dk-width-frame: 90rem; }
   ```

   A frame narrower than the viewport is centred.
3. **The token is a registered property** (`@property`, syntax
   `<length-percentage>`, initial value `100%`). An invalid value such as
   `banana` therefore computes to `100%` and the layout is the default. Without
   registration, every declaration that reads the token would be invalid.
4. **The sidebar, the header content and the rail follow the frame.** A derived
   length, `--dk-frame-gutter`, is the space on each side of a capped frame:
   `max(0px, (100% - var(--dk-width-frame)) / 2)`, from the 50rem breakpoint at
   which Starlight pins the sidebar, and `0px` below it. The fixed sidebar is
   moved in by the gutter, the header bar stays full-bleed while its content is
   padded by the gutter, and the collapse toggle is offset by it.
   - The base is `100%`, not `100vw`. Each use is on a fixed-position element,
     where `100%` is the viewport width without a classic scrollbar, the same
     width the frame's own `max-width` resolves against. `100vw` includes the
     scrollbar and would leave the sidebar half a scrollbar width off the frame.
   - The gutter is declared on `:root` and reads the token there. **A token set
     on a descendant element caps the frame but does not move the sidebar,
     header content or toggle.** Set it on `:root`.
5. **The rail column is pinned to the sidebar width** (`--sl-sidebar-width`,
   18rem by default) at every width from 72rem. The reading pane takes the rest
   of the frame; its column is at most 720px.
6. **The geometry is guarded at five widths.** `tests/a11y/layout-geometry.spec.ts`
   measures bounding boxes at 1152, 1280, 1600, 1920 and 2560px, expanded and
   collapsed, with a 90rem and an 80% cap, with an invalid token, and
   right-to-left, to a tolerance of 1px. 20 of the 32 geometry tests failed
   against the previous layout. The file holds two more tests, added later,
   which check that the sidebar reveals the current page's entry.

## Consequences

Measured after the change, default frame, rail expanded:

| Measure | 1152px | 1280px | 1600px | 1920px | 2560px |
|---|---|---|---|---|---|
| Frame width | 1152 | 1280 | 1600 | 1920 | 2560 |
| Gap between sidebar and reading pane | 0 | 0 | 0 | 0 | 0 |
| Reading column width | 528 | 656 | 720 | 720 | 720 |
| Toggle centre, distance from the rail's inner edge | 0 | 0 | 0 | 0 | 0 |

- From 72rem (1152px) up, the reading column does not get narrower as the
  viewport grows (528, 656, 720, 720, 720px at the five measured widths). 720px
  is Starlight's content width.
- Expanded, the toggle is centred on the rail's inner edge. Collapsed, the rail
  is a 1px line at the frame's end edge and the toggle's end edge is on it.
- Under a cap, every one of these positions is relative to the frame. With
  `--dk-width-frame: 90rem` at 1920px the frame is 1440px wide from 240px to
  1680px, the sidebar starts at 240px and the rail ends at 1680px.
- A right-to-left page is the mirror image. Every offset uses logical
  properties.

### Trade-off below 84rem

Because the rail keeps its 288px at every desktop width, the reading column is
what is left of the frame between 72rem and 84rem. It is **528px at a 1152px
viewport (600px before) and 656px at 1280px (664px before)**. This is accepted:
a rail that keeps one width is what lets the toggle and the column share a
stable edge, and the earlier column at those widths was only wider because the
rail column was squeezed to 216px and 280px. The two measures are pinned in the
geometry guard, so a change in either direction is a deliberate one.

### A site that wants a capped frame

```css
:root { --dk-width-frame: 90rem; }
```

This is not identical to the previous layout. It is the layout the previous rule
was meant to produce: a 1440px frame, centred, with the sidebar, header content
and rail at its edges.

### Not verified against a real page

The rule that re-centres the reading column when the rail is collapsed on a page
with a rail but **no sidebar** has no real fixture. Starlight's `splash`
template, the only page shape without a sidebar, never has an outline, so no
page in the example has that combination. The rule is verified by
simulation only (the `data-has-sidebar` attribute removed from a page that has a
rail). If a later Starlight version or a custom layout produces such a page,
measure it.

## Alternatives considered

- **Keep a fixed 90rem cap and repair it** (fill the cap, move the sidebar and
  header). Rejected as the default: a documentation site on a wide monitor
  should not be forced into a centred band, and the value 90rem is a choice a
  site should make. The repaired cap is what the token gives a site that asks
  for it.
- **Measure and position in JavaScript.** Rejected: the layout would be wrong
  until the script ran, it would shift on load, and a page without JavaScript
  would keep the defect. The CSS solution has no layout shift (cumulative layout
  shift for the load is 0 in the guard).
- **An unregistered custom property with a fallback** (`var(--dk-width-frame,
  100%)`). Rejected: a fallback applies when the property is missing, not when
  it is invalid, so a typo would still break every rule that reads it.
