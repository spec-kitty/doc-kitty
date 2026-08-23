---
title: "ADR-0001: Build on Astro + Starlight"
description: Chosen rendering stack for the toolkit.
doc_status: active
updated: 2026-08-21
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
---

# ADR-0001: Build on Astro + Starlight

## Status

Accepted

## Context

We need a static docsite generator that renders a Common Docs `docs/` tree,
supports Markdown/MDX, and lets us add custom build-time endpoints (RSS,
agent-API).

## Decision

Use Astro with the Starlight docs theme. The toolkit is a thin, opinionated
layer: a config preset, a content loader + schema, and route handlers.

## Consequences

### Positive

- Batteries-included nav, search, theming.
- Astro endpoints make feeds and the agent-API trivial at build time.

### Negative

- Starlight is opinionated; the Kitty twists (README-as-index, root `docs/`)
  need custom loader wiring — see [ADR-0002](./0002-readme-as-index.md).

## Alternatives considered

### Option A: Custom content-collections build

Full control, but reimplements nav/search/theme for no real gain.

## References

- <https://starlight.astro.build>
