---
title: "ADR-0029: The registry sidebar prefixes autogenerate directories with docsDir"
description: The registry sidebar prefixes each autogenerate directory with docsDir to compensate Starlight's hard-coded src/content/docs route-matching root — a version-pinned coupling.
doc_status: active
updated: 2026-08-28
type: ADR
kind: ADR
authors:
  - stijn@spec-kitty.ai
related:
  - architecture/section-registry
  - adr/0004-amend-common-docs-as-extensible-variation
---

# ADR-0029: The registry sidebar prefixes autogenerate directories with `docsDir`

## Status

Accepted. Implements the FR-013 registry-driven sidebar (issue #18) against the
constraint documented below. Follows [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md),
which introduced the section registry.

## Context

`defineDocKittyIntegrations()` synthesizes a Starlight `sidebar` from
`docs/_meta/sections.yaml`, one named, ordered group per section, each an
`autogenerate: { directory }`. The obvious form is `directory: '<section-id>'` (the
registry id maps 1:1 to a top-level folder).

That bare form renders **every group empty** — no hub link, no child pages.
Starlight matches an `autogenerate` group's routes by a path computed relative to a
content root that is **hard-coded** to `src/content/docs`
(`@astrojs/starlight` `utils/collection.ts` `getCollectionPathFromRoot`, whose own
comment admits it "relies on the content collection folder structure to be fixed").
doc-kitty serves the Common Docs tree from the repo `docs/` via a custom glob loader
(`docKittyDocsLoader`), so Astro's non-legacy content layer records each route's
`filePath` as `docs/<section>/…` (project-root-relative). Starlight's attempt to
strip the `src/content/docs/` prefix never matches, so the compared path stays
`docs/<section>/…`, and a bare `directory: '<section>'` matches neither
`=== '<section>'` nor `startsWith('<section>/')`.

## Decision

Prefix each group's autogenerate directory with the `docsDir` option:
`autogenerate: { directory: '<docsDir>/<id>' }` (e.g. `docs/glossary`). This lines
the directory up with the un-stripped `filePath`, so each group resolves its hub
`/<id>/` **and** all child pages. Hidden pages (`sidebar: { hidden: true }`, e.g. a
deck) remain filtered by Starlight's `treeify`, so the deck exclusion is preserved.

The prefix is injected only at the sidebar-synthesis boundary
(`RegistryToSidebarOptions.directoryPrefix`); the registry `id → folder` contract
stays `docsDir`-agnostic.

## Consequences

This is a deliberate, fenced coupling to Starlight's internal path handling:

- **Version-pinned.** Correct only while Starlight keeps the hard-coded
  `src/content/docs` root. The `@astrojs/starlight` peer range is capped
  `>=0.32.0 <0.33.0`, so a Starlight that fixes this fails **loudly at install**
  rather than silently emptying a consumer's sidebar. Raising the cap requires
  re-verifying (and likely dropping) the prefix.
- **Non-legacy collections.** Relies on Astro's non-legacy content layer
  (project-root-relative `filePath`). Under `legacy.collections` the route path is
  the bare `route.id` and the prefix would re-empty the group.
- **`docsDir == loader base` invariant.** The prefix is the `docsDir` option, which
  MUST equal the `base` passed to `docKittyDocsLoader`; if they diverge the groups
  silently empty. Documented on `DocKittyOptions.docsDir`.
- **Guarded by a build assertion.** `assert-chrome-artifacts.mjs` (BA-11) asserts a
  deep child link (`/architecture/overview/`) is present in the rendered sidebar, so
  an empty-group regression — from a Starlight bump or a misconfig — fails the build
  loudly instead of shipping hub-only navigation.

Alternatives rejected: reconfiguring Starlight's content root (not configurable);
a loader-level fix (the loader cannot influence Starlight's hard-coded assumption).
