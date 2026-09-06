---
title: "ADR-0038: Decks are Markua-capable"
description: The four Markua content passes now act on slide content, composed before deckSplit; supersedes ADR-0030's 2026-08-30 amendment that made decks Markua-agnostic.
doc_status: active
updated: 2026-09-06
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0030-markua-preprocess-to-directive
  - architecture/markua
  - architecture/slide-decks
---

# ADR-0038: Decks are Markua-capable

## Status

**Accepted** — 2026-09-06. Introduced by the markua-decks mission (issue #47,
follow-up to PR #46). **Supersedes the Amendment (2026-08-30, post-markua-hardening)**
recorded in [ADR-0030](./0030-markua-preprocess-to-directive.md): that amendment's
decision (a) — "decks are Markua-agnostic" — no longer holds. ADR-0030's original
decision (the preprocess-to-`remark-directive` mechanism) and its Consequences/Risks
are untouched; only the deck-scope amendment is reversed. ADR-0030 is left intact and
cross-referenced, not edited.

## Context

ADR-0030's 2026-08-30 amendment resolved a real hazard the wrong way for the long term:
at the time, the three Markua remark passes ran *before* `deckSplit` while the deck
body was still flat, so a `{…}` attribute line could be spliced onto the wrong target
or an `{aside}`/`{blurb}` wrapper could swallow a `##`/`###` slide boundary. Rather than
solve the composition, that amendment made all five Markua passes (`markuaNormalise`,
`markuaAttributes`, `markuaCallouts`, `markuaFigure`, `markuaTocDemote`) no-op on a
`kind: Presentation` page, via a shared `isPresentationFile()` predicate and a
`guardDeck()` wrapper at the plugin registration arrays. It filed the real feature —
option (b), decks genuinely Markua-capable — as follow-up issue #47.

This ADR is that follow-up. It records the mechanism that makes the four Markua
*content* passes act on slide content without ever swallowing a slide boundary or
breaking the deck hero image, and why `markuaTocDemote` alone stays deck-guarded.

## Decision

Decks are Markua-capable (option b). The four content passes —
`markuaNormalise`, `markuaAttributes`, `markuaCallouts`, `markuaFigure` — are
registered bare (no `guardDeck` wrapper) and act on `kind: Presentation` slide
content exactly as they do on a docs page, subject to the seams below.
`markuaTocDemote` keeps its `guardDeck` wrapper (see Decision 4).

### 1. Markua passes still run before `deckSplit` — the registration order is unchanged

The three Markua remark passes keep running **before** `deckSplitIntegration`
(`config.ts`'s existing registration order; nothing moved). This was re-examined,
not merely inherited: at the point the Markua passes run, `root.children` is still
flat, so `markuaNormalise`'s marker scan and `markuaAttributes`' block-form recursion
(which does not descend into `deckSection`) both find their targets exactly as they do
off a deck. `deckSplit`'s boundary predicate keys on `node.type`/`node.depth` only, so
a heading that `markuaAttributes` decorated with `hProperties.id` is still detected as
a boundary — running Markua first does not blind `deckSplit`. Moving Markua *after*
`deckSplit` was rejected: it would require teaching `markuaNormalise` and
`markuaAttributes` to recurse into `deckSection` subtrees (per-section line streams,
blank-line reconstruction) for no boundary-safety benefit the pre-split ordering does
not already provide.

### 2. A wrapper cannot span a slide boundary — it closes early and warns

The one real hazard is an `{aside}`/`{blurb}` wrapper whose close would fall past a
slide boundary. `markuaNormalise`'s `consumeWrapper`, made deck-aware for wrappers
only, treats a slide-boundary placeholder (a heading of depth ≤ 3, or a
`thematicBreak` — `deckSplit`'s own boundary rule) as an implicit terminator: it closes
the wrapper *before* the boundary and emits a `file.message` warning —

> Markua {aside}/{blurb} cannot span a slide boundary; closed at the boundary.

The boundary node is left in `root.children`, so `deckSplit` still splits on it. This
is a warn, not a build failure, consistent with the toolkit's existing Markua/deckSplit
warning discipline. Line-prefix runs (`A>`…`W>`) cannot cross a boundary in the first
place — a heading or `thematicBreak` is always rendered as an opaque placeholder line
with a blank line around it, which already breaks a line-prefix run.

### 3. Callouts on a deck are forced to the self-contained `dk-callout` theme path

`markuaCallouts` gains awareness of `isPresentationFile()` and threads a `forceTheme`
flag into its emission decision, so a deck callout never takes the `mode: 'native'`
(Starlight aside) branch — it always emits the self-contained `dk-callout
dk-callout--{variant}` hast. This is forced, not incidental: `DeckLayout.astro` is a
standalone out-of-frame document that loads reveal core, the brand tokens, and
`dk-components.css`, but never Starlight's `starlight-aside` CSS — a native aside would
render on a slide with no styling at all. `dk-callout` is already self-contained and
styled by `dk-components.css`, which the deck already loads. The one genuinely empty
case this surfaces — a wrapper whose slide boundary lands immediately after its open
marker, leaving no body and no title — gets `aria-label="{Variant} callout"` so the
rendered `<aside>` never carries zero accessible content.

### 4. The figure pass wraps slide body images but never the synthesized hero

`deck-split.internal.ts` tags the synthesized title-slide hero image with
`data.hProperties['data-deck-hero']`, which mdast-util-to-hast surfaces as hast
`properties['data-deck-hero']`. `markuaFigure` drops its previous blanket
`isPresentationFile` early-return and instead, during its walk, skips only the `<img>`
carrying that tag (and its enclosing lone-image `<p>`); every other slide image is
wrapped as `dk-figure` with a populated `<img alt>` and a `<figcaption>`. The hero is
otherwise structurally identical to a plain body `![cap](src)` image — no class or
`hProperties` distinguishes it — so an explicit tag is the only reliable
discriminator. This re-solves the PR #33 hero-image conflict (wrapping the hero would
relocate its `alt` into a `<figcaption>` and empty `<img alt>`) by excluding exactly
the hero, rather than by skipping the pass on the whole page.

### 5. `markuaTocDemote` stays deck-guarded

`markuaTocDemote` keeps its `guardDeck()` wrapper; it is the only pass still gated by
`isPresentationFile()`. It exists to keep figure/aside headings out of a docs page's
on-page table of contents — a deck route has no on-page ToC, so the pass has nothing
to do on a deck. This is the retained predicate applied precisely to the one pass that
remains deck-agnostic, not a residual guard hole.

### Authoring constraint carried into the docs (not new behaviour, a discovered edge)

A `{…}` attribute-list line that targets a non-heading block must be followed by a
blank line before that target paragraph. Without the blank line, CommonMark's lazy
continuation merges the attribute line into the same paragraph as its target, so the
line is never recognised as a standalone attribute directive and is left as literal
prefix text instead of being applied. This is the same rule that already governs
attribute lists off a deck; the deck fixture surfaced it during authoring because a
slide's compact prose makes the omission easy to make.

A second, deck-specific edge follows directly from Decision 2: an `{…}` attribute
line meant to decorate a slide heading must sit **outside** any `{aside}`/`{blurb}`
wrapper. A wrapper that swallowed the heading would already be caught (and closed)
by the boundary-termination rule, but an attribute line placed *inside* the wrapper,
just before its close, decorates the wrapper's own trailing block rather than the
slide heading beyond it — the wrapper closes at the boundary, so its body never
reaches the heading to attach to. The fix is authoring discipline, not code: keep a
heading-targeting attribute line outside the wrapper entirely.

## Consequences

### Positive

- The four Markua content passes now render their intended constructs on a slide —
  asides/callouts, `{…}` attributes, and figures — closing the gap ADR-0030's
  amendment left open and issue #47 tracked.
- No slide boundary can be silently swallowed: the wrapper-termination rule (Decision
  2) is the one mechanism needed, because line-prefix runs and attribute targeting
  were already boundary-safe by construction (verified, not assumed).
- The PR #33 hero/`markuaFigure` conflict is resolved rather than avoided — the hero
  keeps its `alt`, and body images on the same page now get proper figures.
- Guard scope shrinks to exactly the one pass (`markuaTocDemote`) that has a genuine
  reason to stay deck-agnostic, so the guard predicate's presence in the codebase is
  self-documenting again.
- No new dependency; the mechanism reuses `isPresentationFile()`, `deckSplit`'s
  existing boundary rule, and the toolkit's established warn-don't-fail discipline.

### Negative

- The wrapper-boundary termination is a behavioural special case inside
  `markuaNormalise` (deck-aware only for wrappers) — a small, targeted increase in that
  module's branching, justified by being the one shape that can swallow a boundary.
- A deck callout can never use the native Starlight aside styling, even when one would
  otherwise qualify (Decision 3) — an intentional, permanent divergence from the
  docs-page callout routing, driven by what CSS `DeckLayout` loads.
- The blank-line attribute constraint (see above) is an authoring detail a deck author
  must know; it degrades to literal text rather than failing the build, but it is easy
  to trip over in slide-compact prose.

### Risks

- The wrapper-boundary termination and the hero tag must keep agreeing with
  `deckSplit`'s own boundary rule (`node.type`/`node.depth`) and its hero-synthesis
  shape respectively; a future change to either in `deck-split.internal.ts` without a
  matching update on the Markua side would reopen a boundary-swallow or hero-`alt`
  regression. `deck-guard.test.ts`'s membership and inertness assertions are the gate
  that catches a silent re-guard or an un-updated boundary predicate.
- `dk-callout` on a deck depends on `dk-components.css` continuing to be loaded by
  `DeckLayout.astro`; if that stylesheet is ever dropped from the deck route, forced
  theme callouts lose their styling with no separate warning.

## Alternatives considered

### Option A: Move the Markua passes after `deckSplit`

Rejected (research D1). `markuaNormalise` and `markuaAttributes` do not recurse into
`deckSection` subtrees; making them do so (per-section line streams, blank-line
reconstruction across section boundaries) is a real behavioural change to modules that
are otherwise deck-agnostic in shape, for no boundary-safety benefit the current,
pre-split ordering does not already provide.

### Option B: Keep decks Markua-agnostic (status quo, ADR-0030's amendment)

Rejected — this is exactly the decision issue #47 asked to reverse, once the
composition hazard (wrapper-boundary swallowing) had a concrete, provable fix instead
of being avoided by inertness.

### Option C: Hard-fail the build on a boundary-crossing wrapper

Rejected. Decks and Markua both warn rather than fail today (FR-008 precedent,
`deckSplit`'s own boundary warnings); a build-breaking failure here would be an
inconsistent, surprising exception to that discipline for one authoring mistake that
already has a well-defined, graceful resolution (close early at the boundary).

## References

- [ADR-0030](./0030-markua-preprocess-to-directive.md) — the original preprocess-to-
  `remark-directive` decision (unchanged) and its 2026-08-30 amendment (superseded by
  this record).
- [architecture/markua.md](../architecture/markua.md) — the Markua subset docs of
  record, updated alongside this ADR.
- [architecture/slide-decks.md](../architecture/slide-decks.md) — the slide-deck docs
  of record, updated alongside this ADR.
- Issue #47 ("Decks Markua-capable, option b"); PR #46 (post-markua-hardening, where
  the amendment this ADR supersedes was recorded).
- `kitty-specs/markua-decks-01M1TTMB/{spec.md,plan.md,research.md}` — FR-001–FR-010,
  research D1–D7.
