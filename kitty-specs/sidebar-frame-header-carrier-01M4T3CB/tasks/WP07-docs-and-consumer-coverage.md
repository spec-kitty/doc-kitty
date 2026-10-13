---
work_package_id: WP07
title: Decision records, documentation and packed-consumer coverage
dependencies:
- WP01
- WP02
- WP03
- WP04
- WP05
- WP06
requirement_refs:
- FR-026
- FR-027
- FR-029
- FR-030
- C-006
- C-007
- SC-004
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-sidebar-frame-header-carrier-01M4T3CB
base_commit: 4a8ca5e8a7948bbc6e95d7db4dd60a8313b6ef9b
created_at: '2026-10-13T09:55:23.847217+00:00'
subtasks:
- T037
- T038
- T039
- T040
- T041
- T042
history: []
agent_profile: implementer-ivan
authoritative_surface: docs/
create_intent:
- docs/adr/0044-header-carrier.md
- docs/adr/0045-frame-width-token.md
- docs/guides/draft-publication.md
- docs/guides/theme-header.md
execution_mode: code_change
owned_files:
- docs/adr/0044-header-carrier.md
- docs/adr/0045-frame-width-token.md
- docs/adr/0013-m1-chrome-substrate-single-layer.md
- docs/adr/0015-m2-slot-resolution-and-components-map-seam.md
- docs/adr/README.md
- docs/architecture/theming.md
- docs/guides/consumer-setup.md
- docs/guides/draft-publication.md
- docs/guides/theme-header.md
- CHANGELOG.md
- tests/consumption/**
role: implementer
tags: []
tracker_refs: []
---

# WP07 — Decision records, documentation and packed-consumer coverage

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Close the mission: record the two decisions, document the three new consumer-facing surfaces, add catalog and changelog entries, prove all three from the packed tarball, run every gate, and open the draft pull request.

Requirements: FR-026, FR-027, FR-029, FR-030, C-006, C-007.

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## Inputs

Read the hand-offs of WP01–WP06 first. They contain the measured geometry, the spike outcome for route shaping, the env-file loading mechanism actually used, the list of remaining "four carriers" statements, and any out-of-map edits. Document what was built, not what was planned; where they differ, the code wins and you say so.

Writing standard: write for the reader who will act on the page (a consumer configuring a site, a theme author, a maintainer). Lead with what they need to do. Follow the project's writing doctrine and the existing tone of `docs/guides/`. All pages need valid front matter (`pnpm validate:docs`).

## Subtask T037 — ADR-0044: Header carrier

**Steps**: copy the structure of a recent record (for example `docs/adr/0043-toolkit-package-scope-and-self-reference.md`; `docs/adr/template.md` is the template). Content:

- **Context**: the four-carrier lock (ADR-0013, ADR-0015 decision 3), what it protected (themes address slots, never Starlight's components map), and the need: a theme cannot replace the header through the toolkit.
- **Decision**: the map becomes exactly five; `Header` is wrapper-free; slot `dk:site-header`; fallback is the stock header unchanged; the invariant is still "fixed set, toolkit-owned, same with or without a theme".
- **Consequences**: the replacement contract (search, theme switch, mobile menu control, skip link become the theme's responsibility); the frame-gutter note; what stays locked (no further carriers without a new record).
- **Alternatives**: consumer escape hatch only; sub-slots inside the stock header.
- **Status**: accepted, date, and "supersedes the four-carrier clause of ADR-0013 and ADR-0015".

Then add a short "superseded in part by ADR-0044" note at the relevant clause of ADR-0013 and ADR-0015 without rewriting their history. `src/tests/adr-referential-integrity.test.ts` and `adr-index-generator.test.ts` guard cross-references and the index: the ADR index is **generated** — find the generator (`package.json` scripts, `src/scripts/`) and run it instead of hand-editing `docs/adr/README.md`.

## Subtask T038 — ADR-0045: frame-width token and retired constraint

Content: the wide-screen defect and its measured numbers (before: frame 1056px at 1600+, reading column 552px, gutter 432px at 1920; after: from WP01/WP03 hand-offs); the decision (public `--dk-width-frame`, default 100%, registered property so an invalid value falls back, sidebar/header/rail follow a capped frame, rail column pinned); the explicit withdrawal of the earlier "layout unchanged below 100rem" constraint and of the "header deliberately not capped" note (FR-030), with a pointer to the record or mission that introduced them (search `docs/adr` and `kitty-specs` for `C-WIDE-1`); the guard (five-width geometry spec); alternatives (fixed 90rem cap, JS measurement).

## Subtask T039 — Consumer documentation

1. **Frame width** (FR-029): in `docs/architecture/theming.md` (or wherever the `--dk-width-*` tokens are documented — it already mentions them), add `--dk-width-frame`: what it does, default, a capped example (`:root { --dk-width-frame: 90rem; }`), what follows the cap, and the invalid-value behaviour.
2. **Draft publication** (new `docs/guides/draft-publication.md`): what counts as a draft; the setting, its values and default; the table of surfaces for on and off; how to set it (env file for local work, process environment in CI); the precedence order; what the error looks like; the note for consumers who do not use the toolkit's docs loader; a short "check your deployment" step. Link it from `docs/guides/consumer-setup.md`.
3. **Theme header** (new `docs/guides/theme-header.md`, FR-026): how a theme supplies `dk:site-header`; a minimal example; the four responsibilities a replacement takes on, each with one sentence on what breaks if it is omitted; the frame-gutter note; the statement that without a theme header nothing changes.
4. Sweep the remaining "four carriers" statements WP06 listed in `docs/` and `example/docs/` and correct them (a small recorded out-of-map edit where a file is not in `owned_files`).
5. If the docs tree has generated section indexes, regenerate them; never hand-maintain an index.

## Subtask T040 — Token catalog entry and changelog

1. Find the token catalog the project keeps (`grep -rn "dk-width-content" src docs` — the catalog data and its parity test; `pnpm validate:catalog` if present) and add `--dk-width-frame` with its description and default. If WP01 already had to add it to keep a parity test green, verify the entry reads well and move on.
2. Root `CHANGELOG.md` (the canonical changelog): under the unreleased section, in the existing style and consumer-oriented wording:
   - **Changed**: full-width frame by default; rail geometry; toggle position and focus order; sidebar labels and order; drafts no longer published unless `DK_PUBLISH_DRAFTS=on` (call this out as a behaviour change with the one-line migration); no rail for a near-empty table of contents.
   - **Added**: `--dk-width-frame`; `DK_PUBLISH_DRAFTS`; Header carrier and `dk:site-header`.
   - **Fixed**: the wide-screen gutter, the shrinking reading column, the mis-anchored toggle.
   Do not bump the package version; the owner decides the release.

## Subtask T041 — Packed-consumer coverage (C-006)

Read `tests/consumption/` (fixture, scripts, `consumption-gap.test.ts`) and `.github/workflows/consumption-test.yml`. The test packs the toolkit and builds a clean-room consumer from the tarball. Extend it so the consumer:

1. sets `--dk-width-frame` in its own CSS, and the built CSS contains the registration and the frame rule;
2. builds once with `DK_PUBLISH_DRAFTS=off` and once with `on` over a fixture that has one draft page, asserting presence/absence and the `noindex` meta;
3. supplies a theme with a `dk:site-header` component, asserting it is rendered;
4. gets shaped sidebar labels (the route middleware resolves from the tarball).

Keep the tarball-integrity pinning the project already has intact. If the consumption test cannot run locally, state that and rely on its workflow.

## Subtask T042 — Full gate run and draft PR

1. From a clean state (`pnpm clean`): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm validate`, the link and artifact gates, `pnpm build` in both draft modes, `pnpm test:a11y`. Report every result exactly, including anything red and any baseline awaiting container regeneration.
2. Walk the spec's acceptance scenarios and success criteria and note, for each, the test or measurement that covers it. Anything uncovered is a finding to report, not to paper over.
3. Push `fix/sidebar-frame-header-carrier` to the `origin` remote and open a **draft** pull request to `main` with a body that states: what was broken (with the measured numbers), what changed, the behaviour change for drafts, the two ADRs, how it was verified, and what remains (for example baselines to regenerate in CI). The owner merges; do not merge.
4. If pushing or opening the pull request is not permitted in your session, stop and report; do not work around it.

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP07 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- ADR-0044 and ADR-0045 exist, are accepted, cross-referenced, and in the generated index; ADR-0013 and ADR-0015 carry a superseded-in-part note.
- Token, draft setting and theme header are each documented for their reader; the consumer setup guide links to the new guides.
- Catalog and changelog entries are in place; no version bump.
- The consumption test covers all three surfaces from the tarball.
- Full gate results are reported exactly; the acceptance-scenario walk is included.
- A draft pull request to `main` is open (or the reason it is not is reported).

## Risks

- **Docs drifting from code**: write from the hand-offs and the code, not from the plan.
- **Generated indexes**: hand-editing them will fail a guard.
- **Consumption test** is slow and environment-sensitive; start it early.

## Reviewer Guidance

- Read each guide as its intended reader: can they act on it without opening the source?
- Check the changelog names the draft behaviour change and how to keep the old behaviour.
- Check the pull request body reports results faithfully, including anything not green.
