---
work_package_id: WP03
title: 'Persona-atomic: relocation + fields + hub + pins'
dependencies:
- WP01
requirement_refs:
- FR-010
- FR-011
- FR-012
- FR-013
- FR-022
- FR-023
planning_base_branch: feat/audience-related-external-references
merge_target_branch: feat/audience-related-external-references
branch_strategy: Planning artifacts for this mission were generated on feat/audience-related-external-references. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/audience-related-external-references unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
- T017
- T018
- T019
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: example/docs/context/audience/
create_intent:
- example/docs/context/audience/README.md
- src/tests/fixtures/persona/valid-persona.md
- src/tests/fixtures/persona/missing-role.md
execution_mode: code_change
owned_files:
- example/docs/context/audience/**
- src/scripts/validate-frontmatter.mjs
- src/layouts/Persona.astro
- src/tests/fixtures/persona/**
- src/tests/schema-validator-parity.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its
initialization, boundaries, directives, and tactics. Then read this WP,
[../spec.md](../spec.md), `docs/adr/0019-persona-attribute-fields.md`,
`docs/adr/0020-persona-location-reconciliation.md`, and
`docs/architecture/metadata-model.md`.

## Objective

Reconcile personas to `context/audience/` with attribute fields, add an Audiences
hub, and keep **every gate green at this WP's boundary** (C-007). This is the
hazard-dense atomic WP: the relocation, the four hard-coded gate sites, and the count
pins move **together**.

## Subtasks

### T013 — Relocate the example persona
`git mv example/docs/personas/example-persona.md
example/docs/context/audience/<slug>.md` (and its asset). Reconcile `type: Guide` →
`Context`; promote `doc_status: draft` → `active`. No file remains under
`example/docs/personas/`.

### T014 — Persona-field requiredness (validator) [P]
In `src/scripts/validate-frontmatter.mjs` (path/kind-aware), when `kind === Persona`
require non-empty `role` (string), `goals` (string[]), `responsibilities` (string[]);
error otherwise. The zod schema stays lenient (WP01) — requiredness lives here
(parity discipline).

### T015 — Persona passport renders fields [P]
`src/layouts/Persona.astro` renders `role`/`goals`/`responsibilities` in the in-frame
passport (ADR-0011: in-frame, not `splash`). Reuse the existing `.dk-passport`
markers; keep AA (text labels, no colour-only).

### T016 — Audiences hub
`example/docs/context/audience/README.md` — `kind: Hub`, `type: Context`, published —
listing the persona page(s) as described links via the existing `Hub` layout (no new
Starlight override). Populate `role`/`goals`/`responsibilities` on the relocated
persona so it renders and lists cleanly.

### T017 — Retained draft demonstrator
Keep exactly one **draft** example page as the US5 draft-exclusion subject (the
persona is no longer draft). Simplest: a second `kind: Persona` page under
`context/audience/` with `doc_status: draft` (drafts are excluded from the hub list,
index, RSS, sitemap). Confirm it stays out of those surfaces.

### T018 — Rewrite the four hard-coded sites + recompute count pins
Out-of-map edits (owned by WP06; **rationale**: the atomic relocation must rewrite
these in the same WP to keep gates green — WP06 depends transitively on WP03, so no
parallel collision):
- `src/scripts/assert-chrome-artifacts.mjs` — `PERSONA_PAGE` (:188) and
  `PERSONA_FRAGMENT_URL` (:190) → the new `context/audience/<slug>/` path. **Also fix
  the stale rationale comment (:185–187)** that calls the persona a *draft* — it is
  now `active`.
- `tests/a11y/routes.ts` — `ROUTES.persona` (:13) and the `AXE_PAGES` entry (:22) →
  the new route.
- `src/scripts/assert-build-artifacts.mjs` — recompute `EXPECTED_INDEX_ENTRY_COUNT`
  (:54) and `EXPECTED_SITEMAP_URL_COUNT` (:57) as an **interim** pin for this WP's
  published delta (persona promoted +1, hub +1, retained draft 0 → baseline 12 → 14).
  **WP06 owns the FINAL pin** (it adds the demonstrator + stale-target). **Also
  correct the authoring cross-check comment (~:40–61)**: the tree currently holds
  **14** `.md` files with **two** drafts (`adr/template.md` + the persona), i.e.
  14 − 2 = 12 — the existing "13 files / one draft" narrative is wrong and must not be
  inherited into the recompute. **Show the derivation** (published `.md` count minus
  drafts) in the review notes so the pin is corroborated, not self-referential.

The pin gate only detects drift from the constant, not truth — so the derivation is
the real check. Keep the mechanical edits minimal (paths + numbers + the two comment
corrections). WP06 later extends these files for the block/demonstrator assertions.

### T019 — Persona parity fixtures [P]
`src/tests/fixtures/persona/valid-persona.md` (all fields) and `missing-role.md`
(rejected by the validator). Wire them into `src/tests/schema-validator-parity.test.ts`
(now WP03-owned) in the **correct buckets**: `valid-persona.md` → `SHAPE_PARITY`
(both build schema and validator accept). `missing-role.md` → **`PRESENCE_LENIENT`**
(the zod schema is lenient/accepts — WP01 keeps persona fields optional — while the
standalone validator rejects), exactly like `missing-kind.md`. Do **not** put
`missing-role.md` in `SHAPE_PARITY` — it asserts build/gate agreement and would red.

## Branch Strategy

Planning branch and final merge target: `feat/audience-related-external-references`.
Worktree per `lanes.json`; changes merge back into the mission branch.

## Definition of Done

- No persona under `example/docs/personas/`; the persona lives at
  `context/audience/<slug>/`, `type: Context`, `doc_status: active`, renders its
  attribute fields, and is listed on the Audiences hub.
- The validator rejects a persona missing a required field; parity fixtures pass.
- All four hard-coded sites rewritten; count pins recomputed + cross-checked.
- One draft page retained and absent from index/RSS/sitemap.
- `doc-sanity`, `build-example`, and `a11y` all green at this WP's boundary.

## Risks & reviewer guidance

- **Atomicity is the point** — a `git mv` without T018 reds a11y + chrome. Reviewer:
  confirm move + all four sites + count pins landed together.
- **Count math**: verify the pins match `example/docs/` exactly (the failure message
  in `assert-build-artifacts.mjs` tells you the observed vs expected).
- **Out-of-map edits**: T018 touches WP06-owned files by necessity; the edits are
  minimal and rationale-recorded. Do not add block/demonstrator assertions here —
  that is WP06.
