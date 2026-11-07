---
title: "ADR-0075: The Sidebar carrier renders its own sublist on opt-in"
description: On a site that opts in to title-as-index or sidebar icons, the Sidebar carrier renders its own sublist. Every other site still gets Starlight's sidebar unchanged.
doc_status: active
updated: 2026-11-06T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0063-sidebar-carrier
  - adr/0077-shared-disclosure-control
---

# ADR-0075: The `Sidebar` carrier renders its own sublist on opt-in

## Status

Accepted (2026-11-06).

Supersedes in part: decision 1 of
[ADR-0063](./0063-sidebar-carrier.md), for sites that opt
in. Its decisions 2 to 5 stand, and the carrier count stays at six. ADR-0063 stays as
written.

## Context

ADR-0063 decision 1 has the carrier render Starlight's sidebar unchanged, and decision
5 says it hosts no slot. Mission `page-chrome` adds two things a site can ask for: a
group label that is the link to its index page (title-as-index), and sidebar icons.

Neither can arrive through route data. In Starlight 0.42.6 a group's label is escaped
text, and a group has no `attrs`, so a label cannot become a link and a group cannot
carry an icon.

## Decision

1. **On opt-in, the carrier renders a DocKitty sublist inside Starlight's persister.**
   `CustomSidebarBody.astro` has the structure of Starlight's `Sidebar.astro`:
   `SidebarPersister` around `SidebarSublist.astro`, then `MobileMenuFooter`.
   `SidebarSublist.astro` is a copy of Starlight's, same markup and same
   `@layer starlight.core` styles, plus the two extras, each off unless its data is
   there.
2. **Otherwise, the carrier renders Starlight's sidebar.** A site with no opt-in gets
   the same bytes and the same CSS as before.
3. **The manifest decides.** `virtual:doc-kitty/manifest` imports the custom body only
   on a site that opted in, and the carrier renders `CustomSidebarBody ?? Default`. An
   import in the carrier would put the body's scoped CSS in every site's module graph,
   since Astro attaches CSS by module graph and not by what renders.
4. **The custom body is not a Starlight override.** It is a plain component the carrier
   renders, so the carrier count stays at six.
5. **`details` stays the state of a title-as-index group.** Its chevron is a
   `<summary>`, which the shared disclosure control
   ([ADR-0077](./0077-shared-disclosure-control.md)) upgrades to a button that toggles
   through `summary.click()`, because Starlight's persister records a toggle only from
   a click in a `summary`. The upgrade's script loads outside the persister.
6. **The index link stays in the route data.** The sublist renders it as the label and
   skips it in the list, so pagination, which flattens the sidebar, keeps it.

## Consequences

### Positive

- A site with no opt-in cannot be affected: the build goldens of the frozen fixture
  hold it to the pre-mission sidebar and CSS.
- Starlight's persister, restore points and scroll restore keep working, because they
  are still Starlight's.

### Negative

- There is a copied component to maintain, coupled to Starlight's internals.
  `sidebar-renderer-parity.test.ts` guards it: it builds the fixture stock and with
  `titleIsIndex: true`, with no index pages, and requires the same sidebar bytes, so a
  Starlight upgrade that changes the markup goes red.
- **The parity test does not compare the copied CSS.** Only markup is compared, because
  the copy's `<style>` is the original's, and scoped CSS has different
  selectors in each build. A Starlight upgrade that changes only those styles passes
  unnoticed: compare `SidebarSublist.astro` with the original by hand on each upgrade.
- An opted-in site ships both sublists' CSS, as Starlight's own stays in the module
  graph of the carrier.

### Neutral

- A consumer-written sidebar is not shaped, so it has no index markers: with
  `titleIsIndex` on, each of its groups renders with the plain toggle.

## Alternatives considered

- **Rewriting the sidebar's HTML in middleware.** It leaves Starlight's component in
  place, but ties a text transform to the same internals, with no build-time failure
  when they move, and costs a parse on every page.
- **`attrs` with CSS masks for icons.** No copy needed, but `attrs` exists only on
  links, so groups could have neither an icon nor a linked label.
