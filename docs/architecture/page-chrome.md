---
title: Page chrome
description: How the toolkit detects the surfaces a site serves, renders its own sidebar only on opt-in, places a hub's blocks after its cards, and shares one disclosure control.
doc_status: active
updated: 2026-11-06T00:00:00Z
type: Architecture
kind: Explanation
authors:
  - process:doc-kitty
tags: [chrome, sidebar, footer, disclosure, served-surfaces]
related:
  - guides/consumer-setup
  - migrations/page-chrome-defaults
  - architecture/collapsible-toc-rail
  - architecture/theming
  - adr/0075-sidebar-carrier-renders-own-sublist-on-opt-in
  - adr/0076-carrier-places-hub-blocks-after-layout
  - adr/0077-shared-disclosure-control
---

# Page chrome

The page chrome is the sidebar, the metadata blocks, the footer and the links
from a page to its other formats. Four parts of it have a design worth
knowing. This page explains each one and links the decision behind it. For the
options a site sets, read
[Page chrome](../guides/consumer-setup.md#page-chrome) in the consumer guide.

## Served-surface detection

The footer, the `<head>` and the agent index all link to machine-readable
surfaces, such as `llms.txt` and `rss.xml`. A link to a surface the site doesn't
serve is a 404, so each link needs to know what exists.

The `served-surfaces` integration answers that without any declaration. At
`astro:routes:resolved` it reads the site's route patterns and checks them
against a fixed list of standard paths. At `astro:config:done` it records
whether `site` is set, because the sitemap is written only then. It publishes
the result in one internal environment value, `DK_SERVED_SURFACES`, and
`servedSurfaces()` reads it. A redirect at a surface's path doesn't count as
serving it.

Three consumers read the same value: the footer group, the head alternates and
the agent index's `_links`. They can't disagree, because none of them keeps its
own list.

The limit is the list. A route at a non-standard path isn't detected, so it
isn't linked. The agent index has a `links` override for that case.

## The conditional sidebar renderer

The `Sidebar` carrier normally renders Starlight's sidebar as it is. Two
features can't come through route data: a group label that is a link, and an
icon on a group. In Starlight 0.42.6 a group's label is escaped text, and only
a link has `attrs`.

So a site that opts in, with `sidebar.titleIsIndex` or any authored icon, gets
a DocKitty sublist. `SidebarSublist.astro` is a copy of Starlight's component
with the same markup and the same layered styles, plus the two extras. The
copy renders inside Starlight's own persister, so the restore points and scroll
restore keep working.

The manifest picks the renderer. `virtual:doc-kitty/manifest` imports the custom
body only on an opted-in site. Astro attaches CSS by module graph, not by what
renders, so an import in the carrier would put the copy's CSS on every site. A
site that doesn't opt in gets the same bytes and the same CSS as before.

The copy is a cost: it follows Starlight's internals. The parity test
`sidebar-renderer-parity.test.ts` guards it. It builds the fixture stock and with
`titleIsIndex: true` on a tree with no index pages, and requires the same
sidebar bytes. A Starlight upgrade that changes the markup turns it red.

The test compares markup only. It can't see a change to the copy's styles, so
compare `SidebarSublist.astro` with Starlight's original by hand on each
upgrade. [ADR-0075](../adr/0075-sidebar-carrier-renders-own-sublist-on-opt-in.md)
has the decision and its alternatives.

## Hub placement

A hub page lists its children as cards. The `Hub` layout renders them after the
default slot. The metadata blocks used to sit in that slot, so a reader saw the
audience, the body, the blocks and only then the cards.

For `kind: Hub`, the `MarkdownContent` carrier now places the blocks directly
after the layout. The order is audience, body, cards, then blocks. Every other
kind keeps its blocks inside the layout.

The carrier does this by choosing which component fills each of four positions,
inside and outside the layout, for the related and the external-reference
blocks. It doesn't wrap them in a conditional. The outside positions touch
`</Layout>` with no whitespace, because Astro emits a literal space for bare
positions on separate lines, and that would change the bytes of every other
page.

No layout gains a contract, so a theme's own hub layout gets the order too. The
cost is that the blocks sit outside a hub layout's wrapper element.
[ADR-0076](../adr/0076-carrier-places-hub-blocks-after-layout.md) has the
decision.

## The disclosure upgrade

The collapsed TOC rail, the collapsed metadata blocks and the collapsed sidebar
groups share one toggle, in `src/lib/disclosure/`.

The blocks and the groups render as a native `<details>` element, so they work
with scripts off, in the browser's find-in-page and with Starlight's sidebar
persister. After load, `upgrade-details.ts` inserts a button before the
`details` element and hides the summary. The button's chevron and ARIA state
come from `toggle.ts`.

The toggle holds no state. The caller passes an adapter with `isCollapsed` and
`setCollapsed`. The rail passes one over its existing preference. A block or a
group passes none, so `details.open` is the only state and nothing is stored.

A group needs one extra step. Starlight's persister records a toggle only when a
click lands in a `summary`, so a group's button toggles by clicking its
summary. Where the upgrade fails, the summary stays visible and the element is
still native.

The control's styles are in one global sheet. Scoped CSS doesn't reach an
element a script creates, and the upgrade must not move the page.
[ADR-0077](../adr/0077-shared-disclosure-control.md) has the decision. The
rail's own behaviour is in [Collapsible TOC rail](./collapsible-toc-rail.md).
