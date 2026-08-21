---
title: Architecture
description: "How the toolkit turns a Common Docs tree into a site plus feeds and an agent-API: the current design."
status: active
updated: 2026-08-21
type: Architecture
agent:
  priority: 0.8
---

# Architecture

This section describes the **current** design of the toolkit: how it reads a
Common Docs — Kitty `docs/` tree and produces a Starlight site plus a sitemap,
an RSS feed, `llms.txt`, and a JSON agent-API. It describes what exists today,
in the present tense — planned work lives in [Plans](../plans/), and the reasons
behind the design live in the [decision records](../adr/).

Start with the [overview](./overview.md) for the whole map, then read the detail
page for the part you care about.

## The map

- [Overview](./overview.md) — components, data flow, the generators, and the
  version-sensitive spots. Read this first.

## Component detail

Each page below expands one component the overview only names, one concern per
page:

- [Loader and schema](./loader-and-schema.md) — how `docKittyDocsLoader` reads
  repo-root `docs/`, rewrites `README.md` to a section slug, and how
  `docKittyDocsSchema` validates frontmatter.
- [Metadata model](./metadata-model.md) — the frontmatter contract every page
  carries and how the toolkit reads it: publication gating, section ordering, and
  agent-record shaping (`lib/metadata.ts`).
- [Generators](./generators.md) — the four output surfaces
  (`sitemap.xml`, `rss.xml`, `llms.txt`, the agent-API) and their route
  handlers.
- [Starlight integration](./starlight-integration.md) —
  `defineDocKittyIntegrations`: the Starlight and sitemap preset, the feed and
  agent-API `<head>` links, and theming.
- [Builder scripts](./builder-scripts.md) — `scaffold.mjs`, `new-doc.mjs`, and
  `validate-frontmatter.mjs`.

## Build and delivery

- [CI/CD Pipeline](./ci-cd-pipeline.md) — path-scoped tests, doc sanity checks,
  and the example-site deployment; the design behind
  [ADR-0007](../adr/0007-ci-cd-path-scoped-lanes.md).

## How this section relates to the overview

The overview is the single-page map of components and data flow; it stays the
entry point. The detail pages drill into each component it lists, so the overview
does not need to grow. When a component changes, update its detail page and, if
the shape of the flow changed, the overview diagram.

_Last architecture review: 2026-08-21._
