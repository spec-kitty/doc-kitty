---
work_package_id: WP04
title: ADR-number-ordered, status-aware Hub card (#50 IC-05)
dependencies: []
requirement_refs:
- FR-006
- FR-007
- NFR-004
planning_base_branch: feat/metadata-vocab-hub-consolidation
merge_target_branch: feat/metadata-vocab-hub-consolidation
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-vocab-hub-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-vocab-hub-consolidation unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
- T020
- T021
- T022
- T023
history:
- created by /spec-kitty.tasks
- amended by post-tasks adversarial squad (F5, F6 — number single-source + inclusion reconciliation)
agent_profile: frontend-freddy
authoritative_surface: src/
create_intent:
- src/tests/hub-adr-card.test.ts
execution_mode: code_change
owned_files:
- src/layouts/Hub.astro
- src/scripts/generate-adr-index.mjs
- src/styles/hub.css
- src/tests/hub-adr-card.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. You are a browser-side implementer with accessibility discipline — the badge must be legible/accessible in both themes.

## Objective

Make the ADR Hub card **order by ADR number** and show **full lifecycle status + date**, matching the generated own-tree table 1:1 — by **reusing one extractor** across the generator and Hub (single source for number, status, AND date), not by re-parsing. Independent of Lane A. Read `../spec.md` (FR-006, FR-007, NFR-004; C-005), `../plan.md` (IC-05), `../research.md` (Decision D3 + **D4 findings F5/F6**), and `../data-model.md`.

## Critical context (squad-verified — file:line)

- `Hub.astro:76-96`: builds `children` from `getCollection('docs')` reading only `entry.data`, sorts **alphabetically by title** (`:90-96`), and filters `isPublished` (`:84-89`, drafts excluded). It does NOT read bodies — use `entry.body` for ADR children.
- `generate-adr-index.mjs`: today derives **number from the FILENAME** (`ADR_FILE = /^(\d{4})-…/` on the basename, `discoverAdrs` `:89-108`), **status from the body** (`extractStatusToken`), **date from frontmatter**; and it **skips** number-less files and `type: Template` (`:94,:97`), regardless of `doc_status`. Hub has no filename — only `slugFromEntryId(entry.id)`.
- **F6 — number must be single-sourced too:** `extractAdrMeta` must be the SOLE source of `number` for BOTH callers. Route the generator's number derivation through the extractor as well (feed it the same `slug`/basename that carries the `NNNN-` prefix). Otherwise the generator parses number from filename while Hub parses from slug → a NEW split-brain on the exact field NFR-004 orders by.
- **F5 — reconcile inclusion so 1:1 is true, not falsifiable:** the generator includes every numbered non-Template ADR regardless of `doc_status`, while Hub filters `isPublished`. Align them: Hub's ADR grouping must **exclude number-less and `type:Template`** pages exactly as `discoverAdrs` does, and **NFR-004's 1:1 invariant is scoped to the published+numbered set** (a draft numbered ADR legitimately appears in the generated table but not the hub — call this out in the test, don't assert 1:1 across it). Do not silently append number-less ADR cards claiming parity.

## Subtasks

### T017 — Export the shared extractor from `generate-adr-index.mjs`
Refactor number+status+date parsing into an exported `extractAdrMeta(...)` used by the generator itself (number included, per F6). Prove the generator's output is byte-identical (`adr-index-generator.test.ts` green).

### T018 — Derive ADR meta + order by number in `Hub.astro`
For ADR-kind children, read `entry.body`, call `extractAdrMeta`, and sort by `number` ascending (that group only). Non-ADR children keep the existing section-rank→title sort. Exclude number-less + `type:Template` from the ADR group (F5, matching `discoverAdrs`).

### T019 — Render status badge + date
Badge Proposed/Accepted/Superseded/Deprecated + date on each ADR card, rendering the plain token (e.g. `Accepted`, not `**Accepted**`). Empty/unparseable status ⇒ unbadged (never break the hub).

### T020 — Gate to ADR-only + no regressions
Ordering/badging apply only to the ADR kind/section; non-ADR hubs byte-unchanged; the single-ADR example demo (`example/docs/adr/`) still renders correctly. Respect the existing Pagefind/search-coverage discipline in `Hub.astro` (no raw `<nav>`, keep child text indexable).

### T021 — Badge styles in `hub.css`
`--dk-*` tokens; legible contrast light + dark; preserve the card pattern's ≥24px target. No new dependency.

### T022 — Tests `src/tests/hub-adr-card.test.ts` (F5 render-real-output)
Render **Hub's actual ADR-child pipeline output** (order + badge + date) and compare to `extractAdrMeta`/the generated table — NOT `extractAdrMeta` vs itself. Rows: (a) ≥2 ADRs in number order; (b) status+date match the extractor 1:1 for the published+numbered set; (c) body-only `## Status` is reached (proves Hub reads `entry.body`); (d) a `superseded` badge renders; (e) empty-status → unbadged; (f) `type:Template` under `adr/` is excluded (no template card); (g) a **draft numbered ADR** is in the generated table but NOT the hub (documents the scoped invariant, F5); (h) a non-ADR hub is unaffected; (i) single-ADR demo unchanged.

### T023 — Single-source enforcement gate (F5)
Add an assertion (in `hub-adr-card.test.ts` or extend WP01's single-source gate pattern) that `Hub.astro` imports `extractAdrMeta` from `generate-adr-index.mjs` and contains **no** independent `## Status`/`\d{4}-` number-parsing regex — so a future re-parse reds the suite (NFR-001 for #50).

## Definition of Done
- `extractAdrMeta` is the sole source of number+status+date for both the generator and `Hub.astro`; generator output byte-identical (`adr-index-generator.test.ts` green).
- ADR hubs order by number, badge status+date, match the generated table 1:1 over the published+numbered set; number-less/Template excluded on both sides; non-ADR hubs + single-ADR demo unchanged.
- The fidelity test renders Hub's real output; the single-source gate reds on a re-parse.
- `hub-adr-card.test.ts` + `adr-index-generator.test.ts` green; Astro build + `astro check` green (or CI-verified with a note).
- `spec-kitty agent tasks mark-status T017 … T023 --status done`.

## Risks / reviewer guidance
- **New split-brain** is the headline risk (F6): reviewer confirms number/status/date ALL come from `extractAdrMeta`, not a Hub-local parse (T023 enforces).
- **Fidelity tautology** (F5): the test must exercise Hub's rendered output, not compare the extractor to itself.
- Confirm the draft/number-less/Template reconciliation so NFR-004's 1:1 is a true invariant over its scoped set.
