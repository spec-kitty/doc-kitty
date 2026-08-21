---
title: "ADR-0003: Render root docs/; add an agent extension"
description: Read the repo-root docs/ tree directly, and add an optional agent frontmatter block.
status: active
updated: 2026-08-21
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
---

# ADR-0003: Render root `docs/`; add an `agent` extension

## Status

Accepted

## Context

Common Docs lives in a repo-root `docs/`. We want a repo that already follows the
convention to render as-is, and we want fine control over the agent-API without
polluting the core field set.

## Decision

1. The loader reads the repo-root `docs/` tree by default (`base: 'docs'`),
   rather than Astro's `src/content/docs/`.
2. Add an optional Kitty `agent` block (`discoverable`, `priority`, `keywords`)
   to frontmatter. It is a producer-defined extension; OKF consumers tolerate
   unknown keys, so the tree stays OKF-conformant.

## Consequences

### Positive
- Adopt-by-pointing: no file moves for an existing Common Docs repo.
- Agent-API ordering/visibility is tunable per page.

### Negative
- Reading content outside `src/content/docs` needs verified loader wiring per
  Starlight version.

## Alternatives considered

### Option A: Require docs under src/content/docs
Cleaner for Astro, but forces every consumer to relocate their `docs/`.

### Option B: Derive agent priority from existing fields only
Less surface, but no per-page control when it's wanted.

## References
- [Convention](../context/convention.md)
