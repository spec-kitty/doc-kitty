---
title: Large hubs
description: "A sidebar child cap and paged, filterable hub listings, so a section with hundreds of generated children stays usable and cheap to build."
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: Mission, Op, pack and Gherkin sections can each hold hundreds of children. Today every child lands in every page's sidebar and on its hub.
tags: [sidebar, hubs, paging, scale, accessibility]
related:
  - architecture/research/missions-and-ops
  - plans/features/mission-status-portal
  - plans/features/packs
---

# Large hubs

When a hub has more children than a threshold, doc-kitty leaves them out of the
sidebar and lists them on the hub page instead. The listing is server-rendered and
paged, and with scripts it gains "load more", sorting and filters. Nothing about it
is specific to missions: packs, Gherkin features and any authored section with a
long tail benefit too.

Scope: Core.

Design: [Missions and Ops as generated pages](../../architecture/research/missions-and-ops.md),
sections "The sidebar child cap" and "Listing a large hub".

## Goals

- A page's sidebar holds a bounded number of links, whatever the section size.
- Every child stays reachable without scripts, from the hub's paged listing.
- Agents and crawlers still reach every child through the sitemap and the agent
  API.
- A hub under the cap renders exactly as it does today.

## Non-goals

- Infinite scroll that loads on its own. Loading is always an explicit action.
- A second search index. Filters ride on the existing one.

## Slices

1. **Sidebar child cap** (#341). `sidebar.childCap` in site config (default 50), per
   section in `sections.yaml`, and per hub in frontmatter (`sidebar_child_cap`),
   resolved most specific first. Enforced in `shapeSidebar`. A capped group keeps
   its index link and one "N items" entry to the hub, marked current on a capped
   child. Prev/next follow the hub order. A `sidebar.hidden` hint for generated
   producers. *Done when*, on an example hub with 200 fixture children, the
   sidebar links per page in the built HTML are at most the cap plus two; a capped
   child shows the "N items" entry as current; and the output for an uncapped
   hub is byte-identical to today's.
2. **Paged hub listing** (#342). The first page of children server-rendered on the hub,
   then `/<hub>/page/N/` pages in the Starlight frame with a labelled pagination
   `nav`. Paged URLs are self-canonical and out of the sitemap; every child stays
   in it. *Done when* every fixture child is reachable from the paged listing with
   scripts off, the pagination passes axe, and the sitemap holds every child and
   no paged URL.
3. **Progressive listing** (#343). A build-time `index.json` per large hub (chunked), a
   "Load more" button with an `aria-live` count, sort and filter controls, and
   query-string state. A `hub_layout: cards` presentation over the same data (core
   #6941). *Done when* the controls pass axe and keyboard checks, a filtered URL
   reproduces its view on reload, and the index lists every child.
4. **Agent and feed modes** (#344). An `llms: summary` mode for `feeds`, so `llms.txt`
   lists a large hub and its `index.json` instead of every child. *Done when* the
   built `llms.txt` for the fixture hub has one entry plus the index, and the
   agent API still lists every child.

Each slice ships Vitest tests, an example fixture asserted on built output, a
configuration page, and a changelog fragment. Slice 1 also records its build-time
and HTML-size measurements on a 1,000-child fixture.

Order: 1, then 2, then 3 and 4 in either order. Slice 1 can ship alone.

Tracked as epic #340.
