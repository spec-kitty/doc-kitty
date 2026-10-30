---
title: "ADR-0067: Schematic pages reference a schema file"
description: A kind Schematic page is authored Markdown that names a JSON Schema file. The build reads the file and adds the diagram, the property list and a source link.
doc_status: active
updated: 2026-10-30T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0040-build-time-diagram-render-dual-mode
  - adr/0059-content-graph-and-okf-alignment
---

# ADR-0067: Schematic pages reference a schema file

## Status

Accepted

## Context

Contracts are JSON Schema files: events payloads (`*.schema.json`) and doctrine
schemas (`*.schema.yaml`). A docs site should describe them without copying
them. A first design compiled a folder of JSON into generated pages. That put
one file in five places that could drift, hard-coded JSON, and made the tool
own a folder. The schema must stay the single source of truth, and the page
must stay authored.

## Decision

1. **A page references a schema.** `kind: Schematic` with
   `schematic_path: <file>` in the frontmatter, on an ordinary page in the docs
   tree. The Markdown body is the page's own content. `Schematic` is a canonical
   `kind`; the `type` comes from the section as for any page.
2. **The path is relative to the project root**, not to the page, so moving a
   page does not break it. An absolute path, a path that leaves the root, and a
   symlink that resolves outside it are refused.
3. **A remark plugin adds the generated parts at build time**, only on a page
   with `kind: Schematic` (the `deck-split` guard, so every other page is
   untouched and a site without such a page pays nothing). Nothing generated is
   committed. In order:
   - before the body, the schema `description` as a lead paragraph;
   - after the body, `## Diagram`, `## Properties` and `## Source`.

   An authored `##` heading of the same text replaces the generated section.
4. **Diagram.** The parsed schema is drawn as a PlantUML `@startjson` fence and
   goes through the ADR-0040 pipeline. PlantUML has no client renderer, so the
   section is added only when `diagrams` is on and the render mode is `build`;
   with client-mode diagrams it is omitted (a raw fence would show as code). ADR-0040 is
   unchanged: no client-mode PlantUML, no timeout change.
5. **Properties.** Name, type, required, description, rendered from the schema.
   Each `$ref`'d object type gets a `###` sub-section, and a property links to
   it. A type met twice, including a cycle, is rendered once and linked.
   Descriptions render as plain text, not Markdown: a schema author's `*` or
   backticks appear literally.
6. **Formats.** `.json` uses `JSON.parse`. `.yaml` and `.yml` use `yaml` (v2)
   with the core schema and no merge keys; a multi-document file is refused.
   `yaml` is an exact-pinned direct dependency.
7. **`$ref` scope.** Internal JSON pointers (`#/$defs/X`, `#/definitions/X`,
   `#`), and relative `.json`/`.yaml` files with an optional pointer, which must
   stay inside the project root. URL references are not fetched; they render as
   links. No dereferencing library.
8. **Fail closed.** The build stops with `[dk-schematic] <page>: "<path>" ...`
   when the file is missing, cannot be parsed, is outside the root, is not a
   single schema document (a mapping with `type`, `properties`,
   `$defs`/`definitions`, `allOf`, `oneOf` or `anyOf`), or has an unresolvable
   `$ref`.
9. **Publishing.** At `astro:build:done` the file is copied byte for byte next
   to the page route, keeping its extension (`/reference/lane/` gets
   `/reference/lane.yaml`), so the `Source` link works. Pages withheld as drafts
   publish nothing. A localized copy of a page is its own page, so it publishes
   its own copy of the schema under its own route. Publishing never overwrites:
   the build stops with `[dk-schematic]` when the target already exists in the
   output (a `public/` file, `/index.yaml`, `/api/*.json`, OpenAPI output) or when
   two pages map to the same file. The dev server serves the same path with
   `X-Content-Type-Options: nosniff` and a MIME type by extension
   (`application/json`, `application/yaml`).
10. **OKF.** The page exports as a concept whose `resource` is the published
    file: the site URL plus base when the origin is known (ADR-0059), else the
    base-prefixed path. The body is the authored body; the export does not read
    generated text back.

## Consequences

- The schema file is the only copy of the contract. The page cannot drift from
  it, because the generated parts are rebuilt each time.
- One always-on plugin and one always-on integration are registered. Both do
  nothing on a site with no Schematic page apart from a directory walk at the
  end of the build.
- A `$ref` inside an `allOf`, `oneOf` or `anyOf` member is followed; other
  keywords (`if`, `not`) are not rendered. `additionalProperties` and
  `patternProperties` schemas show as `map of <type>`.
- No validation of instances against the schema. A validator is out of scope.

### Relation to the OpenAPI work (#244)

OpenAPI reference pages are also backed by a contract file. A later change may
let `schematic_path` take `file#/json/pointer` into an OpenAPI document
(`api.yaml#/components/schemas/X`). The pointer resolver here already accepts a
file plus a pointer. That is not built.

## References

- [ADR-0040](./0040-build-time-diagram-render-dual-mode.md): the diagram pipeline.
- [ADR-0059](./0059-content-graph-and-okf-alignment.md): base-aware OKF output.
