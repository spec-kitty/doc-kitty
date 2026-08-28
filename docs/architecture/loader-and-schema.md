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
  - Enum validation for `status`. `type` is an open vocabulary: a value is checked
    against the canonical set (`DOC_TYPES`) and against the **section-default `type`
    derived from the `sections.yaml` registry** (`expectedTypeForPath` in
    `schema.ts`, `expectedDocType` in `metadata.ts`); both checks are advisory
    (warn, never fail), and a registry-less tree falls back to the frozen
    section-type map (issue #24 — see below).
  - Optional families: `authors`, `related`, `tags`, `sources`, and the Kitty
    `agent` block.
  - The bundle-root exemption: `docs/README.md` carries `okf_version`, not
    `type`.
- **`type`-to-section derivation (WIRED)** — a page's expected `type` comes from the
  registry entry for its section, refined by a short sub-path subtype table kept in
  code. This is **wired** (issue #24): `sectionTypes` → `expectedDocType` →
  `expectedTypeForPath`. Only moving the sub-path subtypes into a registry
  `subtypes` field remains deferred. The full rule is in
  [section-registry.md](./section-registry.md).
- **Where validation happens** — build-time (schema) versus the standalone
  `validate-frontmatter.mjs` CI gate; how they overlap. **Both** now derive the
  section-default `type` from the registry (issue #24), each with its own copy of the
  sub-path subtype table (the `.mjs` gate cannot import the TS module in bare Node).
- **Version-sensitive spots** — the exact loader API for README-as-index and
  pointing the collection at repo-root `docs/`; both tracked against the pinned
  Astro/Starlight versions. See [ADR-0002](../adr/0002-readme-as-index.md).
- **Failure modes** — dangling `related` refs, missing required fields, a top-level
  content folder with no registry entry (appended to the sidebar with a humanized
  label — tolerated, degrades gracefully), and a registry entry with no folder
  (skipped from the sidebar). A duplicate section `id` is build-fatal; a duplicate
  `order` warns and tie-breaks by `id`.
