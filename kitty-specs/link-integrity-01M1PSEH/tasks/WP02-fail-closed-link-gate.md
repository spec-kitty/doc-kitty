---
work_package_id: WP02
title: Fail-closed link gate + docs (#62)
dependencies:
- WP01
requirement_refs:
- FR-005
- NFR-003
- NFR-004
planning_base_branch: fix/link-integrity
merge_target_branch: fix/link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/link-integrity unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
- T012
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/scripts/assert-no-broken-links.mjs
execution_mode: code_change
owned_files:
- src/scripts/assert-no-broken-links.mjs
- src/scripts/check-links.mjs
- package.json
- .github/workflows/ci.yml
- docs/adr/**
- docs/changelog/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load node-norris` (role: implementer), or `spec-kitty agent profile show node-norris` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_043 (close the class — a fail-closed gate makes recurrence impossible), DIRECTIVE_041 (mutation-true: RED on the pre-fix dist), red-first.

## Objective

Close #62: the link gate reports success while links 404. Add a base-aware built-output link gate and tighten the source gate, so the link-404 class can't ship green again. WP01's link fixes are merged into this lane. Read `../spec.md` (FR-005), `../research.md` (D4). Work in the lane worktree only.

## Critical context

- `src/scripts/check-links.mjs` (run as `pnpm validate:links`, CI `.github/workflows/ci.yml`) is green-on-broken: it skips site-absolute links (`docLinkTarget` returns null for `/…`, ~:139), resolves relative links against the **filesystem** not the URL (`resolve(dirname,target)`, ~:193), and never inspects rendered/component/generated output — so it reports "✓ 863 resolve" while ~30 links 404.
- The site base is `/doc-kitty`; pages are trailing-slash directory URLs. Existing dist-walk gate precedents: `src/scripts/assert-build-artifacts.mjs`, `check-redirect-coverage.mjs`.

## Subtasks

### T009 — `src/scripts/assert-no-broken-links.mjs` (base-aware dist walk)
Walk `example/dist/**/*.html`; for every internal `href` (skip `http(s)`/`mailto`/`tel`/`javascript`/pure `#…`), resolve it **as a URL** against the base with trailing-slash directory semantics (a bare/`./` relative link resolves relative to the page's directory URL), strip the query/fragment, and assert the target exists in `dist` (an `index.html` for a directory route, or the file). Fail with a clear per-link message (page → href → resolved path). Fragment-only and cross-page `#anchor` existence checking is out of scope for v1 (note it).

### T010 — Tighten `src/scripts/check-links.mjs`
Make an internal **root-absolute** doc link a failure ("use a `./target.md` relative link"), and **reject extensionless-relative** internal doc links (force `.md`). Keep external/anchor handling. This aligns the source gate with the `.md`-relative authoring convention.

### T011 — Wire + prove mutation-true
Add `assert:no-broken-links` to `package.json` scripts and to CI (`.github/workflows/ci.yml`, next to `validate:links`, over `example/dist`). PROVE it RED on the pre-fix state and GREEN after WP01: check out the pre-WP01 `example/docs`/`src` state (or revert one WP01 fix), `pnpm clean && pnpm build`, run the gate → RED (reports the base-less/relative 404s); restore → `pnpm clean && pnpm build` → GREEN. Capture the red→green evidence.

### T012 — Docs
Short ADR (or convention note) for the base-aware-link + fail-closed-gate contract (internal links carry the base via `withBase`/the glossary builder or `.md`-relative authoring; the dist gate is the enforcement). Dated changelog fragment under `docs/changelog/` (repo convention — NO CHANGELOG.md): impact-first — internal links (glossary terms, section, related) no longer 404 on the deployed site, and a gate now catches link breakage. Refs #61/#62/#63. If a new ADR page is added, run `node src/scripts/generate-adr-index.mjs --check` and regenerate if drifted.

## Branch strategy
Planning branch `fix/link-integrity`; final merge target `main` (PR). Lane worktree per `lanes.json`, after WP01.

## Definition of Done
- `pnpm assert:no-broken-links` GREEN on the WP01-fixed `example/dist`, and demonstrably RED on the pre-fix state (mutation-true).
- `check-links.mjs` fails a root-absolute / extensionless-relative internal doc link.
- CI runs the new gate; `pnpm validate:links` still green on the fixed tree.
- ADR + dated changelog present; `generate-adr-index --check` clean if an ADR page was added; `pnpm validate:docs` clean.

## Risks / reviewer guidance
- Avoid false positives: external/`mailto`/`tel`/anchor-only links and CORRECT directory-index relative links must pass.
- Model trailing-slash URL semantics precisely (the whole point vs the filesystem-based old gate).
- Do NOT touch kitty-specs/ status artifacts.
