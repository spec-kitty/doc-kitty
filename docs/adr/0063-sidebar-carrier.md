---
title: "ADR-0063: Sidebar is the sixth carrier; the sidebar reveal runs right after the sidebar markup"
description: The Starlight components map grows from five carriers to six. The Sidebar carrier renders Starlight's sidebar and then the reveal script, so the reveal lands before paint.
doc_status: active
updated: 2026-10-19T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - adr/0044-header-carrier
  - architecture/collapsible-toc-rail
  - architecture/research/layout-guards-and-decisions
---

# ADR-0063: `Sidebar` is the sixth carrier; the sidebar reveal runs right after the sidebar markup

## Status

Accepted (2026-10-19).

Supersedes in part: the "exactly five carriers" clause of
[ADR-0044](./0044-header-carrier.md) (decisions 1 and 4), and with it the
carrier count that ADR-0044 amended in
[ADR-0013](./0013-m1-chrome-substrate-single-layer.md) (decision 3) and
[ADR-0015](./0015-m2-slot-resolution-and-components-map-seam.md) (decision 3).
This is the new record that ADR-0044 decision 4 requires for a further carrier.
Everything else in the three records stands.

## Context

The sidebar reveals the current page's entry: it scrolls the sidebar so the
entry is in view. The reveal was a `<head>` script, `REVEAL_CURRENT_SCRIPT` in
`src/lib/route-shaping.ts`, that waited for `DOMContentLoaded` on purpose, so
that it ran after Starlight's own scroll restore.

The sidebar markup ends about halfway through the HTML. On a first visit the
sidebar therefore painted at the top and jumped later. Measured on the example
build (issue #203):

| Scenario | Wrong position before the jump |
| --- | --- |
| Local server, no delay | about 60 ms |
| Last part of the HTML delayed 2 s | about 2 s |
| Module scripts delayed 2 s | about 4 s |

The layout-shift test could not see this. A scroll inside a scroll container is
not a layout shift.

Starlight 0.42 has no reveal of its own:

- Its `SidebarPersister` restores the scroll position only on in-session
  navigation, from an inline script right after the sidebar tree.
- Upstream closed a reveal pull request (withastro/starlight#2012) in favour of
  persistence.

Two placements could run the reveal before paint:

1. An inline script right after the sidebar markup. Only a `Sidebar` component
   override can put it there, and the carrier map was locked at five.
2. A `MutationObserver` in the head script that waits for the end of
   `sl-sidebar-state-persist`. No new carrier is needed.

The research note recommended the second. The owner chose the first.

## Decision

1. **`Sidebar` becomes the sixth carrier.** It renders Starlight's own
   `@astrojs/starlight/components/Sidebar.astro` unchanged, and then emits the
   reveal as one inline script.
2. **The reveal runs after Starlight's restore by markup order.** Starlight's
   `Sidebar` contains `SidebarPersister`, whose closing inline script restores
   the scroll position. Anything emitted after Starlight's `Sidebar` runs after
   that restore, while the HTML is still streaming.
3. **The head entry for the reveal script is removed.** It is not kept as a
   fallback: it would run a second time on `DOMContentLoaded`, and nothing in
   the new placement can fail in a way the fallback would fix. The re-reveal
   when the mobile menu opens stays.
4. **The `components` map holds exactly six carriers**: `Head`, `PageTitle`,
   `MarkdownContent`, `Footer`, `Header` and `Sidebar`. The invariant keeps its
   shape: a fixed set, owned by the toolkit, identical with or without a theme,
   and applied after the consumer's escape hatch.
5. **`Sidebar` hosts no `dk:` slot.** It exists to place the reveal. No further
   carrier is added without a new record.

## Consequences

### Positive

- The current entry is in view at first paint, on a first visit and in a new
  tab, in all three measured load scenarios.
- The guarantee holds once the sidebar markup has been parsed. A frame painted
  while the parser is still partway through the sidebar can show it at the top.
- The order is exact. It comes from the markup, so it makes no timing
  assumption.
- In-session navigation still restores the position Starlight saved.

### Negative

- The carrier lock in ADR-0013, ADR-0015 and ADR-0044 now reads "six".
- The sidebar markup is Starlight's plus one script. The carrier passes
  Starlight's props through, so a Starlight upgrade that changes the `Sidebar`
  props or renames `sl-sidebar-state-persist` must be re-checked. Both are on the
  upgrade tripwire in [Collapsible TOC rail](../architecture/collapsible-toc-rail.md#upgrade-tripwire).
- A consumer's own `Sidebar` override passed through `starlight.components` is
  now discarded, as overrides of the other five carriers are.
- The lock covers the `components` map that the toolkit passes to Starlight. It
  does not cover Starlight plugins: a plugin's `updateConfig({ components })`
  runs after the user config, so a plugin that overrides `Sidebar` replaces the
  carrier. That has been true of every carrier since ADR-0013. For `Sidebar` it
  means the reveal script no longer ships: before this record, the reveal was a
  `head` entry that a plugin could not remove. A plugin that overrides `Sidebar`
  must render the toolkit's carrier to keep the reveal. The carrier is exported
  as `@spec-kitty/doc-toolkit/components/Sidebar.astro`; see
  [consumer setup](../guides/consumer-setup.md#starlight-plugins-that-override-the-sidebar).
- The reveal needs JavaScript. Without it the sidebar stays scrolled to the top.

### Risks

- The reveal is measured at first paint, not through layout shift. The reveal
  half of `sidebar-frame-header-carrier-01M4T3CB#NFR-005` is replaced by
  `layout-guards-decisions-01M59CGE#NFR-005`: the sidebar's scroll position at
  first paint equals the revealed position within 1 px, in all three scenarios.
  `tests/a11y/sidebar-reveal.spec.ts` checks it.

## Alternatives considered

### Option 1c: an observer in the head script

The head script watches for the end of `sl-sidebar-state-persist` and reveals
then, with `DOMContentLoaded` as the fallback. It needs no new carrier and about
four lines, and a prototype landed the reveal before paint in all three
scenarios. Declined by the owner: it depends on Starlight's element name and on
when the observer fires, while the inline script depends on neither.

### Option 2: accept and document the jump

Rejected. The jump is visible on every first visit, and seconds long on a slow
link.

## References

- Issue #203.
- [Layout guards and layout decisions after Astro 7](../architecture/research/layout-guards-and-decisions.md#203-the-sidebar-reveal-jumps-on-slow-pages),
  the measurements and the options.
- [ADR-0044](./0044-header-carrier.md), the fifth carrier and the carrier lock.
