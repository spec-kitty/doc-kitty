---
title: Content graph
description: "The api/content-graph.json file every build publishes: node and edge shape, relation kinds, ids, ordering, and what it leaves out."
doc_status: active
updated: 2026-10-18T07:40:00Z
type: Architecture
kind: Reference
authors:
  - human:stijn
tags: [content-graph, agent-api, okf, relations]
related:
  - architecture/metadata-model
  - architecture/generators
  - guides/export-okf-bundle
  - adr/0059-content-graph-and-okf-alignment
---

# Content graph

Every build publishes `api/content-graph.json`: all published pages and the
frontmatter relations between them in one file. A consumer that wants the
site's structure fetches this file instead of one JSON file per page. The
[OKF export](../guides/export-okf-bundle.md) reads it as its only source of
relations. The decision is recorded in
[ADR-0059](../adr/0059-content-graph-and-okf-alignment.md).

## Always on

The `doc-kitty:content-graph` integration injects the route on every site. There
is no option to turn it off, and a site mounts no endpoint file.
`api/index.json` links it as `_links.contentGraph`, so the build's artifact gate
checks that the file exists and that every edge points at a node.

## File shape

```json
{
  "schema": "dockitty.content-graph/1",
  "okf_version": "0.2",
  "generatedFrom": "doc-kitty",
  "nodes": [],
  "edges": []
}
```

`schema` carries the format version. A change that breaks readers bumps it.

## Nodes

A node's `id` is unique. For a page it is the bundle path without `.md`, such as
`guides/getting-started` or `adr/README`, the same form the OKF reference viewer
uses.

| `kind` | `id` | What it is |
|---|---|---|
| `page` | bundle path | A published page, including section indexes |
| `persona` | bundle path | A page under `context/audience/` |
| `catalog` | `catalog:<type>:<id>` | A bibliography entry cited by `external_references` |
| `resource` | `resource:<url-or-path>` | An external URL, or a `sources` resource that is not a page |

A page node carries these fields when the page has a value for them:

- OKF names: `type`, `title`, `description`, `resource`, `tags`, `status`,
  `generated`, `verified`, `stale_after`, `sources`. `status` is the OKF value
  mapped from `doc_status` (see the [metadata model](./metadata-model.md#doc_status-to-okf-status)).
- DocKitty fields: `doc_status`, `doc_kind`, `section`, `href`, `authors`,
  `updated`.

Instants are UTC `YYYY-MM-DDTHH:MM:SSZ` and actors use the
[actor convention](./metadata-model.md#actors). Catalog and resource nodes carry
`title` and `url` (or `resource`).

## Edges

An edge is `{ id, source, target, rel, note? }`, and its `id` is
`source|rel|target`. `rel` is one of:

| `rel` | From frontmatter | Target |
|---|---|---|
| `related` | `related` | the related page |
| `audience` | `audience[].profile` | the persona page; `note` is the guidance text |
| `cites` | `external_references` | a `catalog` or `resource` node |
| `in-section` | the page's location | the nearest published ancestor section index |
| `derived-from` | `sources[].resource` | the page, or a `resource` node |

A reader that ignores `rel` still gets a plain directed edge, which is what OKF
tools expect. The graph holds frontmatter relations only. Glossary auto-links
and links in page bodies are not in it.

The edges come from the same resolvers as the Related, Audience and External
references blocks on the rendered page, so the file and the page cannot
disagree. A `related` entry that resolves to no page fails the build, as it does
for the block.

## Order and drafts

- Nodes sort by `id` and edges by `(source, rel, target)`, both by code unit.
  Two builds of the same input produce the same bytes.
- Draft pages are left out whatever `DK_PUBLISH_DRAFTS` says, and so is every
  edge into or out of one. The rule is the sitemap's.

## See also

- [Exporting an OKF bundle](../guides/export-okf-bundle.md)
- [Generators](./generators.md), for the other agent-API files
- [Metadata model](./metadata-model.md), for the fields a node copies
