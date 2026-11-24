---
title: "ADR-0084: A sidebar child cap, set per hub, section or site"
description: A hub with more listed pages than its cap shows its overview link and one entry in the sidebar. Two new settings, a frontmatter key and a package export carry it.
doc_status: active
updated: 2026-11-23T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - adr/0063-sidebar-carrier
  - adr/0009-finalize-metadata-contract
  - adr/0069-configurable-adr-id-and-frontmatter-status
  - plans/features/large-hubs
  - architecture/research/missions-and-ops
  - guides/sidebar-child-cap
---

# ADR-0084: A sidebar child cap, set per hub, section or site

## Status

Proposed (2026-11-23), with the first slice of [Large hubs](../plans/features/large-hubs.md)
(#341). It follows the design in
[Missions and Ops as generated pages](../architecture/research/missions-and-ops.md#the-sidebar-child-cap).

## Context

Starlight lists every page of a folder in every page's sidebar. Generated
sections (missions, Ops, packs, Gherkin features) can hold hundreds of pages.
Each built page then carries hundreds of sidebar links. On a 1,000-page
fixture the median page is 165 KiB uncapped and 23 KiB capped.

The toolkit already reshapes the generated sidebar in one place, the
route-shaping middleware (`shapeSidebar`). The `Sidebar` carrier set is locked
by [ADR-0063](./0063-sidebar-carrier.md). The hub page (`kind: Hub`) already
lists a folder's pages, through `selectHubChildren` and the ADR card
composition of [ADR-0069](./0069-configurable-adr-id-and-frontmatter-status.md).

## Decision

1. **A hub is a folder whose published index page has `kind: Hub`.** Only that
   page lists the folder's pages. A folder with another index kind is never
   capped, because a capped entry there would lead to no listing.
2. **A hub over its cap shows two sidebar links**: its overview link and one
   capped entry ("{count} pages") that links to the hub. The entry is current
   on every page below the hub. A hub at or under its cap renders exactly as
   before.
3. **The count and the order are the hub page's.** One composition,
   `composeHubChildren` in `hub-children.mjs`, serves the hub page and the cap:
   ADR cards first by id, then the other pages. prev/next on a page one level
   below the hub follow that order.
4. **The cap resolves most specific first:**
   - the hub index's frontmatter `sidebar_child_cap`;
   - `sidebar.childCap` on the section in `sections.yaml` or the charter's
     `sections.entries`;
   - `sidebar.childCap` in `defineDocKittyIntegrations`;
   - then 50.

   A value that is not a positive whole number stops the build.
5. **The cap lives in route shaping. No carrier is added** (ADR-0063 stands).
   The build computes each capped hub's cap, count and children
   (`HubCap`) and serves them in `virtual:doc-kitty/route-shaping`.
6. **prev/next survive a later middleware.** When a capped hub exists, the
   route-shaping middleware hands `locals.dkHubOrder` to the OpenAPI follow-up
   middleware. The OpenAPI renderer rebuilds prev/next from the shaped sidebar,
   and the follow-up puts the hub order back.
7. **The pure API is a package export**, `@spec-kitty/doc-toolkit/child-cap`:
   `resolveChildCap`, `cappedChildHidden` (the hint a page generator uses to
   write `sidebar: { hidden: true }`), `resolveCappedLabel`, `isChildCap` and
   the `HubCap` types. The paged hub listing (#342) builds on `HubCap`.

## Consequences

### Positive

- A page's sidebar holds a bounded number of links, whatever the hub size.
- The build of a large hub takes about a quarter less time.
- A site with no hub over its cap builds byte-identical pages.

### Negative

- The capped entry is a Starlight link with a property, `dkCappedHub`, that is
  not in Starlight's type. A consumer route middleware that rebuilds sidebar
  links without spreading them drops it, and the entry is then read as a page.
- Child hrefs are built from the hub index's href. That assumes Starlight's
  directory-format routes. With another format the cap leaves the entry as it
  is.
- A page generator that hides pages must count and resolve the cap as the
  build does. A miscount hides pages under a hub the build does not cap.

### Risks

- Multilingual sites: the hub data comes from each language's own files. A
  language whose hub index is not translated is not capped. Locale-aware caps
  are a follow-up.
- `HubCap` is emitted only for hubs over their cap, and only when the toolkit
  shapes the sidebar. The paged listing (#342) needs the listing for every
  hub, including on a site with its own sidebar. It will widen the data, not
  change the shape of `HubCap`.

## Alternatives considered

### Cap in a `Sidebar` carrier

Rejected. It needs a seventh carrier (ADR-0063), and prev/next would still walk
every page.

### Only the `sidebar.hidden` hint

Rejected as the main mechanism. Every author and generator would have to mark
pages, and authored sections would get no cap. It stays as an optional hint.

### Cap any folder with an index page

Rejected. A folder whose index is not a hub page lists nothing. Its pages would
lose their sidebar links and have no listing to replace them.

## References

- Issue #341 and epic #340.
- [Cap large sidebar groups](../guides/sidebar-child-cap.md), the configuration guide.
