---
title: Section registry wired — Reference nav group
description: The docs/_meta/sections.yaml registry now drives the sidebar and the discovery surfaces; the glossary ships under a named "Reference" group.
doc_status: active
updated: 2026-08-28
type: Changelog
kind: Changelog
tags: [sections, registry, sidebar, navigation, glossary]
related:
  - architecture/section-registry
  - architecture/loader-and-schema
  - architecture/glossary
---

# 2026-08-28 — Section registry wired: Reference nav group

**The `docs/_meta/sections.yaml` registry is no longer inert.** A loader now reads it
and drives both the Starlight sidebar and the discovery surfaces, so relabelling or
reordering a nav group is a data edit rather than a code change. The visible outcome:
the glossary ships under a named **"Reference"** nav group (issue #18, closing the
FR-013 gap and the DIRECTIVE_044 split-brain).

## What changed

- **A registry loader.** `src/lib/sections.ts` parses `_meta/sections.yaml` once into
  an ordered, validated section list. A duplicate `id` is build-fatal; a duplicate
  `order` warns and tie-breaks by `id`; a missing registry returns a graceful `null`
  so a docs root without one still builds.
- **The sidebar is registry-driven.** With no explicit `sidebar`, the preset now
  synthesizes named, ordered groups from the registry, each `autogenerate`-ing from
  its section folder. A section is relocatable or relabelable by editing the registry
  alone — no content move, no theme edit. A folder with no registry entry is still
  shown (appended with a humanized label); a registry-free site keeps Starlight's
  bare tree-autogeneration unchanged.
- **The glossary ships under "Reference".** The example registry gives the `glossary`
  section `label: Reference`; its content folder stays `glossary/`. The sidebar,
  `llms.txt`, the RSS `<category>` fallback, and the agent-API index all group it
  under "Reference" and rank it with a finite section order.
- **`metadata.ts` stayed pure.** `sectionRank`, `sectionLabel`, and `rankForAgents`
  now take the resolved order/labels as arguments and fall back to the frozen
  `SECTION_ORDER` / `SECTION_LABEL` constants when omitted, so the module remains
  Astro-free and fs-free.

## Deferred

- **`type`-from-registry** as a validation authority (ADR-0004/FR-003) — the `type`
  field is parsed and carried but not yet consumed.
- **`feeds`** as a per-surface filter — parsed and carried, not yet applied.

## Notes for consumers

- If your docs tree has a `_meta/sections.yaml`, your sidebar becomes registry-driven
  (named, ordered groups). Passing an explicit `sidebar` still wins. With no registry
  file, nothing changes.
- The visual-regression baseline for the example site's sidebar changes with this
  work and must be regenerated in the pinned Playwright container.

Refs #18
