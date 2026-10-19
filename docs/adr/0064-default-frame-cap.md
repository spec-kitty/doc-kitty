---
title: "ADR-0064: The page frame is capped at 120rem by default"
description: --dk-width-frame now defaults to 120rem, keeping wide-screen navigation close to the text; one line restores full width. Supersedes ADR-0045 decision 1 and its 100% default.
doc_status: active
updated: 2026-10-19T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0045-frame-width-token
  - adr/0053-reading-width
  - architecture/collapsible-toc-rail
  - architecture/theming
  - guides/consumer-setup
  - architecture/research/layout-guards-and-decisions
---

# ADR-0064: The page frame is capped at 120rem by default

## Status

Accepted (2026-10-19).

Supersedes decision 1 of [ADR-0045](./0045-frame-width-token.md), "the frame is
full width by default", and the token default of `100%` in its decisions 2
and 3. ADR-0045's other decisions stand: the token, its registration, the
sidebar, header content and rail that follow a capped frame, and the pinned rail
width of decision 5. The 720 px column figure in decision 5 was already replaced
by [ADR-0053](./0053-reading-width.md), and this record does not restore it.

## Context

[ADR-0045](./0045-frame-width-token.md) made full width the default and the cap
something a site opts into. It also recorded that a 90rem default was rejected.
Since then [ADR-0053](./0053-reading-width.md) widened the reading column to
60rem, and wide screens were measured again (issue #205).

At 2560 px, uncapped, there are 512 px of empty space on each side of the column
on a rail page, and 656 px on a page without a rail. The cost is the eye and
pointer travel between the navigation and the text.

Measured at 2560 px, rail expanded, all values in CSS pixels:

| Cap | Margin each side, rail page | Margin each side, no-rail page | Gutter outside the frame, each side |
| --- | --- | --- | --- |
| None | 512 | 656 | 0 |
| 90rem | 24 | 96 | 560 |
| 100rem | 32 | 176 | 480 |
| 120rem | 192 | 336 | 320 |

The research note recommended documenting 120rem as a recommended cap and leaving
the default alone. The owner chose to ship it as the default in 0.5.0.

## Decision

1. **`--dk-width-frame` defaults to `120rem`.** The token default scales with
   the root font size. An invalid value falls back to the `@property`
   registration's initial value, `1920px`, which is 120rem at the default 16px
   root. The initial value cannot be `120rem`: a registered initial value must
   not depend on the root font size, and Chromium drops a registration that
   uses `rem`.
2. **A site keeps full width with one line:**

   ```css
   :root { --dk-width-frame: 100%; }
   ```

3. **ADR-0045 decision 1 is superseded, and so is the `100%` default value
   stated in its decisions 2 and 3.** Everything else in ADR-0045 stands: the
   token, its registration, and the sidebar, the header content and the rail
   following the capped frame, as they follow any cap a site sets.

### Why 120rem

- It leaves every layout at 1920 px and narrower unchanged: at 1920 px the
  frame is 1920 px, the full viewport.
- At 2560 px the margin on a rail page drops from 512 px to 192 px. A 90rem or
  100rem cap would leave only 24 px or 32 px beside the column, which is too
  tight.
- It does not change the column shift between rail and no-rail pages, which
  this release accepts (issue #204): 0 px at a 1280 px frame, 72 px at 1440 px,
  and 144 px from 1600 px up, whether the frame is uncapped or capped at
  120rem.

## Consequences

### Positive

- On screens wider than 1920 px the navigation and the text stay close
  together.
- Narrower screens see no change. Column x and width at 1920 px and below equal
  the values before this record within 0.5 px.

### Negative

- It is a breaking visual change for every consumer whose readers have a
  viewport wider than 1920 px. It ships in a 0.x minor release, 0.5.0, with a
  changelog migration line that gives the opt-out above.
- The 2560 px geometry expectations move. The 1152 to 1920 px expectations do
  not.

### Risks

- A site that already sets its own cap is unaffected, but a site that relied on
  the full-width default without setting the token changes on upgrade. The
  changelog line is the mitigation.
- ADR-0045 keeps its status, Accepted. This record carries the supersession, as
  ADR records are not edited after acceptance.

## Alternatives considered

### Option 1: recommend 120rem, keep full width as the default

The research note's recommendation. Not chosen: the owner chose to ship the cap as
the default, so a site gets it without opting in. The research found no
new fact that forced the change, so this is a choice of default and not a fix. At
0.x a minor release can carry it.

### A 90rem or 100rem default

Rejected. A 90rem or 100rem cap leaves 24 px or 32 px beside the column on a
rail page at 2560 px, too tight a margin.

### Option 3: leave it

Rejected. It keeps 512 px of empty space on each side of the column at 2560 px.

## References

- Issue #205.
- [Layout guards and layout decisions after Astro 7](../architecture/research/layout-guards-and-decisions.md#205-wide-screen-margins-and-a-recommended-page-width-cap),
  the measurements and the options.
- [Cap the page width](../guides/consumer-setup.md#cap-the-page-width), the
  consumer reference.
- [ADR-0045](./0045-frame-width-token.md), the frame-width token.
