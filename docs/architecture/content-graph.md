---
title: Content graph
description: "The api/content-graph.json file every build publishes: node and edge shape, relation kinds, ids, ordering, and what it leaves out."
doc_status: active
updated: 2026-11-22T00:00:00Z
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
  - adr/0080-tom-classification-field-and-measures-catalog
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
| `catalog` | `catalog:measure:<id>` | A measure from the measures catalog that a page lists in `tom_classification` |
| `resource` | `resource:<url-or-path>` | An external URL, or a `sources` resource that is not a page |
| `resource` | `openapi:<label>` | One published OpenAPI version, when the `openapi` option is set (see below) |

A page node carries these fields when the page has a value for them:

- OKF names: `type`, `title`, `description`, `resource`, `tags`, `status`,
  `generated`, `verified`, `stale_after`, `sources`. `status` is the OKF value
  mapped from `doc_status` (see the [metadata model](./metadata-model.md#doc_status-to-okf-status)).
- DocKitty fields: `doc_status`, `doc_kind`, `section`, `href`, `authors`,
  `updated`.

An `openapi:<label>` node has its own id namespace: `<label>` is the version
label from the `openapi.specs` option, so it cannot collide with a page path or
a `resource:` id. It is a `resource` node with a `title`, a `url` (the version's
raw document) and an `openapi` object, `{ sha256, released, overview }`: the
raw document's digest, whether the version is released, and the absolute URL of
the version's overview page. `resource` stays what it is on every node, a
string path, and is unset here. The node has no edges: the graph holds
frontmatter relations only, and a spec version has no frontmatter. Sites
without the option have no such nodes.

A `catalog:measure:<id>` node is a record of the measures catalog
([ADR-0080](../adr/0080-tom-classification-field-and-measures-catalog.md)). Its
`title` is the measure's label and its `url` is the measure's DPV concept IRI,
when the record has one. It also carries a `measure` object,
`{ nature, frameworks }`: the measure's nature (`technical`, `organisational`,
`legal` or `physical`) and its framework references. The graph holds a measure
node only when at least one published page lists that measure.

Instants are UTC `YYYY-MM-DDTHH:MM:SSZ` and actors use the
[actor convention](./metadata-model.md#actors). Catalog and resource nodes carry
`title` and `url` (or `resource`).

## Edges

An edge is `{ id, source, target, rel, note?, scope? }`, and its `id` is
`source|rel|target`. `rel` is one of:

| `rel` | From frontmatter | Target |
|---|---|---|
| `related` | `related` | the related page |
| `audience` | `audience[].profile` | the persona page; `note` is the guidance text |
| `cites` | `external_references` | a `catalog` or `resource` node |
| `in-section` | the page's location | the nearest published ancestor section index |
| `derived-from` | `sources[].resource` | the page, or a `resource` node |
| `classified-as` | `tom_classification` | a `catalog:measure:<id>` node; `note` is the entry's note |

A reader that ignores `rel` still gets a plain directed edge, which is what OKF
tools expect. The graph holds frontmatter relations only. Glossary auto-links
and links in page bodies are not in it.

The edges come from the same resolvers as the Related, Audience and External
references blocks on the rendered page, so the file and the page cannot
disagree. A `related` entry that resolves to no page fails the build, as it does
for the block.

A `classified-as` edge always carries `scope`: `system` (the default) or
`organisation`. No other relation has a `scope`. Its target is a catalog record,
not a page. A measure id that is not in the measures catalog fails the build, and
that check covers draft pages too, even though a draft contributes no edges.

The OKF export renders a page's `classified-as` edges as a `## Measures` section,
after `## References`. Each line is the measure's label linked to its DPV IRI, an
`(organisation)` marker for organisation scope, then the note. The lines follow
the graph's edge order, which is the code-unit order of the target ids, so the
measures appear sorted by measure id rather than in authored order.

## Order and drafts

- Nodes sort by `id` and edges by `(source, rel, target)`, both by code unit.
  Two builds of the same input produce the same bytes.
- Draft pages are left out whatever `DK_PUBLISH_DRAFTS` says, and so is every
  edge into or out of one. The rule is the sitemap's.

## See also

- [Exporting an OKF bundle](../guides/export-okf-bundle.md)
- [Generators](./generators.md), for the other agent-API files
- [Metadata model](./metadata-model.md), for the fields a node copies
