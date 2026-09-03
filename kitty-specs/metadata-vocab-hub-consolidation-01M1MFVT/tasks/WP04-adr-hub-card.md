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
history:
- created by /spec-kitty.tasks
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

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. You are a browser-side implementer with accessibility discipline — the status badge must be legible and accessible in both themes.

## Objective

Make the ADR Hub card **order by ADR number** and show **full lifecycle status + date**, so a multi-ADR rendered hub matches the generated own-tree table 1:1 — achieved by **reusing the ADR-index generator's extraction** (single source), not by re-parsing independently. Independent of Lane A (runs in parallel). Read `../spec.md` (FR-006, FR-007, NFR-004; C-005), `../plan.md` (IC-05), `../research.md` (Decision D3), and `../data-model.md` (ADR entry + extractor contract).

## Critical context (file:line)

- `src/layouts/Hub.astro` today: builds `children` from `getCollection('docs')` reading only `entry.data` (frontmatter), and **sorts alphabetically by title** (`:90-96`, `a.data.title.localeCompare(b.data.title)`). It does **not** read page bodies — so a body-only `## Status` is currently unreachable. Astro content entries expose `.body` (raw markdown); use it for ADR children.
- `src/scripts/generate-adr-index.mjs` already extracts ADR number + `## Status` + date at full fidelity for the generated own-tree table. **Export** that extraction as a reusable function (e.g. `extractAdrMeta(rawMarkdown, {slug, frontmatter}) → {number,status,date}|null`) and have BOTH the generator and Hub.astro call it — this is what makes the rendered hub and the generated table agree by construction (NFR-004). Keep the generator's existing output byte-identical (its tests `adr-index-generator.test.ts` must stay green).
- ADR children are identified by kind/section — inspect how ADRs are tagged (frontmatter `kind`, or the `adr/` section). Gate all new ordering/badging behind that check so **non-ADR Hub listings keep alphabetical-by-title** (C-005).
- Styling uses `src/styles/hub.css` (imported at `Hub.astro:54`) and the `--dk-*` token catalog. Search coverage (Pagefind/NFR) discipline in the existing file's header comment still applies — do not wrap content in a raw `<nav>`.

## Subtasks

### T017 — Export the shared extractor from `generate-adr-index.mjs`
Refactor the generator's inline number/status/date parsing into an exported `extractAdrMeta(...)`; the generator calls it. Prove the generator's output is unchanged (`adr-index-generator.test.ts` green).

### T018 — Derive ADR meta + order by number in `Hub.astro`
For ADR-kind children, read `entry.body`, call `extractAdrMeta`, and sort ADR children by `number` ascending (replacing the alphabetical sort for that group only). Non-ADR children keep the existing section-rank then title sort.

### T019 — Render status badge + date
Add a lifecycle status badge (Proposed / Accepted / Superseded / Deprecated) and the date to each ADR card. Missing number or unparseable `## Status` ⇒ render the card unbadged / appended at the end — never break the hub.

### T020 — Gate to ADR-only + no regressions
Ensure the ordering/badging only applies to the ADR kind/section; the single-ADR example demo (`example/docs/adr/`) still renders correctly; non-ADR hubs are byte-unchanged.

### T021 — Badge styles in `hub.css`
Add badge styling using `--dk-*` tokens; legible contrast in light and dark; ≥24px hit-area rules of the existing card pattern preserved. No new dependency.

### T022 — Tests `src/tests/hub-adr-card.test.ts`
Cover: (a) ≥2 ADRs render in ADR-number order; (b) status + date match `extractAdrMeta`/the generated table 1:1 (NFR-004); (c) missing number/status falls back gracefully; (d) a non-ADR hub is unaffected; (e) the single-ADR demo does not regress.

## Definition of Done
- `extractAdrMeta` is the single source used by both the generator and `Hub.astro`.
- ADR hubs order by number and show status + date matching the generated table 1:1; non-ADR hubs and the single-ADR demo are unchanged.
- `hub-adr-card.test.ts` + `adr-index-generator.test.ts` green; Astro build green (or CI-verified with a note if local `node_modules` is broken).
- `spec-kitty agent tasks mark-status T017 … T022 --status done`.

## Risks / reviewer guidance
- **New split-brain risk**: if Hub.astro re-parses ADR status instead of reusing `extractAdrMeta`, it recreates exactly the kind of divergence this mission exists to remove — reviewer must confirm single-sourcing.
- Fidelity is the headline assertion (NFR-004): the test must compare against the generator's extractor output, not a hand-written expectation, so drift is caught.
- Respect the existing Pagefind/search-coverage comment in `Hub.astro` — do not regress indexability with the badge markup.
