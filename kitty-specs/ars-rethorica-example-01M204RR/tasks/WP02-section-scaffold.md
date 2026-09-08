---
work_package_id: WP02
title: Rhetoric section scaffold + hubs/landings
dependencies:
- WP01
requirement_refs:
- FR-002
- FR-003
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
- T009
- T010
history:
- created by /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: example/docs/rhetoric/
create_intent:
- example/docs/rhetoric/index.md
- example/docs/rhetoric/book-one/index.md
- example/docs/rhetoric/book-two/index.md
- example/docs/rhetoric/book-three/index.md
execution_mode: code_change
owned_files:
- example/docs/_meta/sections.yaml
- example/docs/rhetoric/index.md
- example/docs/rhetoric/book-one/index.md
- example/docs/rhetoric/book-two/index.md
- example/docs/rhetoric/book-three/index.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load your profile via `/ad-hoc-profile-load curator-carla` (role: implementer). Apply its identity/boundaries and charter directives (`spec-kitty charter context --action implement --json`); state which applied. Relevant: DIRECTIVE_003 (decision documentation), ADR-0004 (custom sections are the tolerated path).

## Objective

Stand up the nested **Rhetoric showcase** section inside the existing example site: a custom three-book section registered in the section registry, with a hub and Book I/II/III landing pages. The flagship convention content stays untouched (FR-002). Read `../spec.md` (FR-002, FR-003), `../plan.md` (IC-03, Structure Decision), `../research.md` (D3), and the source part titles in `../source-vendor/BookOne.md|BookTwo.md|BookThree.md`.

Facts (from research):
- Sections are registry-driven in `example/docs/_meta/sections.yaml` (loader `src/lib/sections.ts`). A page's section = its first path segment. Book subfolders nest automatically as Starlight sidebar sub-groups — only the top-level `rhetoric` folder needs a registry entry.
- Section landings are hand-authored `index.md` with `kind: Hub`.
- Frontmatter: `description` required, ≤180 chars; `doc_status: active`; one body `#` H1 (frontmatter title exempt from MD025). Root-absolute links only.

## Subtasks

### T006 — Register the `rhetoric` section
Add to `example/docs/_meta/sections.yaml`: `{id: rhetoric, label: Rhetoric, order: 45, type: Reference}` (order 45 slots between guides=40 and presentations=50; adjust only if 45 collides — duplicate `order` warns). Do not disturb existing entries.

### T007 — Rhetoric hub `example/docs/rhetoric/index.md`
`kind: Hub`, `type: Reference`, `doc_status: active`. Introduce the showcase: what it is (a real Markua-authored conversion of Aristotle's *Rhetoric*, Book I), that it demonstrates custom sections + Markua + a native glossary + personas, and a one-line CC-BY-SA-4.0 note linking `/rhetoric/about-and-license/` (page authored in WP03 — link is fine to author now; it resolves at final build). Link to Book I / II / III landings. Keep prose audience-oriented, no AI-tell hedging.

### T008 — Book I landing `example/docs/rhetoric/book-one/index.md`
`kind: Hub`. Title from `../source-vendor/BookOne.md` ("I: Purposes and Definitions of Rhetoric"). Summarise Book I and list its 15 chapters as root-absolute links `/rhetoric/book-one/chapter-01/` … `/chapter-15/` in reading order (chapter titles come from each source `# Chapter N: …` heading — you may include them). These chapter pages are authored in WP04–06; the links resolve at final build.

### T009 — Book II & III landing-only pages
`example/docs/rhetoric/book-two/index.md` and `book-three/index.md`, `kind: Hub`. Titles from `../source-vendor/BookTwo.md` / `BookThree.md`. Each states the book's theme and that its chapters are **out of scope for this showcase** (Book I only) — no dead links, no empty section (FR-003 edge case).

### T010 — Verify section + nav
From a lane worktree: `pnpm install --offline`, `pnpm clean`, `pnpm --filter example build`. Confirm: build exits 0; a "Rhetoric" sidebar group appears with `book-one/two/three` sub-groups; hub + landings resolve at `/rhetoric/`, `/rhetoric/book-one/` etc. Run `pnpm validate:example` and `pnpm validate:links`. Note any custom-section advisory warning (expected, non-fatal per ADR-0004).

## Definition of Done
- `rhetoric` registered; hub + 4 landings authored, all `doc_status: active`, each ≤180-char description, single H1.
- Build green; Rhetoric group renders with nested books; links resolve.
- `spec-kitty agent tasks mark-status T006 T007 T008 T009 T010 --status done`.

## Risks / reviewer guidance
- Reviewer: confirm flagship content untouched (only the 5 owned files changed); confirm root-absolute links (no `.md`-relative); confirm the custom-section warning is advisory, not an error.
- Book II/III must read as intentional landings, not stubs.
