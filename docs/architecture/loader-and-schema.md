---
title: Loader and schema
description: How the toolkit reads repo-root docs/, rewrites README-as-index to a section slug, and validates frontmatter.
status: draft
updated: 2026-08-21
type: Architecture
tags: [loader, schema, astro]
related:
  - architecture/overview
  - context/convention
---

# Loader and schema

The loader is how a Common Docs — Kitty tree becomes an Astro content
collection. It reads the repo-root `docs/` directory, applies the Kitty twist
that `README.md` is the section index, and validates every page against the
frontmatter schema. This page expands the loader and schema the
[overview](./overview.md) only names.

<!-- Outline — to be fleshed out. -->

- **`docKittyDocsLoader` — what it does**
  - Points the `docs` content collection at repo-root `docs/` (not `src/`).
  - Excludes reserved, frontmatter-free files (`log.md`).
  - Rewrites `README.md` to its section slug, so a section index renders at the
    directory route.
- **`docKittyDocsSchema` — the frontmatter contract**
  - This outline tracks the current frontmatter (`status`, `type`). The evolved
    contract (`doc_status`, `kind`, and the rest) lands in M1; see the
    [metadata model](./metadata-model.md).
  - Required fields: `title`, `description`, `status`, `updated`, `type`.
  - Enum validation for `status` and `type`; `type`-by-path expectations.
  - Optional families: `authors`, `related`, `tags`, `sources`, and the Kitty
    `agent` block.
  - The bundle-root exemption: `docs/README.md` carries `okf_version`, not
    `type`.
- **Where validation happens** — build-time (schema) versus the standalone
  `validate-frontmatter.mjs` CI gate; how they overlap.
- **Version-sensitive spots** — the exact loader API for README-as-index and
  pointing the collection at repo-root `docs/`; both tracked against the pinned
  Astro/Starlight versions. See [ADR-0002](../adr/0002-readme-as-index.md).
- **Failure modes** — dangling `related` refs, missing required fields, a
  `type` that does not match the path.
