---
work_package_id: WP03
title: Extract the disclosure toggle from the TOC rail
dependencies:
- WP11
requirement_refs:
- FR-017
- NFR-006
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: b13071c4d87ce027df5c2b6be6093378a9199500
created_at: '2026-11-05T19:03:23.779803+00:00'
subtasks:
- T009
- T010
- T011
- T049
- T012
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/disclosure/
create_intent:
- src/lib/disclosure/toggle.ts
- src/lib/disclosure/upgrade-details.ts
- src/lib/disclosure/disclosure.client.ts
- src/styles/disclosure.css
- src/tests/disclosure.test.ts
- docs/adr/0077-shared-disclosure-control.md
execution_mode: code_change
owned_files:
- src/lib/disclosure/**
- src/lib/toc-rail/toc-rail.client.ts
- src/styles/disclosure.css
- src/tests/disclosure.test.ts
- docs/adr/0077-shared-disclosure-control.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 – Extract the disclosure toggle from the TOC rail

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Make the TOC rail's toggle reusable, with the rail's behaviour unchanged, and add the upgrade that turns a native `<details>` into that same control. The maintainer chose this over a native-only control (decision 01M6PDCSJA3PEZRH4NCZYVN9BB).

**Concern**: IC-02. **Requirements**: FR-017, NFR-006.
**Depends on**: WP11.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP03 --agent <name> --mission page-chrome-01M6PBR7
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

### T009: Extract the generic toggle

Move button creation, `CHEVRON_SVG` and `reflectState` from `src/lib/toc-rail/toc-rail.client.ts` to `src/lib/disclosure/toggle.ts`:

```ts
export interface DisclosureOptions {
  id: string;
  controls: string;                 // aria-controls target id
  labelWhenExpanded: string;
  labelWhenCollapsed: string;
  isCollapsed(): boolean;
  setCollapsed(next: boolean): void; // the state adapter
}
export function createDisclosureButton(options: DisclosureOptions): HTMLButtonElement;
export function reflectState(button: HTMLButtonElement, collapsed: boolean, options: DisclosureOptions): void;
```

No storage access lives here. Persistence belongs to the adapter the caller passes, so nothing can store a block's state by accident (FR-016).

### T010: Migrate the rail

`toc-rail.client.ts` calls the extracted functions and passes its own `TOGGLE_ID`, `PANEL_ID`, labels and an adapter wrapping `isCollapsed`/`setCollapsed` from `preference.ts`. The `<html data-toc-collapsed>` driver, mount point and pre-paint script don't change.

**Validate**: `toc-rail-build-html.test.ts`, `toc-rail-preference.test.ts`, `toc-rail-prepaint.test.ts` and `tests/a11y` rail checks stay green **with no edits to those tests**. Editing one of them means the behaviour changed: stop and reconsider.

### T011: Upgrade a native details element

`src/lib/disclosure/upgrade-details.ts` exports `upgradeDetails(root: HTMLElement)`. It expects this baseline, which is complete with scripts off:

```html
<div class="dk-disclosure" data-dk-disclosure data-label-expanded="..." data-label-collapsed="...">
  <details id="...">
    <summary>...label and count...</summary>
    ...content...
  </details>
</div>
```

Steps:

1. A closed `<details>` hides everything except its summary, so the button can't be a child of `details`. Insert it with `details.before(button)`, so it sits directly ahead of `details` whatever else the wrapper holds, with `aria-controls` set to the `details` id. WP06's label link stays first.
2. Clone the summary's content into the button, **stripping `id` attributes from the clone**, and hide the summary (`.dk-disclosure--upgraded summary { display: none }`).
3. The adapter's `isCollapsed` reads `details.open`. `setCollapsed` writes it, unless the wrapper sets `data-dk-toggle-via="summary"`, when it calls `summary.click()` instead. WP06 needs this: Starlight's `SidebarPersistState` records a toggle only when a click lands in a `summary`, and `summary.click()` toggles and bubbles even with the summary `display: none`. The adapter stores nothing itself.
4. Listen for `toggle` on `details` and re-reflect, because the browser's in-page find can open it, and so can Starlight's sidebar persister.
5. If the summary had focus when upgrading, as on a slow load, move focus to the button. Otherwise it falls to `body`.
6. Skip a wrapper that is already upgraded, so calling it twice is safe.

**Accessible name (WCAG 2.5.3)**: the name must contain the visible label. Compose it from the wrapper's data attributes, such as "Show Related (3)" and "Hide Related (3)". Don't set `title` on labelled buttons. A chevron-only button keeps its `aria-label`.

**Styling**: Astro's scoped CSS doesn't reach a script-created button, since it has no `data-astro-cid`. Put the shared box, 24×24 minimum, focus ring (`outline`, so it survives forced colours) and `color: inherit` in a global sheet, `src/styles/disclosure.css`, loaded the way `toc-rail.css` is. Check how it reaches a consumer site.

**No layout shift (NFR-006)**: the button must have the summary's box, using the same class in that sheet. The same `open` state must hold before and after upgrading.

### T049: ADR-0077

Write `docs/adr/0077-shared-disclosure-control.md`, which #290 anticipated as a new seam next to ADR-0017 and ADR-0025. Don't edit the index table.

- **Decision**: one disclosure toggle for the rail, metadata blocks and sidebar groups, enhancing a native `<details>` baseline, with state owned by a caller-supplied adapter.
- **Alternatives**: native only with a shared look, which the maintainer declined.
- **Consequences**: a client script on pages with a disclosure, and a hidden-summary pattern that needs the focus and persister handling above.

### T012: Client entry and tests

`src/lib/disclosure/disclosure.client.ts` upgrades every `[data-dk-disclosure]` on load. It is imported from a `<script>` in the components that render a disclosure (WP04, WP06), so Astro bundles and dedupes it, and a page without one loads nothing. Check how the TOC rail's island is loaded and match its handling of view transitions.

`src/tests/disclosure.test.ts`, with stubs in the style of `toc-rail-preference.test.ts`, covers the pure logic: state and label composition, the adapter choice, the already-upgraded check, and that this module never touches storage.

Real behaviour needs a browser, so WP04's `metadata-blocks.spec.ts` proves it, including: a click flips `details.open` and `aria-expanded` together, `aria-controls` names a real id, upgrading twice leaves one button, an external `open` updates `aria-expanded`, focus moves on upgrade, and no new `localStorage` or `sessionStorage` key appears after toggling a block (FR-016). Control: toggling the rail on the same page does write its key.

**Mutation check**: remove the `toggle` listener and confirm that spec goes red.

## Risks

- A hidden summary removes the native toggle. If the script fails after upgrading, the content could become unreachable, so add the upgraded class and hide the summary only after the button is in the DOM.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-017, NFR-006) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Compare the rail's built HTML and script behaviour before and after. Confirm no storage access exists under `src/lib/disclosure/`.

Check that tests fail without the change, not only that they pass with it.
