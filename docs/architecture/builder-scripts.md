---
title: Builder scripts
description: The command-line scripts that scaffold a docs tree, add a page, and validate frontmatter as a CI gate.
status: draft
updated: 2026-08-21
type: Architecture
tags: [scripts, tooling, ci]
related:
  - architecture/overview
  - architecture/loader-and-schema
---

# Builder scripts

The toolkit ships three Node scripts that operate on a Common Docs — Kitty tree
from the command line: one scaffolds the tree, one adds a single page, and one
validates frontmatter as a build-free CI gate. This page expands the scripts the
[overview](./overview.md) lists.

<!-- Outline — to be fleshed out. One short section per script. -->

- **`scaffold.mjs`** — emits the fixed, ordered section tree with seed
  `README.md` indexes; the starting point for a new docs repo.
- **`new-doc.mjs`** — creates one page in the right section with correct
  required frontmatter and a `type` that matches its path.
- **`validate-frontmatter.mjs`** — the CI gate: checks required fields, enum
  values, `type`-by-path, and bounded `description` length, build-free so doc
  problems are caught before any Astro build.
- **How they relate to the schema** — the scripts and the build-time schema
  enforce the same contract from the [loader and schema](./loader-and-schema.md);
  note where they overlap and where the validator goes further.
- **Where they run** — locally for authors, and in the doc-sanity CI lane; see
  the [CI/CD pipeline plan](../plans/features/ci-cd-pipeline.md).
