---
title: "Deck & layout polish — legible deck, fitted title slide, wide-screen cap"
description: "Closes #65/#66/#67 — the showcase deck follows light/dark and fits its stage with a vertical-stack affordance, wide viewports get a capped/centered reading frame, and the Persona layout renders one clean identity card."
doc_status: active
updated: 2026-09-05
type: Changelog
kind: Changelog
tags: [deck, layout, accessibility, css]
related:
  - context/convention
---

# 2026-09-05 — Deck & layout polish: legible deck, fitted title slide, wide-screen cap

Four visible-quality defects from the 2026-09-04 docsite review, remediated together
and re-verified with a Playwright pixel pass at 1600/1920/2560px.

## What changed

- **The showcase deck now follows light/dark, and its demo slide is legible in both
  (#65).** Before: the out-of-frame deck had no theme mechanism at all, so its forced
  navy demo slide rendered near-black text at ~1.05:1 contrast for every viewer,
  regardless of their device's colour-scheme preference — a WCAG 1.4.3 blocker. After:
  the deck's own stylesheet follows `prefers-color-scheme`, and the demo slide's
  background is a theme-aware surface token instead of a hard-coded colour, so its
  text stays legible whichever scheme the viewer's device prefers. In-frame
  documentation pages are unaffected — the deck's theme-following is isolated to the
  deck route and never overrides a reader's explicit Light/Dark/Auto choice in the
  docs chrome.
- **The deck title slide now fits the stage, and vertical stacks show an up/down
  affordance (#66).** Before: the synthesized title slide measured ~817px of content
  on reveal's ~700px logical stage, clipping the first diagram off the bottom, and a
  reader landing on a slide that was part of a vertical stack had no visual cue that
  `↓`/`↑` navigation existed. After: the title slide shows only the heading and hero
  text, with the former overflow content moved to its own following slide; and a
  labelled, keyboard-reachable up/down control pair appears whenever the active slide
  has a vertical route, and stays hidden otherwise — matching the existing left/right
  control pattern.
- **Wide screens now cap and center the reading frame (#67).** Before: on wide
  monitors, the ~720px reading column stayed pinned against the left sidebar while the
  frame around it grew unbounded (to 1312/1632/2272px at 1600/1920/2560px), leaving a
  large, one-sided empty gutter on the right. After: Starlight's own `.main-frame`
  element (which wraps the sidebar and content together) is capped at 90rem and
  centered above the 100rem breakpoint, so the sidebar-plus-content band sits in the
  middle of the viewport with even margins on both sides. Below the breakpoint the
  layout is byte-unchanged.
- **The stakeholder-profile (Persona) layout renders one clean identity card (scope
  addition).** Before: a Persona-kind page rendered a duplicated, visibly broken
  identity block. After: it renders as a single, correctly composed identity card.

## Why it matters

None of these defects blocked publishing, but each one is visible to a reader on
first contact — an illegible slide, a clipped title slide with no navigation cue, a
reading column marooned in empty space on a wide monitor, or a broken profile card.
Fixing all four together closes out the current round of docsite-review findings. No
dependency was added, upgraded, or removed.
