---
title: Missions and Ops pages
description: "Generated pages for a kittified repository's Spec Kitty missions and Ops, at core's scale: a status hub, a page per mission and a monthly Op ledger."
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: Feature
kind: Feature
moscow:
  level: Could
  rationale: Core dropped its DocFX mission dashboards when it moved to doc-kitty (core #6941), and kittified repositories want their mission status next to their docs. It depends on the large-hubs feature and on an export from core.
tags: [portal, missions, ops, generated, kittified]
related:
  - architecture/research/missions-and-ops
  - architecture/research/mission-status-portal
  - plans/features/large-hubs
  - plans/features/packs
---

# Missions and Ops pages

A kittified repository's missions and Ops, rendered as generated pages: a status
hub at `/missions/`, one page per mission with its work packages, issues, PRs and
Ops, and one Op ledger page per month. It reuses the shape of the
[packs feature](./packs.md): one reader over a vendored contract, a generated
section owned through the producer registry, and a `--check` drift gate.

Scope: Extended.

Design: [Missions and Ops as generated pages](../../architecture/research/missions-and-ops.md).
The earlier [mission status portal](../../architecture/research/mission-status-portal.md)
research is partly superseded by it.

## Goals

- Core's 835 missions and about 3,900 Ops render without a sidebar or HTML-size
  blow-up, which is what [Large hubs](./large-hubs.md) provides.
- A reader sees each mission's state, work packages, linked issues and PRs, and
  the Ops that worked on it.
- doc-kitty runs no Spec Kitty code at build time (ADR-0042).
- Nothing private is published: Op prompts never, and mission bodies only by
  allow-list.

## Non-goals

- A live dashboard. Pages show the state as of the build.
- Editing missions or Ops.
- A page per work package, or a page per Op by default.

## Slices

1. **ADR: missions and Ops through a mission-status contract reader.** The
   reader, the export versus file adapters, `MissionModel` and `OpModel`, the page
   tree, publication rules and the leak gate (completing ADR-0006 for generated
   surfaces). *Done when* the operator accepts it.
2. **Mission reader.** `src/lib/missions/`, a vendored snapshot of core's
   mission-status contract with its conformance fixtures and a lock, the export
   adapter, the file adapter labelled "snapshot, unverified",
   `dockitty-read-mission --json`, and the producer registry from #330. *Done
   when* the conformance fixtures pass, a numbered mission and a `01M…` mission
   from fixtures both map to the model, WP state and execution lanes stay
   distinct, and an unknown schema major is a warning plus a facts-only model.
3. **Mission pages and status hub.** `/missions/<slug>/` with spec and plan
   sub-pages, the WP table, issues and PRs, an ID redirect, the `missions.publish`
   allow-list and the leak gate, on top of the large-hubs listing. *Done when*,
   on a fixture tree, every published mission has a page; a denied file class
   fails `--check`; a mission outside the allow-list emits nothing at all; and the
   hub lists every mission through the paged listing.
4. **Op ledger.** Monthly ledger pages and JSON, per-mission Op panels,
   `ops.include` and `ops.recent`, and agent-only feeds. `request_text` never
   reaches a page or a JSON file. *Done when* the fixture ledger has one page per
   month; a test fails if any output contains a fixture prompt string; and only
   linked or recent Ops appear under the default config.

Every slice also ships Vitest tests, an example fixture asserted on built output,
a configuration page and a changelog fragment.

Order: the [Large hubs](./large-hubs.md) slices 1 and 2 first, which ship on
their own. Then slice 1, 2, 3 and 4 here. Slices 2 and the large-hubs slices 3
and 4 can run in parallel.

## Asks for core

Not filed. For the operator to approve:

| Ask | Needed by |
|---|---|
| `spec-kitty mission export --json`: every mission's overview and detail, with a cursor, runnable in CI | Slice 2's authoritative adapter |
| A published release of the mission-status contract and its conformance fixtures | Slice 2 pinning |
| A structured `mission_id` and `wp_id` on every Op that belongs to a mission | Slice 4's per-mission panels |
| A declared field that marks a mission private | Slice 3's publication rules |
| Use the large-hubs listing for core #6941 (mission and glossary card grids) | Core's docsite |

## Tracking proposal

Two epics, because the generic feature ships and helps on its own:

- **Epic: Large hubs.** Children are its four slices, in order. It has no
  dependency on Spec Kitty and serves packs (#328), Gherkin sections and core's
  #6941. Label `epic`.
- **Epic: Missions and Ops pages.** Children are the four slices above. Slice 3
  is blocked by the large-hubs slices 1 and 2. A "Related" link to #328 records
  the shared reader and producer-registry pattern (#330).
- **Cross-repo asks** live as a table in this plan until the operator approves
  them, then as issues in spec-kitty core, each linked from the missions epic.
- This page's slice list is the source the issue bodies are written from, as the
  packs plan is for #328.
