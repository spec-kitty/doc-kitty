---
work_package_id: WP09
title: Integration, gates & rollout
dependencies:
- WP01
- WP02
- WP03
- WP04
- WP05
- WP06
- WP07
- WP08
requirement_refs:
- FR-012
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-005
- NFR-006
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T034
- T035
- T036
- T037
- T038
history:
- created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/
create_intent:
- docs/changelog/2026-09-08-ars-rethorica-example.md
execution_mode: code_change
owned_files:
- src/scripts/assert-build-artifacts.mjs
- tests/a11y/routes.ts
- docs/plans/features/example-content-ars-rethorica.md
- docs/plans/roadmap.md
- docs/changelog/2026-09-08-ars-rethorica-example.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply identity/boundaries + charter directives (`spec-kitty charter context --action implement --json`); state which applied. This WP runs LAST and closes the mission's gates.

## Objective

Integrate the showcase: move the build-artifact ratchet, opt representative pages into the a11y lane, run and green the full gate suite, and record the rollout. **Depends on all prior WPs being merged into the base.** Read `../spec.md` (FR-012, NFR-001..006), `../plan.md` (IC-07), `../research.md` (D7), and `../quickstart.md`.

### T034 — Bump the build-artifact ratchet
In `src/scripts/assert-build-artifacts.mjs`, after a clean build, count the **non-draft** pages the showcase adds (rhetoric hub, Book I/II/III landings, about/license, introduction, preamble, 15 chapters, the generated `glossary/rhetoric/index.md`, and each active persona) and bump BOTH `EXPECTED_INDEX_ENTRY_COUNT` and `EXPECTED_SITEMAP_URL_COUNT` by that exact delta. Draft fixtures (WP01's footnote fixtures) must NOT be counted. Derive the delta empirically: `pnpm clean && pnpm --filter example build && pnpm assert:artifacts example/dist` — the gate prints expected-vs-got; reconcile until it passes. Update the running derivation comment at the top of the file.

### T035 — Opt rhetoric routes into the a11y lane
In `tests/a11y/routes.ts` add ~2 representative routes to `ROUTES` and the axe set: a Book I chapter that carries footnotes + a `{blurb}` callout (e.g. `/rhetoric/book-one/chapter-01/`) and the rhetoric hub (`/rhetoric/`). Add named constants (auditable diff) with `guardRoots` matching the Starlight chrome. Both light+dark run automatically.

### T036 — Full gate suite + fix
Run the full suite from a lane worktree (`pnpm install --offline`, `pnpm clean` first) per `../quickstart.md`: `pnpm --filter @commondocs-kitty/toolkit test` + `typecheck` + `lint`; `pnpm validate:example|links|catalog|adr-index`; `pnpm --filter example build` then `pnpm assert:artifacts example/dist`, `assert:no-broken-links`, `assert:markua`; `pnpm test:a11y`; `npx markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"`; `vale --minAlertLevel=error docs example/docs`. Fix any failures **within owned files where possible**; a lint/link fix that must touch a content page is a small, recorded out-of-map edit (note it). Confirm **NFR-001**: `DK_MARKUA=off` build byte-identical to pre-mission (diff dist trees or reason precisely).

### T037 — Rollout docs
- Update `docs/plans/features/example-content-ars-rethorica.md`: `doc_status: draft` → `active` (and refresh `updated`).
- Update the roadmap row (`docs/plans/roadmap.md:95`) to reflect shipped status (e.g. mark delivered / link the showcase).
- Add `docs/changelog/2026-09-08-ars-rethorica-example.md` (follow the dated-entry format of existing changelog files; description ≤180 chars — CI doc-sanity enforces frontmatter limits).

### T038 — Final SC verification
Verify every Success Criterion (SC-001..007 in `../spec.md`) explicitly, e.g.:
`grep -REl '\[\^\^|\{blurb|\{/blurb\}|\{pagebreak\}|\{mainmatter\}|\{class: part\}' example/dist` → **no HTML hits** (SC-002). Record which checks ran locally vs must be confirmed by CI.

## Definition of Done
- Both ratchet counts bumped by the exact non-draft delta; `assert:artifacts` green.
- ~2 rhetoric routes axe-covered (light+dark) with 0 serious/critical violations.
- Full gate suite green (or CI-verified with a precise note); NFR-001 byte-identity confirmed.
- Feature `doc_status: active`; roadmap updated; changelog entry added.
- `spec-kitty agent tasks mark-status T034 T035 T036 T037 T038 --status done`.

## Risks / reviewer guidance
- Reviewer: independently confirm the ratchet delta matches the actual published-page count (miscount = red CI); confirm the a11y routes actually render the footnote/callout apparatus; confirm NFR-001 byte-identity; confirm no literal Markua markers in dist (SC-002).
- Env hazards: `pnpm clean` before builds (stale `.astro`); clear stray `example/dist*` before `astro check`; run vitest `--no-file-parallelism` if the concurrent-build tests flake.
