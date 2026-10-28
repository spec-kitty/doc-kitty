---
title: "ADR-0067: JSON Schema pages compile from JSON files"
description: JSON Schema pages compile into a generated docs folder. The generator owns only the pages it stamps.
doc_status: active
updated: 2026-10-28T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - context/convention
  - architecture/metadata-model
  - adr/0040-build-time-diagram-render-dual-mode
---

# ADR-0067: JSON Schema pages compile from JSON files

## Status

Accepted

## Context

Schemas and content artifacts are JSON. The docsite and the OKF export only
publish Markdown pages from the docs collection. A schema and a content
artifact are different page types: one is the contract, the other is a payload
that points at the contract.

## Decision

1. `JSON Schema` and `JSON Content` are canonical `type` values. A page under
   `json-files-output/content/` derives `JSON Content`. Any other
   `json-files-output/` page derives `JSON Schema`. `Schematic` is a canonical
   `kind` for a generated artifact page.
2. `defineDocKittyIntegrations({ jsonSchema: { source, out, graph } })` reads
   JSON from `source` (default `json-files`, relative to the project root) and
   writes Markdown into `out` (default `json-files-output/`, inside the docs
   tree). The folder is a generated section, not a place to author. A run
   refuses an unstamped file, a symlink, a reserved section name (`guides`,
   `glossary`, and the other authored sections), and a source directory that
   overlaps `out`. It rewrites a page only when its content changed, and
   deletes only pages it previously stamped. Pages may be committed. An
   unchanged JSON tree keeps `updated` and `generated.at`, so OKF and RSS stay
   stable. A date inside the JSON (`updated`, `modified`, or `last_updated`)
   wins, written as a UTC instant (`YYYY-MM-DDTHH:MM:SSZ`; a date-only value is
   that day at `T00:00:00Z`). Otherwise a new or changed page uses the run
   instant, and the next run keeps that instant while the content hash matches.
   Generated pages are stamped `doc-kitty-json-schema/<version>`.
3. A content page records the schema it fits in `related` (a docs slug) and in
   `sources` as `/<out>/contract/<schema>.md`, which the content graph resolves
   to that page. The page body links the same schema with a relative `.md`
   link. A document that fits no schema, or that fits two schemas equally,
   stops the run before any write.
4. A file is a schema when its name ends in `.schema.json`, or when `$schema`
   points at the JSON Schema meta-schema and the document has schema keywords
   (`properties`, `$defs`, `definitions`, `allOf`, `anyOf`, `oneOf`, or
   `patternProperties`). Every other JSON object is content. It is matched
   against the schemas in the source: type, required, properties,
   additionalProperties, items, enum, const, length and number bounds, and
   allOf/anyOf/oneOf. The most specific fit wins (more required fields and
   declared properties). An equal score is ambiguous. A `$schema` value that is
   a relative path names the schema, and the document must still fit it.
   Content is written to `content/<schema-stem>/<file-stem>.md`.
5. Each artifact page includes a PlantUML diagram of its source document, plus
   the JSON itself, when the diagram seam will render it. `graph` chooses the
   drawing. `json` (the default) is an `@startjson` tree of nodes and arrows.
   `uml` is one class-diagram `json` box. A string longer than 48 characters
   wraps in that drawing, on a space or an underscore, so one field does not
   set the width of the page. The JSON block stays the original document. The
   docs page keeps the diagram and the JSON block. The OKF export does not:
   see decision 7. A property or list item prints its JSON `description` beside
   the name. Setting `jsonSchema` turns that seam on unless `diagrams` is
   `false`. With the seam on, dev and build render the diagram on the site's
   own PlantUML server, including client mode, because PlantUML has no client
   renderer. This amends [ADR-0040](./0040-build-time-diagram-render-dual-mode.md)
   for these pages only: a Mermaid-only client build is unchanged, and
   `diagrams: false` omits the fence. Each request waits up to 1 minute,
   including queue time. `DK_PLANTUML_TIMEOUT_MS` raises that ceiling. A
   missing server fails the build. A wide drawing stays at the size PlantUML
   drew and scrolls horizontally; selecting it opens the same drawing centered
   at full size.
6. A Markdown file beside a JSON file is author text for that page. The
   companion is the same path with `.md` instead of `.json` (`x.md` next to
   `x.json`, including `widget.schema.md` next to `widget.schema.json`). On a
   schema page the text follows the Required line. On a content page it
   follows the source-file line. The heading is `## Extra Information`. A JSON
   file with no companion, or a companion that is empty, leaves the page
   without that heading. A symlink companion stops the run before any write.
   Editing the companion changes the page hash.
7. Each source JSON is copied to `public/json-files/<path>`. The page's source
   line links that path (`/json-files/<path>`). The OKF concept for an artifact
   is `type: Schematic`, with `resource` set to `/json-files/<path>`. The
   source line in the OKF body is a relative link to that file, so the bundle
   does not need a site URL. The bundle stores the JSON at that path. The OKF
   body omits the diagram, the raw JSON block, and the text that repeats the
   file: the schema description, the Required line, and the Properties, Diagram,
   Schema, and Artifact sections. The source line, links to
   other concepts, and the Extra Information section stay, including a heading
   the note itself uses. The docs page still has the lists and the diagram.
   `Schematic` is an unregistered OKF type, which OKF v0.2 accepts. The page
   `type` on the site stays `JSON Schema` or `JSON Content`.

## Consequences

Sites that do not set `jsonSchema` are unchanged. A site that sets it also
receives the diagram seam unless `diagrams` is `false`, and must run a
PlantUML server for that render. Register `json-files-output` in
`sections.yaml` when the folder should appear in the sidebar before it exists
on disk: the id is seeded with the other build-generated sections. The
generated pages use `kind: Hub` for indexes and `kind: Schematic` for
artifacts, so they enter the content graph and the OKF bundle.

## References

- [Common Docs convention](../context/convention.md)
- [Metadata model](../architecture/metadata-model.md)
