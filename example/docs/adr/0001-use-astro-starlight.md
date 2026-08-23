---
title: "ADR-0001: Build on Astro + Starlight"
description: Why the toolkit renders Common Docs trees with Astro and Starlight.
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

> Note (Kitty Variation): frontmatter `status` records the *document* lifecycle
> (`active`); the *decision* status lives here and in the index table. This
> keeps every file on the one convention-wide status enum.

## Context

We need a static docsite generator that renders a Common Docs `docs/` tree,
supports Markdown/MDX, and lets us bolt on custom endpoints (RSS, agent-API).

## Decision

Use Astro with the Starlight docs theme. The toolkit supplies a config preset, a
content loader (README-as-index), the frontmatter schema, and the RSS/llms.txt/
agent-API route handlers.

## Consequences

### Positive

- Batteries-included nav, search, and theming.
- Astro endpoints make the feeds and agent-API trivial to emit at build time.

### Negative

- Starlight is opinionated; README-as-index and reading root `docs/` need custom
  loader wiring.

## Alternatives Considered

### Option A: A bespoke content-collections build

More control, but we would reimplement nav/search/theme for no real gain.

## References

- [Starlight](https://starlight.astro.build)
