---
title: Common Docs rendering (README-as-index)
description: "Render the docs/ tree as a site, using each folder's README.md as its section index page."
doc_status: draft
updated: 2026-08-22
type: Feature
kind: Feature
moscow:
  level: Must
  rationale: The base of the toolkit; a docsite that does not render the tree is nothing.
tags: [rendering, core]
related:
  - context/convention
  - architecture/loader-and-schema
---

# Common Docs rendering (README-as-index)

Read a Common Docs `docs/` tree and render it as a browsable site, treating each
folder's `README.md` as that section's index page.

Scope: MVP.

Design: [the convention](../../context/convention.md) and
[loader and schema](../../architecture/loader-and-schema.md).
