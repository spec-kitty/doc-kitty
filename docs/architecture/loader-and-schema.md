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
  - A companion loader, `src/lib/sections.ts` (`loadSectionRegistry`), reads the
    [section registry](./section-registry.md) (`docs/_meta/sections.yaml`) once and
    exposes the ordered section list (`sectionOrder`) and the `id → label` map
    (`sectionLabels`) to the Starlight sidebar and the discovery surfaces, so section
    order and labels are data, not code. It is a **separate** module from the docs
    loader because it may read the filesystem, whereas `metadata.ts` is deliberately
    fs-free; the metadata helpers stay pure and take the resolved order/labels as
    arguments. A missing registry returns `null` and the callers fall back to the
    frozen `SECTION_ORDER` / `SECTION_LABEL` constants.
- **`docKittyDocsSchema` — the frontmatter contract**
  - This outline tracks the current frontmatter (`status`, `type`). The evolved
    contract (`doc_status`, `kind`, and the rest) lands in M1; see the
    [metadata model](./metadata-model.md).
  - Required fields: `title`, `description`, `status`, `updated`, `type`.
  - Enum validation for `status`. `type` is an open vocabulary validated against a
    fixed set, **not** against the registry (registry-driven `type` is deferred —
    see below).
  - Optional families: `authors`, `related`, `tags`, `sources`, and the Kitty
    `agent` block.
  - The bundle-root exemption: `docs/README.md` carries `okf_version`, not
    `type`.
- **`type`-to-section derivation (DEFERRED)** — the design is for a page's expected
  `type` to come from the registry entry for its section, refined by a short sub-path
  override table. This is **not yet wired** (issue #18 scoped the registry to
  nav/order/label); the full, deferred rule is in
  [section-registry.md](./section-registry.md).
- **Where validation happens** — build-time (schema) versus the standalone
  `validate-frontmatter.mjs` CI gate; how they overlap. Neither reads the registry
  for `type` today (that is the deferred authority above).
- **Version-sensitive spots** — the exact loader API for README-as-index and
  pointing the collection at repo-root `docs/`; both tracked against the pinned
  Astro/Starlight versions. See [ADR-0002](../adr/0002-readme-as-index.md).
- **Failure modes** — dangling `related` refs, missing required fields, a top-level
  content folder with no registry entry (appended to the sidebar with a humanized
  label — tolerated, degrades gracefully), and a registry entry with no folder
  (skipped from the sidebar). A duplicate section `id` is build-fatal; a duplicate
  `order` warns and tie-breaks by `id`.
