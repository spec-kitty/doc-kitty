---
work_package_id: WP06
title: 'Hardening: assertions, demonstrator, docs'
dependencies:
- WP04
- WP05
requirement_refs:
- FR-019
- FR-020
- FR-021
- FR-022
- FR-023
planning_base_branch: feat/audience-related-external-references
merge_target_branch: feat/audience-related-external-references
branch_strategy: Planning artifacts for this mission were generated on feat/audience-related-external-references. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/audience-related-external-references unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
- T032
- T033
- T034
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/scripts/
create_intent:
- example/docs/architecture/blocks-demonstrator.md
- src/tests/fixtures/catalog/missing-id.md
- src/tests/fixtures/catalog/unknown-type.md
- src/tests/fixtures/err/audience-dangling-profile.md
execution_mode: code_change
owned_files:
- src/scripts/assert-chrome-artifacts.mjs
- src/scripts/assert-build-artifacts.mjs
- tests/a11y/**
- example/docs/architecture/blocks-demonstrator.md
- docs/architecture/metadata-model.md
- docs/architecture/theming.md
- src/tests/fixtures/catalog/**
- src/tests/fixtures/err/audience-dangling-profile.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its
initialization, boundaries, directives, and tactics. Then read this WP,
[../spec.md](../spec.md) (FR-019/020/021, NFR-001/003/004/005), the post-spec review
[../reviews/post-spec-squad.md](../reviews/post-spec-squad.md), and both contracts.

## Objective

Close the mission: the assertions that make the three blocks non-fakeable, the a11y
demonstrator the axe lane actually scans, the final count pin, the resolver fixtures,
and the docs of record. This WP depends on WP04 (blocks) and WP05 (agent surface).

## Subtasks

### T030 — Three-block assertions in `assert-chrome-artifacts.mjs`
Assert (on the demonstrator page from T032): the audience `<section>` (heading, list),
the related `<nav aria-label="Related pages">` cards (title-named links, kind, the
stale-target status marker on a stale target), and the external-references
`<nav aria-label="External references">` items. Assert the reference item's
leading/accessible text is the resolved **title** (not the mono key) — bind the
non-fakeable check (post-spec R2). Assert related/citation titles appear in the
**citing page's own** url-scoped Pagefind fragment (NFR-003 / R6). Add
`--dk-color-tint-lilac` to the enumerated `REQUIRED_DK_TOKENS` completeness set.

### T031 — Agent-record + endpoint shape in `assert-build-artifacts.mjs`; final pins
Extend `EXPECTED_PAGE_KEYS` for `audience`/`related`; assert the resolved-`related`
as an array of objects (non-string), the bumped `version`, and the
`/api/bibliography.json` per-record shape (`id`/`title`/`url`). Re-cross-check
`EXPECTED_INDEX_ENTRY_COUNT`/`EXPECTED_SITEMAP_URL_COUNT` for the demonstrator's +1
(on top of WP03's persona/hub delta).

### T032 — Block demonstrator page + AXE_PAGES
`example/docs/architecture/blocks-demonstrator.md` — a published page that declares
`audience` (linking the relocated persona), `related` (incl. one stale target), and
`external_references` (one inline + one catalog `{type,id}`), so it renders all three
blocks. Add its route to `tests/a11y/routes.ts` `AXE_PAGES` so axe scans a wired
block page (post-spec R1).

### T033 — Resolver fixtures (by owning lane) [P]
`src/tests/fixtures/catalog/missing-id.md`, `unknown-type.md` (build-fail cases) and
`src/tests/fixtures/err/audience-dangling-profile.md` (warn case). Exercise them in
the **vitest resolver** lane (NFR-005) — not the schema/validator parity test
(post-spec R3). (Persona parity fixtures live in WP03.)

### T034 — Docs of record [P]
Update `docs/architecture/metadata-model.md` (catalog section + persona location of
record) and `docs/architecture/theming.md` (the three wired blocks + persona
attributes). Keep frontmatter valid (doc-sanity) — description 50–180 chars,
resolving `related`.

## Branch Strategy

Planning branch and final merge target: `feat/audience-related-external-references`.
Worktree per `lanes.json`; changes merge back into the mission branch.

## Definition of Done

- The demonstrator renders three accessible blocks; axe scans it and passes (NFR-001).
- Chrome + build assertions bind the title-named accessible names, the own-fragment
  Pagefind coverage, the stale-target marker, the enriched agent record + endpoint
  shape, and the recomputed count pins.
- Resolver fixtures exercised in the vitest lane; docs of record updated.
- **All four `ci-ok` lanes green** with the three blocks scanned by axe (SC-006).

## Risks & reviewer guidance

- **This WP owns the verification files** WP03 edited out-of-map for relocation —
  extend, do not revert those relocation edits.
- **Non-fakeable**: reviewer confirm the title-vs-key and own-fragment assertions
  actually fail when the contract is violated (the post-spec squad's central concern).
- **Count math**: the final pins must equal the built `example/docs/` set (persona
  +1, hub +1, demonstrator +1, retained draft 0).
