---
title: Cap large sidebar groups
description: Keep the sidebar short when a hub has hundreds of pages. Set the sidebar child cap per site, section or hub, and label the entry that stands for the pages.
doc_status: active
updated: 2026-11-23T00:00:00Z
type: Guide
kind: How-To
tags: [sidebar, hubs, scale, configuration, consumer]
related:
  - guides/consumer-setup
  - guides/authoring
  - plans/features/large-hubs
---

# Cap large sidebar groups

**Audience.** A site owner whose docs tree has a folder with many pages, or the
engineer who writes a tool that generates such a folder.

Starlight lists every page of a folder in every page's sidebar. With a few
pages that is what a reader wants. With hundreds of pages, each page of the site
carries hundreds of sidebar links, and the build renders all of them again for
every page.

The sidebar child cap bounds that. A hub (a folder with an index page) that has
more pages than its cap shows two sidebar links: its overview link and one entry,
"835 pages", that leads to the hub. The hub page lists every page.

## What a reader sees

- On any page of the site, a capped hub's group holds the overview link and the
  capped entry.
- On a page inside the hub, the capped entry is marked as the current page, and
  its group is open, so the reader still sees where they are.
- On the hub page, the overview link is current.
- The previous and next links on a page inside the hub follow the order the hub
  lists its pages in.

Only the sidebar changes. Every page is still built, listed on its hub, in the
sitemap and the agent API, and found by search.

A hub's pages are counted as the hub lists them: the pages and sub-folders one
level down, without drafts. A sub-folder counts as one page, and its own pages
leave the sidebar with it.

A sub-folder needs an index page to be listed. The hub does not list a sub-folder
without one, so once the hub is capped, the pages in that sub-folder are in
neither the sidebar nor the hub listing. Give every sub-folder of a large hub an
index page, or link its pages from the hub's text.

The cap needs the hub's index page in the sidebar, because the capped entry links
to it. A hub whose index page is hidden from the sidebar (`sidebar: { hidden: true }`
on the index) is not capped.

## Set the cap

The cap is a positive whole number. The default is 50. The most specific setting
wins.

1. On a hub, in its index page's frontmatter:

   ```yaml
   sidebar_child_cap: 10
   ```

2. On a section, in `docs/_meta/sections.yaml` (or the charter's
   `sections.entries`). It applies to every hub in the section:

   ```yaml
     - id: adr
       label: Decision Records
       order: 30
       sidebar:
         childCap: 100
   ```

3. For the whole site, in `astro.config.mjs`:

   ```ts
   defineDocKittyIntegrations({ title: 'Docs', sidebar: { childCap: 30 } });
   ```

A value that is not a positive whole number stops the build, with a message that
names the setting and where it was set. To keep a large hub uncapped, set its cap
above its page count.

A sidebar you write yourself, through `sidebar: [...]` or `starlight.sidebar`,
is never capped.

## Label the capped entry

The entry reads "{count} pages", with `{count}` replaced by the number of pages.
It is a translatable UI string, `dockitty.sidebar.cappedEntry`, so each language
of a multilingual site can show its own words through Starlight's `i18n` files.
To set one label for every language, pass it in the site config. It wins over
the translation:

```ts
sidebar: { childCap: 30, cappedLabel: 'All {count} missions' },
```

## Hide capped pages in a page generator

A tool that writes hundreds of pages can skip work: when a page's hub is over its
cap, write the page with `sidebar: { hidden: true }`, and Starlight never builds
the sidebar entries the cap would drop. The toolkit says when:

```ts
import { cappedChildHidden, resolveChildCap } from '@spec-kitty/doc-toolkit/child-cap';

const cap = resolveChildCap({ hub: hubFrontmatterCap, section: sectionCap, site: siteCap });
const hidden = cappedChildHidden(pages.length, cap);
```

The hint is optional. The count, the current entry and the previous and next
links come from the build's own reading of the docs tree, so they are the same
with or without it.

## What it costs

Measured on a fixture with one hub of 1,000 pages (1,015 pages in all), three
builds each:

| | Uncapped | Capped (cap 50) |
| --- | --- | --- |
| Median page HTML | 168.9 KB | 24.0 KB |
| All pages | 163.7 MiB | 23.5 MiB |
| Median build time | 20.0 s | 15.1 s |

The numbers and the fixture are in [Large hubs](../plans/features/large-hubs.md).
