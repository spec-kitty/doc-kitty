---
title: Plans
description: Forward-looking mission write-ups for the example docsite — not the current state (see architecture/).
doc_status: draft
updated: 2026-09-03
type: Plan
kind: Hub
---

# Plans

Forward-looking work for the example site: short mission write-ups live under
`plans/missions/`. Unlike every other section in this example, this section
has **no** `README.md` — `plans/index.md` is its section index instead
(FR-012/SC-001). It resolves to `/plans/`, exactly like a `README.md`-indexed
section resolves to its own root, and the two conventions coexist in the same
build (this is the mixed-corpus proof: every other section here still uses
`README.md`, unchanged).

- [Mission Alpha](./missions/mission-alpha/) — this folder was renamed from
  `plans/features/` to `plans/missions/` as a **registry-data-only** change
  (SC-002): a `git mv` plus one `subtypes` rule in
  `example/docs/_meta/sections.yaml`, no derivation code touched.
- [Mission Beta](./missions/mission-beta/)
