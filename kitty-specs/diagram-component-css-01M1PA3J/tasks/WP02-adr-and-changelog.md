---
work_package_id: WP02
title: ADR + changelog for diagram-figure ownership (#59/#60/#68)
dependencies:
- WP01
requirement_refs:
- FR-005
planning_base_branch: fix/diagram-component-css
merge_target_branch: fix/diagram-component-css
branch_strategy: Planning artifacts for this mission were generated on fix/diagram-component-css. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/diagram-component-css unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
history:
- created by /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
owned_files:
- docs/adr/**
- docs/changelog/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load curator-carla` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Writing discipline: plain language, impact-first (BLUF), concrete before→after, no unexplained jargon (per the project writing preferences).

## Objective

Document the fix delivered in WP01: make the **remark→rehype→CSS diagram-figure ownership contract explicit** (an ADR) and record the **user-facing change** (a dated changelog fragment). Read `../spec.md`, `../research.md` (D1, D3, D6). Depends on WP01 — describe the *landed* behavior, not the pre-fix state.

## Critical context

- This repo uses **dated changelog fragments** under `docs/changelog/YYYY-MM-DD-<slug>.md` (there is NO `CHANGELOG.md`; do not create one). Match the frontmatter + style of siblings (e.g. `docs/changelog/2026-09-04-test-guard-hardening.md`): `title`, `description`, `doc_status: active`, `updated`, `type: Changelog`, `kind: Changelog`, `tags`, optional `related:` to real pages/ADRs.
- ADRs live in `docs/adr/NNNN-<slug>.md`. The next number follows the highest existing ADR. There is an ADR index guard: `node src/scripts/generate-adr-index.mjs --check` (a.k.a. `pnpm validate:adr-index`).
- The three layers currently each name a different figure owner (`config.ts` comment claims it emits a real `<pre class="mermaid">`; `diagram-figure.ts` claims to own the figure wrap; `dk-reveal-theme.css:157` says presentation is owned by `figure.dk-diagram`). The ADR fixes that contract in prose.

## Subtasks

### T009 — ADR: diagram-figure ownership seam
Author `docs/adr/NNNN-diagram-figure-ownership.md`: **remark emits a single well-formed `<pre class="mermaid">` element (custom node type, never a `code` node); rehype (`diagram-figure.ts`) owns wrapping it in `<figure class="dk-diagram">`; a delivered component stylesheet owns figure/caption presentation.** State the decision, the context (the double-`<pre>` and the branded-CSS-drop defects), and the consequence (never project `hName` onto a `code` node; global component CSS must live in a non-slot-0 sheet). Match the repo's ADR structure; reference #59/#60/#68 and relate to ADR-0022/0023 as appropriate.

### T010 — Changelog fragment
Add `docs/changelog/2026-09-04-diagram-component-css.md` (or the build date): bold impact-first lead — readers get clean captioned diagrams and branded sites get styled callouts/diagrams — then before→after, with `(#59)`, `(#60)`, `(#68)` refs. No internal jargon first; name the symptom users saw (boxed monospace diagrams; unstyled callouts on branded docs).

### T011 — ADR index integrity
If T009 adds a new ADR page, run `node src/scripts/generate-adr-index.mjs --check` and regenerate the ADR index/inventory if the guard reports drift, so `validate:adr-index` stays green.

## Branch strategy

Planning branch: `fix/diagram-component-css`. Final merge target: `main` (PR). Lane worktree per `lanes.json`; merges back into `fix/diagram-component-css` after WP01.

## Definition of Done

- ADR present, well-formed, referenced from the changelog `related:` where sensible.
- Changelog fragment present, impact-first, matches sibling style, refs #59/#60/#68.
- `node src/scripts/generate-adr-index.mjs --check` passes (ADR index not drifted).
- Terminology/prose reads plain and audience-first.

## Risks / reviewer guidance

- Do not invent a `CHANGELOG.md` — dated fragments only.
- Ensure the ADR number doesn't collide with an existing one; regenerate the index if a page is added.
