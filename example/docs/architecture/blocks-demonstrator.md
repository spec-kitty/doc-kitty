---
title: Content blocks demonstrator
description: A single page that declares audience, related, and external references so all three doc-kitty content blocks render together for the accessibility lane.
doc_status: active
updated: 2026-08-24
type: Architecture
kind: Explanation
tags: [architecture, blocks, demonstrator, fixture]
audience:
  - profile: example-persona
    guidance_text: Follow the three blocks below to see how audience, related, and citation metadata render.
related:
  - architecture/superseded-note
  - architecture/overview
external_references:
  - url: https://diataxis.fr
    title: The Diataxis documentation framework
    note: an inline reference — self-contained, carries no catalog citation key
  - type: biblio
    id: divio-2017
---

# Content blocks demonstrator

This page exists to render all three doc-kitty content blocks on one route so the
accessibility lane can scan them together (post-spec R1). It declares:

- an **audience** block linking the relocated
  [example persona](/context/audience/example-persona/), so the audience
  `<section>` renders a heading and a reader list;
- a **related** block pointing at the
  [superseded architecture note](/architecture/superseded-note/) — a real `superseded` page, so
  its Related card carries the stale-target status marker — plus the
  [architecture overview](/architecture/overview/) as a normal, current target;
- an **external references** block with one inline reference (no catalog key) and
  one catalog citation resolved from the bibliography, so a resolved title and a
  mono citation key both appear.

The blocks self-resolve from this page's frontmatter (ADR-0017): nothing on this
page is hand-authored HTML — the three regions below are rendered by the carrier
bodies from the metadata above.
