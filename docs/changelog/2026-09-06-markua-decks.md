---
title: "Decks are Markua-capable"
description: "Decks now render Markua asides, callouts, attributes, and figures on slides, superseding ADR-0030's deck-agnostic amendment (#47)."
doc_status: active
updated: 2026-09-06
type: Changelog
kind: Changelog
tags: [markua, slide-decks, accessibility, remark, rehype]
related:
  - architecture/markua
  - architecture/slide-decks
  - adr/0038-decks-markua-capable
  - adr/0030-markua-preprocess-to-directive
---

# 2026-09-06 — Decks are Markua-capable

Decks were made deliberately Markua-agnostic in the 2026-08-30 post-Markua
hardening pass, with genuine deck-Markua support filed as follow-up issue #47.
That follow-up is now delivered: the four Markua content passes act on slide
content, proven by a shipped fixture deck and a new accessibility gate on the
deck route.

## What changed

- **The four Markua content passes now act on slide content (#47).**
  `markuaNormalise`, `markuaAttributes`, `markuaCallouts`, and `markuaFigure`
  no longer no-op on a `kind: Presentation` page. A `W>` line-prefix aside, an
  `{aside}…{/aside}` wrapper, a `{…}` attribute list, and a Markua figure image
  all render their intended, accessible construct on the slide they were
  authored in. `markuaTocDemote` stays guarded — a deck route has no on-page
  table of contents for it to act on.
- **An `{aside}`/`{blurb}` wrapper cannot span a slide boundary.** The one real
  composition hazard — a wrapper whose close falls past a `##`/`###`/`---`
  slide boundary, which would otherwise merge two slides — is closed by
  terminating the wrapper at the boundary and emitting a build warning; the
  boundary is never consumed.
- **Callouts on a deck always render as the self-contained `dk-callout` theme
  path.** The out-of-frame deck route loads no `starlight-aside` CSS, so a
  native Starlight aside would render unstyled on a slide; a deck callout now
  always takes the theme-callout branch instead.
- **The deck's title-slide hero image is excluded from figure-wrapping, not
  the whole page.** Body slide images now wrap as accessible
  `figure > img[alt] + figcaption`; the synthesized hero image carries an
  internal tag that `markuaFigure` skips, so it keeps its populated `alt` and
  gains no caption. This re-solves the PR #33 hero/`markuaFigure` conflict
  that previously forced the pass to skip the whole page.
- **A published fixture and a new gate prove it.**
  `example/docs/presentations/markua-deck.md` exercises a `W>` aside, an
  `{aside}` wrapper, a `{#id}` attribute, and a body figure across a real
  deck; a new Playwright + axe spec asserts each construct renders with the
  right role and accessible name, no slide boundary is swallowed, and the
  deck is axe-clean in both colour schemes.

## Docs of record

[ADR-0038](../adr/0038-decks-markua-capable.md) records the decision and
supersedes the [ADR-0030](../adr/0030-markua-preprocess-to-directive.md)
2026-08-30 amendment that made decks Markua-agnostic; that amendment stays in
place as history, cross-referenced rather than deleted.
[architecture/markua.md](../architecture/markua.md) and
[architecture/slide-decks.md](../architecture/slide-decks.md) describe the
shipped behaviour and the wrapper-boundary/hero-exclusion seams.

## Scope

No dependency was added, upgraded, or removed. The off-deck Markua surface and
every non-presentation page are unchanged; a Markua-free deck keeps its exact
slide count and boundary structure. Closes #47.
