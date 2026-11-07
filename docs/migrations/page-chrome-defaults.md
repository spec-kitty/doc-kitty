---
title: Page chrome defaults
description: What changes in your built site with no config change after the page-chrome release, and the two settings that restore the old sidebar and metadata blocks.
doc_status: active
updated: 2026-11-06T00:00:00Z
type: Migration
kind: How-To
authors:
  - process:doc-kitty
tags: [migration, sidebar, metadata-blocks, footer, atom]
related:
  - guides/consumer-setup
  - architecture/page-chrome
---

# Page chrome defaults

This release changes how a page looks and what a build writes, even if you
change nothing in `astro.config.mjs`. This page lists each change, what you see,
and the setting that undoes it. The options are described in
[Page chrome](../guides/consumer-setup.md#page-chrome).

Two settings bring back the old sidebar and the old metadata blocks:

```ts
defineDocKittyIntegrations({
  // ...
  sidebar: { collapsed: false },
  metadataBlocks: { collapsed: false },
});
```

`sidebar: { collapsed: false }` gives the same sidebar HTML as before, byte for
byte. `metadataBlocks: { collapsed: false }` shows the blocks open, but the
markup is still the new one. Each block is now a `details` element with a
control, so the HTML differs from the old release even though the blocks look
open.

## What changes

| Change | What you see | Undo it with |
|--------|--------------|--------------|
| Sidebar groups start closed | Only the groups on the path to the current page are open. | `sidebar: { collapsed: false }` |
| Metadata blocks start closed | "Who is this for", "Related", "External references" and "Glossary links used" show a label and a count, such as "Related (3)". | `metadataBlocks: { collapsed: false }` |
| A hub shows its cards first | The child cards come before the metadata blocks. | Nothing. This isn't an option. |
| The footer gains a group | A "Machine-readable" group lists each surface the site serves. | `footer: { machineEntryPoints: false }` |
| Pages gain format links | The footer and the `<head>` link the page's JSON, OKF and Atom versions. | `pageFormats: { atom: false }` removes Atom only. |
| The build writes Atom files | Each published, dated page gets `api/pages/<id>.atom.xml`. | `pageFormats: { atom: false }` |
| The agent index names fewer surfaces | `_links` lists only the surfaces your site serves. | Nothing, unless a surface sits at a non-standard path; then set `links`. |
| The `<head>` links move | The RSS and `llms.txt` alternates come later in the `<head>`. | Nothing. |

### Sidebar groups

The generated sidebar starts every group closed, except the groups on the path
to the current page. A sidebar you wrote yourself is not changed.

### Metadata blocks

Each block opens by mouse or keyboard, and also with scripts off. It starts
closed again on the next page, prints open, and stays in search.

### Hub order

On a hub, the child cards now come before the related and external-reference
blocks. Before, the blocks came first. Every other page keeps its order.

### Footer and page formats

The footer group lists the LLM index, the agent API, the content graph, RSS, the
sitemap, the bibliography, the scenarios and the OKF bundle, for those your site
serves. The sitemap link needs `site` to be set.

Each published page also links its JSON and OKF versions. The JSON link
appears only when the site serves the per-page agent JSON route
(`/api/pages/[...slug].json`). A page with
`agent: { discoverable: false }` has no format links. Slide decks have none
either.

`footer: { machineEntryPoints: false }` removes the group of site-wide links.
The page's own format links stay.

### Atom files

The build writes one Atom entry for each published page that has an `updated`
or `generated.at` date. A draft, or a page with no date, gets none. The Atom
link also leaves the page when you set `pageFormats: { atom: false }`.

Limits to know before you rely on them:

- A site with no `site` gets no Atom entries and no Atom links, and the build
  warns once, naming `site`. An Atom `id` must be a stable absolute IRI.
- An `.mdx` page has an entry with no `<content>`: the `title`, `summary` and
  `alternate` link only.
- A local image in the content becomes its alt text, or nothing without one.
- Characters XML 1.0 forbids (a form feed, an ANSI escape) are removed from Atom
  and RSS output.
- The `id` is the absolute page URL. It changes when the domain, `base` or a slug
  changes.

### The agent index

The agent index and each page record used to link `llms`, `sitemap`, `rss`,
`bibliography` and `scenarios` whether or not the site served them. Now
`_links` follows the routes the site mounts at their standard paths. A site
that mounts one at another path sets the matching `links` option on
`agentIndexRoute`. Only `pages`, `rss`, `bibliography`, `scenarios` and the
opt-in `mcp` take a `links` override. `llms` and `sitemap` have none: they
follow detection alone, and `sitemap` also needs `site`. The build check fails if a forced link points at a file the
build didn't write.

### The `<head>`

The toolkit's feed links used to be part of the Starlight config's `head`. They
now render through the `Head` component, after Starlight's own tags. The tags
are the same, apart from the new JSON, OKF and Atom alternates, and they sit
later in the `<head>`.

A site that sets `starlight.head` used to lose the toolkit's feed links,
because its entries replaced them. It now gets them. If that site added its own
RSS alternate, the page now has two. Remove yours.

### Other things that move

- A feed served as a static file, such as `public/rss.xml` or `public/llms.txt`,
  isn't a route. It gets no footer or head link and no `_links` entry. The head
  link to it used to be emitted unconditionally and now disappears. To get the
  links and the entry, serve the feed from a route.
- Setting `starlight.head` replaces the toolkit's own head entries, including the
  table-of-contents no-flash script and the theme's font links. Copy them over if
  you set it, or leave `head` alone.
- A Starlight plugin that overrides `Head` also loses the RSS and `llms.txt` links
  and the new format alternates, because they render through the toolkit's `Head`.
  Render them from your own `Head`.
- `IndexLinks.llms` and `IndexLinks.sitemap` are now optional in the agent
  index contract. TypeScript code that reads `_links.llms.href` stops compiling
  until it handles `undefined`.
- Detection recognises the standard route patterns only, and the parameter name
  counts. A route at `/api/pages/[...path].json` serves the same URLs but isn't
  detected, so its JSON link disappears. Rename the parameter to `[...slug]`.

## Check your upgrade

1. Build the site. A build that failed on a `[dk-config]` message names the key
   to fix.
2. Compare the sidebar. With `sidebar: { collapsed: false }` it matches the old
   build.
3. Check `dist/api/index.json`. Each `_links` entry should point at a file the
   build wrote.
4. If you pin build output in tests, update the snapshots for the changes in
   the table.
