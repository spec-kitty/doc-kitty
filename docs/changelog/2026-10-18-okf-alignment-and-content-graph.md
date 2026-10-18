---
title: OKF alignment and content graph
description: "Metadata now follows OKF v0.2, every build publishes api/content-graph.json, and every build exports a plain OKF bundle."
doc_status: active
updated: 2026-10-18T00:00:00Z
type: Changelog
kind: Changelog
authors:
  - human:stijn
tags: [okf, metadata, agent-api, content-graph, export]
related:
  - adr/0059-content-graph-and-okf-alignment
  - architecture/metadata-model
  - architecture/content-graph
  - guides/export-okf-bundle
  - guides/authoring
---

# 2026-10-18 — OKF alignment and content graph

DocKitty bundles claim OKF v0.2 conformance. This change makes the claim hold, in
three parts. See [ADR-0059](../adr/0059-content-graph-and-okf-alignment.md) for
the reasoning.

- **Metadata follows OKF
  ([#177](https://github.com/spec-kitty/doc-kitty/issues/177)).** `updated` is a
  UTC timestamp, every index declares `okf_version`, and authors and generators
  are named as OKF actors. Old forms still build, with a warning. The agent API
  moves to version 3. See the [metadata model](../architecture/metadata-model.md).
- **One file holds the site's structure
  ([#176](https://github.com/spec-kitty/doc-kitty/issues/176)).** Every build
  publishes `api/content-graph.json` with each page and its frontmatter
  relations. See the [content graph](../architecture/content-graph.md).
- **OKF readers see the relations
  ([#178](https://github.com/spec-kitty/doc-kitty/issues/178)).** Every build
  writes `dist/okf/`, a plain OKF bundle with relations as body links, and
  `dockitty-export-okf` does the same on demand. See
  [Export an OKF bundle](../guides/export-okf-bundle.md).
