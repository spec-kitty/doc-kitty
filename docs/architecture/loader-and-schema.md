---
title: Loader and schema
description: How the toolkit reads repo-root docs/, rewrites README-as-index to a section slug, and validates frontmatter.
doc_status: draft
updated: 2026-08-21
type: Architecture
kind: Reference
tags: [loader, schema, astro]
related:
  - architecture/overview
  - architecture/section-registry
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
  - Excludes reserved, frontmatter-free files (`log.md`) and the non-content
    `docs/_meta/` directory.
  - Rewrites `README.md` to its section slug, so a section index renders at the
    directory route.
  - Reads the [section registry](./section-registry.md) (`docs/_meta/sections.yaml`)
    once and exposes the ordered section list and each section's metadata to the
    schema and the generators, so section identity and order are data, not code.
- **`docKittyDocsSchema` — the frontmatter contract**
  - This outline tracks the current frontmatter (`status`, `type`). The evolved
    contract (`doc_status`, `kind`, and the rest) lands in M1; see the
    [metadata model](./metadata-model.md).
  - Required fields: `title`, `description`, `status`, `updated`, `type`.
  - Enum validation for `status`; `type` validated against the section registry.
  - Optional families: `authors`, `related`, `tags`, `sources`, and the Kitty
    `agent` block.
  - The bundle-root exemption: `docs/README.md` carries `okf_version`, not
    `type`.
- **`type`-to-section derivation** — the expected `type` for a page comes from the
  registry entry for its section, refined by a short sub-path override table
  (`adr/NNNN` → `ADR`, `plans/features/*` → `Feature`, and the rest). A declared
  `type` that does not match warns, not fails. The full rule is in
  [section-registry.md](./section-registry.md).
- **Where validation happens** — build-time (schema) versus the standalone
  `validate-frontmatter.mjs` CI gate; how they overlap. Both read the same registry
  so the two validators agree on sections and expected types.
- **Version-sensitive spots** — the exact loader API for README-as-index and
  pointing the collection at repo-root `docs/`; both tracked against the pinned
  Astro/Starlight versions. See [ADR-0002](../adr/0002-readme-as-index.md).
- **Failure modes** — dangling `related` refs, missing required fields, a
  `type` that does not match its section, a `docs/` folder with no registry entry
  (warns and degrades), and a registry entry with no folder (warns).
