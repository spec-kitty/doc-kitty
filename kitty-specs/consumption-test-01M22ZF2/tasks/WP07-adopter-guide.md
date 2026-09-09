---
work_package_id: WP07
title: Adopter consumer-path guide + roadmap link + path lint
dependencies:
- WP01
- WP02
requirement_refs:
- FR-008
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T027
- T028
- T029
history:
- created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/guides/
create_intent:
- docs/guides/consumer-setup.md
- tests/consumption/scripts/assert-guide-no-internal-paths.mjs
execution_mode: code_change
owned_files:
- docs/guides/consumer-setup.md
- tests/consumption/scripts/assert-guide-no-internal-paths.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load scribe-sally` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_010 (spec fidelity), the docs convention (`docs/context/convention.md`), and curated-not-wiki doc honesty.

## Objective

Document the reproducible consumer/adopter path — install → configure → theme → build —
using **only published toolkit entrypoints**, machine-linted, and linked from the
roadmap. This turns the fixture into adopter-facing enablement (SC-005).

Read first: `../quickstart.md` (the shipped adopter path is drafted there), `../plan.md`
(IC-08), the WP01 fixture and WP02 theme as the worked reference. Follow the docs
convention (frontmatter `title/description/doc_status/type/kind/updated/authors`).

## Subtasks

### T027 — `docs/guides/consumer-setup.md`
Write the guide from `quickstart.md`'s "How an external adopter reproduces this"
section, expanded: `pnpm add @commondocs-kitty/toolkit astro @astrojs/starlight
@astrojs/sitemap`; the minimal `astro.config.mjs` (via `@commondocs-kitty/toolkit/config`);
`src/content.config.ts` (from `/schema`, `base` = integration `base`); the `src/pages/*`
route endpoints (from `/routes`); a consumer theme (`extends` + object `--dk-*` tokens +
a `press.css` with `:root` + `:root[data-theme='dark']`, never a `--sl-*` key); `astro
build`. Every step references a **published entrypoint or a consumer-owned file** — no
`../src` or repo-internal path. Note the `check-links` base-relative-mode caveat (no
strict-check parity with `example/`).

### T028 — Link from the roadmap (documented out-of-map edit)
Add a link to `docs/guides/consumer-setup.md` from the "Where we are now (2026-09-09)"
section of `docs/plans/roadmap.md` (item 2, the consumption test / consumer path). This
is a **one-line, justified out-of-map edit**; record the rationale in the WP history.

### T029 — Guide-path lint
`tests/consumption/scripts/assert-guide-no-internal-paths.mjs`: assert
`docs/guides/consumer-setup.md` contains **no** `../src` / repo-internal toolkit path
(machine-checks SC-005, mirrors INV-1). Exit non-zero with the offending line on a hit.

## Definition of Done
- The guide builds under the toolkit docsite, validates, and references only published
  entrypoints / consumer-owned files (lint green).
- Roadmap "Where we are now" links the guide.
- `assert-guide-no-internal-paths.mjs` passes and would fail if a `../src` path were added.

## Reviewer guidance
Follow the guide mentally against the WP01 fixture — every step must be reproducible with
only published entrypoints. Confirm the lint catches an injected `../src` path.

## Branch Strategy
Planning branch and merge target: `feat/release-0.1.0-consumption-readiness`. Depends on
WP01, WP02. Execution worktrees per `lanes.json`. Implement with `spec-kitty agent action implement WP07 --agent claude`.
