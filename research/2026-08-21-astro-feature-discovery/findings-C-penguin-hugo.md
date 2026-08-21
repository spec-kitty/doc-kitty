# Findings C — Penguin Pragmatic Patterns (Hugo)

Target (read-only): `SDD/_publications/penguin-pragmatic-patterns`. Hugo site on
the `hugo-fresh` theme module, heavily overridden. Config `config.yaml`. Content
model is pattern-oriented (concepts, practices, primers) with TOML frontmatter
(`+++`). Central catalogs live under `data/` (`bibliography.toml`,
`glossary.toml`, `tools.toml`, `presentations.toml`).

## Top takeaways

- **External references are metadata, not prose.** Each page carries a
  `further_exploration` array; every entry is a typed object
  `{type="biblio|tool|raw", ...}`. `biblio`/`tool` entries are *just an id*
  resolved against a shared data file; `raw` entries are inline one-off
  citations. This id-into-data-file join is the exact pattern to port. See
  `layouts/partials/references.html`.
- **One shared bibliography, three renderings.** The same
  `data/bibliography.toml` record drives (a) the inline "Further Exploration"
  list on a pattern page, (b) the `/books` index, and (c) a per-book detail page
  `/books/<id>` — all via `layouts/partials/book_biblio.html`. Single source of
  truth.
- **Related pages use UUID references resolved to live pages.**
  `related_concepts` / `related_practices` are arrays of page UUIDs resolved
  against `.Site.Pages` by a `uuid` field, rendering title + the target page's
  own description (reference *plus* description). See
  `layouts/partials/pattern.html`.
- **Glossary = data file + opt-in inline shortcode.** `data/glossary.toml` holds
  all terms; `{{< term >}}` does on-demand lookup (name/alias/abbreviation) and
  renders an inline popover. No auto-linking — explicit per usage.
- **Page chrome is metadata-driven.** Title, subtitle, description, author,
  pubdate, tags, taxonomies, and a bespoke AMMERSE block all come from
  frontmatter through partials.

## External references (primary pattern)

**Frontmatter shape** (genericized, on a content page):

```toml
further_exploration = [
    {type="biblio", id="<biblio-uuid>"},
    {type="tool",   id="<tool-uuid>"},
    {type="raw", author="<Author>", year="<year>", title="<title>", site="<site>", link="<url>"},
]
```

Three entry kinds: `biblio` (only `type`+`id`, resolves into
`data/bibliography.toml`), `tool` (only `type`+`id`, resolves into
`data/tools.toml`), `raw` (self-contained inline web citation, no lookup).

The referenced catalog record (`data/bibliography.toml`) is rich:

```toml
[[book]]
id = "<uuid>"
title = "<title>"
subtitle = "<subtitle>"
minimized_title = "<sort-key>"
isbn = "<isbn>"
authors = "<Last, I.; Last, I.>"
publisher = "<publisher>"
location = "<city>"
image = "<cover>.webp"
year = "<year>"
link = "<url>"
description = """<markdown blurb>"""
levels = ["<level>"]   # 'levels' taxonomy
tags = ["<tag>"]
# optional: draft = true, unlisted = true
```

`data/tools.toml` is analogous (`[[tool]]` with
`id, name, authors, link, image, description, tags, type`).

**Render mechanism** — `layouts/partials/references.html`, invoked from
`layouts/partials/pattern.html` inside a collapsible `<details>` block. It:
(1) reads `.Params.further_exploration`; (2) for `type=="biblio"`, plucks ids via
`apply (where … "type" "biblio") "index" "." "id"`, then joins with
`where $allBooks "id" "in" $ids`, rendering each as an IEEE-style `<li>` linking
to the internal `/books/<id>` detail page; (3) same join for `type=="tool"`
against `.Site.Data.tools.tool`; (4) `type=="raw"` rendered directly from inline
fields, linking to the external `link`. There is also a standalone
`{{< reference >}}` shortcode (`layouts/shortcodes/reference.html`) for dropping
an APA-ish citation directly into body prose (book/journal/website variants) —
the inline sibling of the metadata list.

## Glossary

Source `data/glossary.toml`, array of `[[terminology]]` records:
`name, abbreviation, domain, description (markdown), aliases[], references[]`
where each reference is `{ title, link }`. Full page `layouts/glossary/list.html`
ranges sorted terms through `layouts/partials/glossary_term.html` (anchor id =
slugified name; aliases; nested references list). Inline:
`{{< term name="<term>" title="<display>" >}}` (`layouts/shortcodes/term.html`)
matches lowercased name+aliases+abbreviation and renders an inline `<details>`
popover linking to `/glossary/#<slug>`, with a graceful "no definition found"
fallback. **No auto-linking** — opt-in per usage. A `{{< whatis >}}` shortcode
also exists for ad-hoc inline definitions.

## Related pages

Frontmatter `related_concepts = ["<uuid>", …]` /
`related_practices = ["<uuid>", …]` — arrays of page UUIDs (each page has a
`uuid` field, mirrored into `aliases` for routing). In `pattern.html`:
`range where .Site.Pages ".Params.Uuid" "in" $related…` renders
`<a href=RelPermalink>Title</a>: Description`. So related items are **reference +
live description** (pulled from the target page), never a hand-copied blurb.
Shown under the same collapsible "References and Related Patterns" `<details>`,
split into "Related Concepts" / "Related Patterns".

## Metadata-driven chrome

`title, subtitle, description, author, pubdate, image` all from frontmatter,
rendered by `pattern.html` (hero, responsive `<picture>` from `image` base name,
footer "cutout" with UUID/author/date/available output formats).
`title-section.html` renders title+subtitle for list pages. Taxonomies in
`config.yaml`: `categories`, `tags`, and a custom `levels`. Bespoke
`ammerse = [{name, delta, rationale}]` frontmatter array drives a values-impact
widget via `partials/ammerse.html` — good example of arbitrary structured
frontmatter driving a custom visualization. `outputs = ['html','json']` enables
per-page multi-format output advertised in the footer.

## Other portable patterns

The recurring meta-pattern is **data-file-as-catalog, id-referenced from
pages**: bibliography, tools, glossary, presentations all live in `data/*.toml`,
referenced by id/name from content, rendered by a dedicated partial reused across
index page, detail page, and inline reference. Detail pages are generated by
filtering the data file for one id (`layouts/books/single.html`). Archetypes
(`archetypes/practice.md`) seed the pattern structure and an Obsidian-style
`> [!STUB]` callout convention (`stub` shortcode). Section-per-type routing: each
of concepts/practices/primers/books/tools/glossary/presentations/pillars has its
own `layouts/<section>/`.

## Translating each to Astro (brief)

- **External references** → Zod-typed
  `furtherExploration: Array<{type, id?, ...rawFields}>` in the collection
  schema; model bibliography/tools as their own Astro content collections keyed
  by `id`; a `<FurtherReading>` component resolves `biblio`/`tool` via
  `getEntry('bibliography', id)` and renders `raw` inline. Astro's
  `getEntry`/`reference()` replaces Hugo's `where "id" "in" ids` join.
- **Glossary** → a `glossary` collection (or YAML data + Zod array); `<Term name />`
  component does name/alias/abbreviation lookup and renders a `<details>` popover;
  `/glossary` maps the collection. Optional remark/rehype auto-linking later, but
  the Hugo baseline is explicit opt-in.
- **Related pages** → `relatedConcepts`/`relatedPractices` as arrays of slugs via
  Astro's `reference()`; resolve with `getEntry` and render `title` + live
  `description`.
- **Chrome / taxonomies** → typed frontmatter + layout component reading props;
  `tags`/`categories`/`levels` become dynamic `[tag].astro` routes from
  `getCollection`.
- **AMMERSE / custom blocks** → typed frontmatter object-array + dedicated
  component (direct analog of partial-per-widget).
