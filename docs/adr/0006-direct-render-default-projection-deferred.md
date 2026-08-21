---
title: "ADR-0006: Direct render by default; projection deferred"
description: Render the repo-root docs/ tree directly; keep the projection pipeline as an optional, deferred mode.
status: active
updated: 2026-08-21
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0003-root-docs-and-agent-extension
  - adr/0004-amend-common-docs-as-extensible-variation
  - plans/roadmap
---

# ADR-0006: Direct render by default; projection deferred

## Status

Accepted

## Context

There are two ways to feed documentation into the site.

Direct render: the loader reads the repo-root `docs/` tree and renders those files
as-is. [ADR-0003](./0003-root-docs-and-agent-extension.md) set this up.

Projection: a build step validates, filters, and rewrites the authored `docs/`
into a separate generated collection, and the site renders that copy. The client
reference implementation uses projection to publish a filtered subset of a private
docs tree.

Every feature on the roadmap (metadata-driven chrome, related links, external
references, glossary, decks) can be built as a render-time transform. None of them
require projection. Projection earns its cost for one job: publishing a redacted
or filtered subset of a private tree.

## Decision

Direct render is the default and supported posture. Features are added as
render-time transforms: component overrides, `getEntry` resolution, generated
collections, and remark/rehype steps.

Projection stays an optional, opt-in mode for the redaction case, deferred to a
later mission (M8). It is not part of the foundation.

## Consequences

Adoption stays cheap: point the toolkit at `docs/`, with no sync step and no
git-ignored generated tree. The authored file is the rendered file, so
README-as-index reads correctly on the repo host.

Direct render cannot publish a filtered subset of a private tree. A project that
needs redaction waits for the M8 projection mode.

## Alternatives Considered

Projection by default. Rejected: it adds a sync step, a git-ignored tree, and a
gap between the authored and rendered files that most sites never need.

## References

- [ADR-0003](./0003-root-docs-and-agent-extension.md),
  [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md)
- [Roadmap](../plans/roadmap.md) (M8)
