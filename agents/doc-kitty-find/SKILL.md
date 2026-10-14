---
name: doc-kitty-find
description: Locate the right DocKitty file for a question, or identify the gap where one should exist. Use when asked "where are the docs for X", "which file documents Y", "is there a doc about Z", or before writing so you edit the correct file. Prefers metadata and the generated agent-API over full-text scanning.
---

# DocKitty Finder

Find the `docs/` file that answers a question — or determine that it doesn't
exist yet and say where it should live.

## Workflow

1. **Map the intent to a section** using the twelve-section model:
   context, architecture, adr, plans, api, configuration, integrations,
   security, guides, operations, migrations, changelog. (See
   [`../../docs/context/convention.md`](../../docs/context/convention.md).)
2. **Prefer metadata over scanning:**
   - Read the section's `README.md` (the frontmatter-carrying index) for its
     link list.
   - If the site is built, use the **agent-API**: `GET /api/index.json` for the
     whole map, or `GET /api/pages/<id>.json` for one page's metadata + raw
     Markdown. Filter by `type`, `kind`, `tags`, `doc_status`, and `agent.keywords`.
   - Otherwise grep frontmatter `title`/`description`/`tags` across `docs/**`.
3. **Report** the best-matching file path and route, or — if none fits — the
   section and filename where it *should* be created, and hand off to
   `doc-kitty-write`.

## Tips

- A `README.md` maps to its directory route (README-as-index).
- `doc_status: draft` pages are left out of the agent-API, `llms.txt`,
  `rss.xml` and `sitemap.xml`, and out of the built site entirely when it is
  built with `DK_PUBLISH_DRAFTS=off` — check the source tree, not just the API,
  when a doc seems missing.
- Terms live in `context/domain.md`; decisions in `adr/`; present-tense design in
  `architecture/`; future work in `plans/`.
- Behaviour specs, when a site turns on the `gherkin` option, are generated pages
  under the `behaviour` section (configurable) with `kind: Specification`, one per
  Gherkin `.feature` file. Their source is the `.feature` file named in the page's
  `sources:` field. Edit that file, never the generated page. Feature tags such as
  `@dk:mission=<slug>` and `@dk:adr=<n>` become `related` refs, so filter on
  a page's `related` metadata to find the specs for a mission or decision.
- When the site also mounts `scenarioIndexRoute`, `GET /api/scenarios.json` lists
  every published feature page (`id`, `url`, `source`, `tags`, `related`) and
  each of its scenarios: `rule`, `anchor` (append `#<anchor>` to the page `url`),
  source `line`, own `tags`, `outline`, `steps` and outline `examples`. Query it
  for "which scenarios cover X" instead of scraping the pages. `llms.txt` carries
  a `Scenario index:` line when at least one published generated feature page
  exists. Drafts are not listed.
- A page can embed scenarios from a `.feature` file with a
  `::gherkin{src="…" scenario="…"}` (or `tags="…"`) include. Its
  `/api/pages/<id>.json` `markdown` already holds the included scenarios in
  place of the directive, and `includes` lists each one's `src` and its
  `scenario` or `tags`. The `.feature` file named in `src` is the source to
  edit for those scenarios.
