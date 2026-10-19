---
title: Exporting an OKF bundle
description: Produce an Open Knowledge Format v0.2 bundle from your built site with dockitty-export-okf, check it, and know what the conversion changes.
doc_status: active
updated: 2026-10-19T13:00:00Z
type: Guide
kind: How-To
authors:
  - human:stijn
tags: [okf, export, content-graph, consumer]
related:
  - architecture/content-graph
  - architecture/metadata-model
  - adr/0059-content-graph-and-okf-alignment
  - guides/authoring
---

# Exporting an OKF bundle

**Audience.** A site owner or tooling engineer who wants the docs as a plain
[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
(OKF v0.2) bundle, for an OKF reader or another knowledge tool.

**Every build already writes one.** After `astro build`, the bundle is in
`dist/okf/`, served as static files with the rest of the site. To write it
somewhere else, or to validate one, use `dockitty-export-okf`.

## Quickstart

```sh
pnpm build                                  # writes dist/api/content-graph.json and dist/okf/
ls dist/okf/index.md
dockitty-export-okf --dist dist --docs docs --out okf-export
dockitty-export-okf --check --out okf-export
```

The CLI writes the same bundle as the build, byte for byte.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--dist <dir>` | `./dist` | Built site; reads `<dir>/api/content-graph.json` |
| `--graph <file>` | | The graph file itself, instead of `--dist` |
| `--docs <dir>` | `./docs` | Source docs tree |
| `--out <dir>` | `./okf-export` | Output directory. It is emptied first |
| `--index-basename <names>` | from site config | Index file names, such as `README,index`. Used when no site config is found next to the docs folder |
| `--base <path>` | empty | The site's `base`, stripped from links. Not inferred: the graph's hrefs carry no base. Without it, if every unresolved link starts with the same segment, the export prints `hint: ... pass --base /<segment>` |
| `--site-url <url>` | empty | The site's `site`; internal links that are not bundle pages become absolute against it |
| `--check` | off | Validate the bundle already in `--out` (OKF §11) and write nothing |

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | The bundle breaks an OKF rule; each violation is printed to stderr |
| `2` | Usage error or missing input, such as no content graph |

Unresolved internal links print as `warning:` lines on stderr. They are
advisory and do not change the exit code. A common one is a link to an
`/api/*.json` file, which is a site route and not a bundle page.

## What the conversion does

The export reads relations from the [content graph](../architecture/content-graph.md)
and the pages from the source tree. Draft pages are not exported.

- **Relations become body links.** Each page gains `Related`, `Audience`,
  `References` and `Derived from` sections of `/`-prefixed bundle links, as
  OKF §6.1 recommends. A citation links to its catalog URL; one with no URL is
  kept in `sources` and not linked. Personas are ordinary pages.
- **Indexes take the OKF form.** Each `index.md` lists its entries as
  `- [Title](/path.md) - description`. Only the root index carries
  frontmatter, and only `okf_version`. Index files follow your configured
  `indexBasename`.
- **Index metadata moves to a sidecar.** The original frontmatter of every
  non-root index is saved verbatim in `_index.meta.yaml` next to it. Readers
  ignore it (OKF §12).
- **Fields map to OKF.** `doc_status` becomes `status`
  ([mapping](../architecture/metadata-model.md#doc_status-to-okf-status)),
  and `authors` become actors. An email author is rewritten as
  `human:<local-part>`. Every exported page gets a `generated` block, as OKF
  §5.2 requires. `by`, `at` and `content_hash` come from the page's `generated`
  block only when it is an ownership stamp (`doc-kitty-gherkin/<version>` or
  `doc-kitty-glossary/<version>`). Any other stamp, such as the scaffold's, is
  ignored. Then `by` is the page's first author, who leaves `authors`, else
  `process:dockitty-export`, and `at` is `updated`, else that stamp's `at`.
- **`log.md`** is reserved. If your docs have one it is copied unchanged.

## The OKF reference viewer skips these links

The OKF reference viewer builds its graph from body links, but it skips links
that start with `/`. A bundle written to the recommended form therefore shows
its pages in the viewer without the relation edges. The bundle is conformant;
the viewer is the gap, and the export keeps the recommended form.

## Related

- [Content graph reference](../architecture/content-graph.md)
- [Metadata model](../architecture/metadata-model.md): instants, actors and the
  generated stamp
- [ADR-0059](../adr/0059-content-graph-and-okf-alignment.md)
