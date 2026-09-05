---
title: Mission Alpha
description: A short mission write-up used to demonstrate the registry subtypes rename (plans/features -> plans/missions).
doc_status: draft
updated: 2026-09-03
type: Mission
kind: Planning
related:
  - plans/missions/mission-beta
---

# Mission Alpha

The `type: Mission` above is not a code-derivation special case — it agrees
with what the section registry ALREADY derives for this path: the `plans`
section defaults to `Plan`, and the `missions` `subtypes` rule in
`example/docs/_meta/sections.yaml` overrides it to `Mission` for every page
under `plans/missions/`. That registry rule is the only reason this path
derives `Mission` instead of falling through to the built-in
`plans/features` -> `Feature` table.

See also [Mission Beta](/plans/missions/mission-beta/).
