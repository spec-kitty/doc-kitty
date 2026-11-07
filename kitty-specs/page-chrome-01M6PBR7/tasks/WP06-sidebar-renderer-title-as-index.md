---
work_package_id: WP06
title: Opt-in sidebar renderer and title-as-index
dependencies:
- WP03
- WP05
requirement_refs:
- C-001
- FR-007
- FR-008
- FR-011
- NFR-002
- NFR-003
- NFR-004
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: 5400ff06874e4c92b78c04adc027b4a219bfe8b7
created_at: '2026-11-06T10:40:56.107321+00:00'
subtasks:
- T020
- T021
- T022
- T023
- T024
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/sidebar/
create_intent:
- src/components/sidebar/SidebarSublist.astro
- src/tests/sidebar-renderer-parity.test.ts
- src/tests/sidebar-title-as-index-build.test.ts
- tests/a11y/sidebar-title-as-index.spec.ts
- docs/adr/0075-sidebar-carrier-renders-own-sublist-on-opt-in.md
execution_mode: code_change
owned_files:
- src/components/Sidebar.astro
- src/components/sidebar/**
- src/lib/manifest.ts
- src/tests/sidebar-renderer-parity.test.ts
- src/tests/sidebar-title-as-index-build.test.ts
- tests/a11y/sidebar-title-as-index.spec.ts
- docs/adr/0075-sidebar-carrier-renders-own-sublist-on-opt-in.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP06 – Opt-in sidebar renderer and title-as-index

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

When a site opts in, the sidebar carrier renders a DocKitty sublist. Title-as-index works on it. With nothing opted in, Starlight's own `Sidebar` renders, as it does today.

**Concern**: IC-05. **Requirements**: FR-007, FR-008, FR-011, C-001, NFR-002, NFR-003, NFR-004.
**Depends on**: WP03, WP05.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP06 --agent <name> --mission page-chrome-01M6PBR7
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

### T020: DocKitty sublist with parity

`src/components/sidebar/SidebarSublist.astro` copies Starlight 0.42.6's `dist/components/SidebarSublist.astro`: same markup, `SidebarRestorePoint` (exported through `@astrojs/starlight/components/*`), and its `@layer starlight.core` styles.

Two imports differ, because Starlight's `exports` doesn't reach them:

- `sidebarGroupHasCurrent` lives in `utils/`, which isn't exported. Write a small local recursive helper.
- `Icon` and `Badge` come from the `./components` barrel, which nothing in `src/` uses yet. Check the barrel adds no CSS to an opted-in site beyond what these need.

`Sidebar`'s default imports `SidebarPersister` and `virtual:starlight/components/MobileMenuFooter`. The opt-in path renders the same structure:

```astro
<SidebarPersister><SidebarSublist sublist={sidebar} /></SidebarPersister>
<div class="md:sl-hidden"><MobileMenuFooter /></div>
```

Add support for two data-driven extras, each off unless the data is present:

- A link or group with `entry.dkIcon` renders its inline SVG, `aria-hidden`, before the label. WP07 supplies it.
- A group whose first entry has `data-dk-group-index` renders as title-as-index (T022).

**Parity test** (`sidebar-renderer-parity.test.ts`): the Astro container API isn't an option here (Vitest 2 on Vite 5 against Astro 7 on Vite 8, and `SidebarSublist` pulls `virtual:starlight/*`). Instead, build WP11's frozen fixture twice, stock and with `titleIsIndex: true`, using a variant of the fixture whose groups have no index page. With no index and no icons, every group takes the plain path, so the two sidebars must match after `normaliseScopeHashes`. This test is what fails when a Starlight upgrade changes its markup. It doesn't compare the copied CSS, so note that in the ADR.

### T021: Carrier chooses the renderer

In `src/components/Sidebar.astro`, keep a bare element and rebind which component it is, so whitespace stays identical:

```ts
const useCustom = chromeOptions().sidebar.titleIsIndex || sidebarIconsAuthored();
const Body = useCustom ? CustomSidebarBody : Default;
```

`<script is:inline data-dk-sidebar-reveal>` stays right after.

**Don't statically import the custom body**: that puts its scoped CSS in the module graph for every site, opted in or not (`plugin-css.js` walks parent modules). Serve it through the manifest's virtual module, the way layouts and slot components are, as a recorded edit in `src/lib/manifest.ts`. `sidebarIconsAuthored` comes from WP07; until then a local constant `false` with a clear note is fine, since WP07 depends on this WP.

The carrier count stays at six. `CustomSidebarBody` is a plain component it renders, not a Starlight override. Update the header comment, which says the markup stays exactly Starlight's.

**Validate**: with neither option, the carrier's output is unchanged (FR-006's golden from WP05 stays green). With `titleIsIndex` on, the reveal script still scrolls to the current entry (`sidebar-reveal.spec.ts` behaviour, on a fixture).

### T022: Title-as-index rendering

For a group whose first entry carries `data-dk-group-index`:

```html
<li class="dk-group dk-disclosure" data-dk-disclosure ...>
  <a class="dk-group__label large" href="..." aria-current="page">Guides</a>
  <details id="dk-group-..." open>
    <summary aria-label="Toggle Guides"><Icon name="right-caret" class="caret" /></summary>
    <SidebarRestorePoint />
    <Astro.self sublist={rest} nested />
  </details>
</li>
```

- Skip the index link in the list, and strip the `data-dk-group-index` attribute from output.
- If the group has nothing else, omit `details` and the chevron. A top-level group whose only entry is its index stays a group (`route-shaping.ts:337`).
- Set `data-dk-toggle-via="summary"` on the wrapper, so a button toggle reaches Starlight's persister.
- The copied `[open] > summary .caret` rule no longer matches a caret moved into the button. Add `[aria-expanded='true'] .caret`, in both text directions.
- `aria-current` is set on the label when the index is current. `sidebarGroupHasCurrent` includes it, so the group opens.
- A group with no index link keeps Starlight's plain toggle.
- Load `disclosure.client.ts` from a title-as-index-only child component, rendered outside the persister. A script inside it breaks the parity test, and could hit the Safari/VoiceOver bug `SidebarPersister.astro:16` documents. Starlight's persister reads `details` by position and sets `open`, so `details` stays the state, and WP03's `toggle` listener keeps the button in sync.
- **Unique, stable ids**: derive from `dkDir`.
- CSS positions the chevron at the label row's inline end, in both LTR and RTL, with a target of at least 24×24.

The no-script chevron is a `<summary>`, which exposes expanded state natively. The upgraded one is a button with `aria-expanded` and `aria-controls`, as FR-007 states.

### T023: Tests

`sidebar-title-as-index-build.test.ts`, on a fixture build with `titleIsIndex: true`, plus the default build as control:

- A group label is an `<a>` to its index page, with `aria-current="page"` on that page and not on others.
- No "Overview" entry appears (control: the default build has it).
- The index isn't lost from prev/next links (FR-011, research R7): the page before a relabelled index links forward to it, **with that page's title, not the relabelled text**.
- The first link in the group is the index in both builds (FR-008).
- `titleIsIndex` and `indexLabel` together fail the build with WP01's message, through the real config path.

`tests/a11y/sidebar-title-as-index.spec.ts` runs on WP11's title-as-index Playwright project: Tab order is label, then chevron, then children. Enter on the label navigates, and Enter and Space on the chevron toggle without navigating. **A chevron toggle survives navigating to another page**, which proves the persister receives it. With JavaScript off, the summary toggles. NFR-006 holds on the sidebar: `open` state and box match with scripts off and on. Target size and Axe stay clean in light and dark, with groups open. Add a changelog fragment, `docs/changelog/unreleased/290-title-is-index.md`.

### T024: ADR-0075

Write `docs/adr/0075-sidebar-carrier-renders-own-sublist-on-opt-in.md`. Don't edit the index table.

- **Context**: ADR-0063 decision 1 has the carrier render Starlight's sidebar unchanged, and decision 5 says it hosts no slot. Starlight 0.42.6's group labels are escaped text and groups have no `attrs`, so title-as-index and icons can't arrive through route data.
- **Decision**: supersede decision 1 in part. On opt-in, the carrier renders a DocKitty sublist inside Starlight's persister. Otherwise, it renders Starlight's. Decisions 2 to 5 stand, and the carrier count stays at six.
- **Consequences**: a copied component to maintain, guarded by the parity test.
- **Alternatives**: HTML rewriting in middleware; `attrs` with CSS masks (links only).

ADR-0063 stays as written.

## Risks

- Copying Starlight's sublist couples us to its internals. The parity test and the opt-in default contain this.
- `virtual:starlight/components/MobileMenuFooter` might need a type shim, as the toolkit's other virtual imports do.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-007, FR-008, FR-011, C-001, NFR-002, NFR-003, NFR-004) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Confirm the parity test really renders both components, and that it goes red if a class or attribute in the copy changes.

Check that tests fail without the change, not only that they pass with it.
