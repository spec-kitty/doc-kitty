---
work_package_id: WP04
title: Collapsible metadata blocks
dependencies:
- WP01
- WP02
- WP03
requirement_refs:
- FR-014
- FR-015
- FR-016
- FR-018
- NFR-002
- NFR-003
- NFR-004
- NFR-005
- SC-003
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: 076d529f9f67698a097037f00f93c7b5f865ca46
created_at: '2026-11-06T09:52:09.070553+00:00'
subtasks:
- T013
- T014
- T015
- T016
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/slots/
create_intent:
- src/components/slots/MetadataBlock.astro
- src/tests/metadata-blocks-build.test.ts
- tests/a11y/metadata-blocks.spec.ts
execution_mode: code_change
owned_files:
- src/components/slots/MetadataBlock.astro
- src/components/slots/Audience.astro
- src/components/slots/Related.astro
- src/components/slots/ExternalReferences.astro
- src/components/slots/OnThisPage.astro
- src/scripts/assert-chrome-artifacts.mjs
- src/tests/metadata-blocks-build.test.ts
- tests/a11y/metadata-blocks.spec.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 – Collapsible metadata blocks

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Audience, Related, External references and Glossary links start collapsed, show a label and count, work by keyboard and mouse, and stay reachable and searchable.

**Concern**: IC-03. **Requirements**: FR-014, FR-015, FR-016, FR-018, NFR-002, NFR-003, NFR-004, NFR-005, SC-003.
**Depends on**: WP01, WP02, WP03.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP04 --agent <name> --mission page-chrome-01M6PBR7
```

## Rules for every subtask

- **Read first**: [spec.md](../spec.md), [plan.md](../plan.md) and the contracts it links.
- **Non-vacuity** (tactic `acceptance-criteria-non-vacuity`): a test that asserts absence or no change needs a positive control on the same fixture, and must go through the production path. For a build-level claim, that means real built HTML.
- **Build suites** share `example/.astro`. WP11 registers every new build test named in this mission in the serialized `build` project in `src/vitest.workspace.ts`, so you shouldn't need to edit it.
- **Varying options**: use WP11's fixture config (`DK_TEST_OPTIONS`) and frozen fixture site. Don't edit `example/astro.config.mjs` for a test, and don't compare a build with itself.
- **No DOM test environment**: jsdom is forbidden here (`toc-rail-preference.test.ts:3`). Unit tests use stubs, and behaviour proofs go in Playwright.
- **Gates**: `pnpm assert:artifacts` is part of every code WP's definition of done.
- **Byte-sensitive templates**: Astro trims whitespace differently around `{expr}` and bare elements. Rebind components rather than wrapping existing positions in conditionals, as `MarkdownContent.astro` explains.
- **Changelog**: a user-visible change adds `docs/changelog/unreleased/<issue>-<slug>.md`, and never edits `CHANGELOG.md`.
- **Out-of-map edits**: only the small ones this prompt names, or others recorded with a one-line reason in the commit message.
- **Don't commit** `kitty-ops/` or the regenerated `example/docs/glossary/**` `generated.by` stamps.
- Record subtask progress with `spec-kitty agent tasks mark-status T001 --status done --mission page-chrome-01M6PBR7`.

## Subtasks

### T013: MetadataBlock component

`src/components/slots/MetadataBlock.astro` takes `panelClass`, `label`, `count`, an optional `navLabel`, and a unique `id`. It renders the [WP03 baseline](./WP03-disclosure-extraction.md):

```astro
<div class:list={['dk-panel', panelClass, 'dk-disclosure']} data-dk-disclosure ...>
  <details id={id} open={!chromeOptions().metadataBlocks.collapsed}>
    <summary><span class="dk-eyebrow">{label}</span> ({count})</summary>
    <div role={navLabel ? 'navigation' : undefined} aria-label={navLabel}><slot /></div>
  </details>
</div>
```

- `.dk-panel--*` stays on the outer element, so theme CSS and WP02's order checks keep working.
- Pass `data-label-expanded="Hide {label} ({count})"` and `data-label-collapsed="Show {label} ({count})"`.
- Add a `<script>` importing `disclosure.client.ts`. Box, target size and focus ring come from WP03's `disclosure.css`. The chevron reflects state with scripts off too.
- `@media print`: show collapsed content, since a closed `details` doesn't print. This serves FR-018's "collapsing hides nothing for good".
- `brand-components.css:303` has `.dk-panel > .dk-eyebrow`, which stops matching. Move that gap to the open content, as a recorded out-of-map edit.

**Ids**: derive them from the block type, such as `dk-block-related`. A page holds at most one of each, so this is deterministic (NFR-001).

### T014: Convert the three standalone blocks

Replace the outer markup in `Audience.astro`, `Related.astro` and `ExternalReferences.astro` with `MetadataBlock`:

- Keep each block's list markup and scoped styles.
- Each block still renders nothing when it has no entries, so no `(0)` control appears.
- Audience keeps its label, "Who is this for". `assert-chrome-artifacts.mjs:1287-1296` hard-requires `<section aria-labelledby="dk-audience-heading">`, so change that check in this WP to assert the new markup, keeping what it proves: the block is present and named.
- `ReferenceItem` rows don't change: citation format is #289's work (C-005).

### T015: Convert OnThisPage

`OnThisPage.astro` renders Related, External references and Glossary links as three panels. Each becomes a `MetadataBlock`.

It deliberately uses inline `style={LIST_RESET}` to protect a glossary-free build's bytes (NFR-002 of the glossary mission), so keep that. Use the same block ids as the standalone blocks. Only one of the two forms renders on a page, because the carrier swaps them. Glossary links used needs its own id.

### T016: Tests for behaviour and reach

`src/tests/metadata-blocks-build.test.ts`, on the built example:

- **FR-014**: a page with blocks has each as a closed `<details>` with a summary showing label and correct count. Choose the page by asserting the counts it should have.
- **FR-015**: a build with `metadataBlocks: { collapsed: false }` gives `<details open>` on the same page. This is the control for the previous check.
- **FR-018**: pick a sentinel word that appears only in a collapsed block on one page, assert the block is closed, and assert the word is in the decompressed Pagefind fragment, as `assert-chrome-artifacts.mjs:918-961` does. Control: a word outside the block on the same page, and a word that isn't on the page, which must be absent.

`tests/a11y/metadata-blocks.spec.ts` (Playwright):

- Keyboard: Tab to the control, Enter and Space toggle it, and `aria-expanded` follows.
- Mouse click toggles it.
- With JavaScript disabled, the summary toggles and the content is reachable (NFR-004).
- Navigate to another page after expanding: blocks start closed (FR-016).
- `open` state and bounding box are equal, with scripts off and on (NFR-006). Compare by loading the page in both modes.
- **SC-003**: on `rhetoric/book-one/`, all four blocks are closed on load, and the first content paragraph sits higher than when every block is expanded, on the same page at the same viewport.
- WP03's real-browser behaviours, listed in that WP's tests.
- Target size at least 24×24 (NFR-003), collapsed **and expanded**: `helpers/targets.ts:73` skips closed content, so add cells with blocks open.
- Axe is clean in light and dark, themed and unthemed through WP11's project (NFR-002), collapsed and expanded, since closed content leaves Axe's scope.

Update existing specs that query these panels (for example `glossary.spec.ts`, `persona-card.spec.ts`) only where they assert the old open markup. Add a changelog fragment, `docs/changelog/unreleased/290-metadata-blocks.md`.

## Risks

- Search `src/themes/` for other selectors assuming the eyebrow is a direct child of a panel.
- This WP owns `assert-chrome-artifacts.mjs`. WP09 appends its footer checks to it separately.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-014, FR-015, FR-016, FR-018, NFR-002, NFR-003, NFR-004, NFR-005, SC-003) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Open a page with scripts off. Then confirm Pagefind's fragment still holds collapsed text. A green Axe run alone doesn't prove either one.

Check that tests fail without the change, not only that they pass with it.
