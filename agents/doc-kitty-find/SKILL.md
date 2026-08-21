---
name: doc-kitty-find
description: Locate the right Common Docs — Kitty Variation file for a question, or identify the gap where one should exist. Use when asked "where are the docs for X", "which file documents Y", "is there a doc about Z", or before writing so you edit the correct file. Prefers metadata and the generated agent-API over full-text scanning.
---

# Doc Kitty Finder

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
     Markdown. Filter by `type`, `tags`, `status`, and `agent.keywords`.
   - Otherwise grep frontmatter `title`/`description`/`tags` across `docs/**`.
3. **Report** the best-matching file path and route, or — if none fits — the
   section and filename where it *should* be created, and hand off to
   `doc-kitty-write`.

## Tips

- A `README.md` maps to its directory route (README-as-index).
- `status: draft` pages are excluded from the built site and agent-API — check
  the source tree, not just the API, when a doc seems missing.
- Terms live in `context/domain.md`; decisions in `adr/`; present-tense design in
  `architecture/`; future work in `plans/`.
