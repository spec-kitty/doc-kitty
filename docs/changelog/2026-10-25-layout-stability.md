---
title: Layout stability on load and on wide screens
description: "The rail holds still on a slow first paint, the collapsed column clears the toggle under any frame cap, the sidebar tint reaches the screen edge above the frame cap, and the load-shift test measures the enhancement only."
doc_status: active
updated: 2026-10-25T00:00:00Z
type: Changelog
kind: Changelog
authors:
  - human:stijn
tags: [layout, rail, frame, sidebar, testing]
related:
  - adr/0066-sidebar-tint-bleeds-past-the-frame
  - adr/0064-default-frame-cap
  - architecture/collapsible-toc-rail
  - guides/consumer-setup
---

# 2026-10-25 — Layout stability on load and on wide screens

Four follow-ups to the layout guards that came with the 120rem default frame.
The design decision is recorded in
[ADR-0066](../adr/0066-sidebar-tint-bleeds-past-the-frame.md).

- **The rail holds still on a slow first paint
  ([#223](https://github.com/spec-kitty/doc-kitty/issues/223)).** Starlight
  renders the rail before the reading pane and moves it into place with flex
  order. A paint that came before the pane was parsed drew the rail beside the
  left sidebar, and it then jumped across the page (a layout shift of about
  0.25). The rail now sits at the end of its row whatever has been parsed,
  expanded and collapsed. A geometry test serves the page cut off before the
  reading pane and checks that the rail is already in place.
- **The collapsed column clears the toggle under any frame cap
  ([#220](https://github.com/spec-kitty/doc-kitty/issues/220)).** The padding
  that keeps the collapsed column 4px clear of the toggle was keyed to the
  viewport width, so a frame capped between 72rem and 84rem on a wider screen
  still ran 7px under the toggle. It is now worked out from the width of the row
  the pane and rail share. A sweep of every 8px from 1152 to 2560px found the
  default layout unchanged.
- **The sidebar tint reaches the screen edge above the frame cap
  ([#224](https://github.com/spec-kitty/doc-kitty/issues/224)).** On screens
  wider than 1920px the sidebar panel used to start at the frame edge, a tinted
  block under a header that runs edge to edge. Its tint now runs to the
  viewport's start edge, like the header bar, and its links stay on the frame.
  See [Consumer setup](../guides/consumer-setup.md).
- **The load-shift test measures the enhancement
  ([#222](https://github.com/spec-kitty/doc-kitty/issues/222)).** The test
  counted shifts in Starlight's own markup while the page was still parsing, and
  failed in about a quarter of runs under parallel load. It now paints the whole
  page first, then lets the enhancement run, and requires exactly 0 shift. A
  positive control checks that a 20px move by the enhancement is caught. It was
  stable over 300 runs at 4 and at 8 parallel workers.
