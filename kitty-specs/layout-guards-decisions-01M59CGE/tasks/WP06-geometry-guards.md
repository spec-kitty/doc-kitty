---
work_package_id: WP06
title: 'Geometry guards: no-sidebar recentre and target size'
dependencies:
- WP03
- WP05
requirement_refs:
- FR-010
- FR-011
- NFR-004
- SC-003
- C-003
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: d15f1a77b18d808ec18cfe1c23610f852fc1e915
created_at: '2026-10-19T08:03:47.788312+00:00'
subtasks:
- T030
- T031
- T032
- T033
- T034
- T035
phase: Phase 3 - Guards
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent:
- tests/a11y/no-sidebar-recentre.spec.ts
- tests/a11y/target-size.spec.ts
- tests/a11y/helpers/no-sidebar.ts
- tests/a11y/helpers/targets.ts
execution_mode: code_change
model: ''
owned_files:
- tests/a11y/no-sidebar-recentre.spec.ts
- tests/a11y/target-size.spec.ts
- tests/a11y/helpers/no-sidebar.ts
- tests/a11y/helpers/targets.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP06 – Geometry guards: no-sidebar recentre and target size

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `frontend-freddy`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## ⚠️ IMPORTANT: Review Feedback

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_ref` field in the event log (via `spec-kitty agent tasks status`).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Report progress**: As you address each feedback item, record what you changed with `spec-kitty agent tasks add-history <WPID> --note "..."` (stored in the status event log).

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`,````bash`

---

## Objectives & Success Criteria

Add two guards to the a11y lane. Each pins a requirement of mission
`sidebar-frame-header-carrier-01M4T3CB` that has no automated test today, and each
is proven to fail first.

1. **#199, FR-010.** On a page with a rail and no left sidebar, the reading column
   is centred, collapsed and expanded, at 1152, 1280, 1600, 1920 and 2560. A
   DOM-derived simulation produces that page.
2. **#202, NFR-004.** Every interactive target in the header, sidebar, rail and
   footer is at least 24 × 24 CSS px, or meets the WCAG 2.5.8 spacing exception.
   Each region has at least one target.

Requirements: FR-010, FR-011, NFR-004, SC-003. No product code changes: if a guard
finds a real defect, report it and stop. Do not fix CSS here.

## Context & Constraints

- **Research** (Freddy, #199 and #202 in
  `docs/architecture/research/layout-guards-and-decisions.md`):
  - **The simulation that matches a real page**: on a normal rail page, remove the
    `data-has-sidebar` attribute from `<html>` **and** remove the sidebar element.
    Removing only the attribute leaves the fixed sidebar over the pane, a shape
    that never ships.
  - Measured against a real `StarlightPage hasSidebar={false}` page, all ten points
    (5 widths × 2 states) matched within 1 px. The column was 60rem wide (the
    toolkit overrides Starlight's no-sidebar 67.5rem).
  - **The FR-010 CSS rule has no effect on 0.42.** Starlight already centres a page
    without a sidebar, so deleting the toolkit's `:not([data-has-sidebar])` selector
    does not make the test red. The fail-first mutation must break the pane's
    margin instead, for example by injecting
    `html .main-pane { --sl-content-margin-inline: auto 0 !important; }`.
  - **Targets measured**: header 32 × 32; sidebar links at least 28 tall; rail
    outline links exactly 24.0 tall; toggle 32 × 32; footer pagination 320 × 92.
    Undersized targets were all in content. axe's `target-size` rule already runs
    (`tests/a11y/routes.ts`, `WCAG_TAGS` includes `wcag22aa`), but axe files
    ambiguous cases as incomplete, which the lane ignores.
  - The fail-first mutation for targets is
    `.right-sidebar-panel a{min-block-size:0;min-height:0;padding-block:0}`.
- **Final geometry** comes from WP05 (120rem default cap, collapsed-pane padding)
  and WP03 (the `Sidebar` carrier). Run against a fresh `pnpm build:a11y` of the
  merged lane.
- **Conventions**: copy `tests/a11y/layout-geometry.spec.ts` for settling, toggling
  the collapsed state, and the light-project-only skip. Read `tests/a11y/routes.ts`
  for route constants and helpers. Import them; do not edit that file, which WP08
  owns.
- **Local Playwright**: use an uncommitted config with
  `executablePath: '/opt/pw-browsers/chromium'`.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

```bash
spec-kitty agent action implement WP06 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T030 – Write the no-sidebar simulation helper

- **Steps**: create `tests/a11y/helpers/no-sidebar.ts`:
  1. Export `async function simulateNoSidebar(page: Page): Promise<void>`. It runs
     in the page:
     - remove `data-has-sidebar` from `document.documentElement`;
     - remove the sidebar pane element, the fixed `.sidebar-pane` that wraps
       `nav.sidebar`. Check the built markup for the exact element (Starlight
       0.42's `PageFrame` renders the sidebar in a `<nav>` inside `.sidebar-pane`).
       Remove the outermost element that takes layout, so nothing fixed is left
       over the pane;
     - wait two animation frames for layout.
  2. Assert inside the helper that after removal there is no `#starlight__sidebar`
     and no `.sidebar-pane`, and that `[data-has-toc]` is still present. This keeps
     the simulation honest: the rail must stay.
  3. The doc comment says why this equals a real `StarlightPage hasSidebar:false`
     page (cite the research measurement) and why a fixture page is not used (C-003:
     no test pages in the example, because the sitemap count would change).

### Subtask T031 – Write `no-sidebar-recentre.spec.ts` (FR-010 guard)

- **Steps**:
  1. Use the rail page `/doc-kitty/guides/markua-showcase/` (it has a rail). Before
     simulating, assert the outline exists; the spec must not pass vacuously on a
     page without a rail.
  2. For each width in 1152, 1280, 1600, 1920 and 2560, and each state, expanded and
     collapsed (collapse first, then simulate, or in whichever order matches how a
     real page would load; justify the order in a comment):
     - **Collapsed.** The column is centred in the frame: the gap at the frame start
       equals the gap at the frame end ±1. Use the frame box (`.main-frame`), which
       is capped at 120rem from WP05.
     - **Expanded.** The column is centred in the space between the frame start and
       the rail start, ±1.
     - The column width is `min(960, available)` ±1.
     - There is no horizontal page scroll.
  3. A positive control in the same spec, on the same page: inject the mutation from
     Context, re-measure at 1920 collapsed, and assert the centring now fails, so the
     check can see it. Use a separate `test` whose name says "positive control".
- **Notes**: FR-010's collapsed case is the requirement's own words; the expanded
  case is extra coverage. Measure boxes, not text.

### Subtask T032 – Write the target collector

- **Steps**: create `tests/a11y/helpers/targets.ts`, with collection running in the
  page through `page.evaluate`:
  1. Regions, each a CSS selector:
     - header: `header.header`;
     - sidebar: `#starlight__sidebar`;
     - rail: `.right-sidebar-container`, which includes the toggle;
     - footer: `.pagination-links` or the footer pagination container. Check the
       built markup.
  2. Targets: `a[href], button, input:not([type=hidden]), select, summary, [role=button]`
     within each region.
  3. Keep a target only if it is rendered: it has client rects, its computed
     `visibility` is not `hidden`, `pointer-events` is not `none`, its width and
     height are above 0, and no ancestor has `display: none`.
  4. For a wrapped inline link, take the union of `getClientRects()`; record each
     rect too, for the spacing check.
  5. Return `{ region, label, rect, rects }[]`. The label is the accessible name, or
     the text trimmed to 40 characters, so failures are readable.

### Subtask T033 – Write the WCAG 2.5.8 spacing-exception check

- **Steps**: in the same helper, a pure function, unit-testable inside the spec:
  1. A target passes if `width >= 23.99 && height >= 23.99`.
  2. Otherwise it passes under the spacing exception if a 24 px circle centred on
     its box's centre does not intersect any other target's rect (the distance from
     the centre to the nearest point of the rect is at least 12), **and** does not
     intersect the 24 px circle of any other undersized target (the distance between
     centres is at least 24).
  3. Skip ancestor and descendant pairs: nested targets are one target. Pass a
     `contains` relation from the page, such as each target's index path.
  4. No inline-text exemption: the scope is page chrome only.
  5. Return failures as `region label WxH (nearest conflict: …)`.
  6. **Synthetic tests** in `target-size.spec.ts`, which can run in plain Node: a
     24 × 24 pass, a 20 × 20 isolated pass, a 20 × 20 with a neighbour 10 px away
     failing, and two undersized targets 20 px apart failing.

### Subtask T034 – Write `target-size.spec.ts` over the route and width matrix

- **Steps**:
  1. Matrix:
     - routes: home `/doc-kitty/`, `/doc-kitty/rhetoric/book-one/chapter-15/` (long
       sidebar), `/doc-kitty/behaviour/shipping/book-consignment/` (a dense outline);
     - widths 1280 and 1920, rail expanded and collapsed;
     - plus 390 × 800 with the mobile menu open
       (`button[popovertarget="starlight__sidebar"]`), sidebar region only.
  2. Per cell:
     - each region that should exist has at least one target. The rail is absent on
       pages without an outline and absent when collapsed, apart from the toggle;
       encode which regions are expected per route and state;
     - the rail always includes the toggle at desktop widths;
     - `expect.soft` once per failing target, with the message from T033.
  3. Light project only.

### Subtask T035 – Record the fail-first proofs for both guards

- **Steps**:
  1. Recentre: the positive-control test is part of the spec. Also run the spec
     once with the mutation forced into every cell (a temporary `addStyleTag` in the
     helper), and paste the red summary into the history. Then revert.
  2. Targets: run the spec once with the rail-link mutation from Context injected.
     Rail cells must go red with `rail …` messages. Paste the output, then revert.
  3. Both specs are green unmutated, against a fresh `pnpm build:a11y`.
  4. If either guard is red unmutated, that is a real defect: stop, report it in
     the history with the measurement, and leave the WP in progress for the
     orchestrator.

## Test Strategy

```bash
pnpm build:a11y
npx playwright test -c <local-config> tests/a11y/no-sidebar-recentre.spec.ts tests/a11y/target-size.spec.ts --project light
pnpm exec tsc --noEmit -p tests/a11y 2>/dev/null || pnpm exec tsc --noEmit   # whichever the repo uses for tests/a11y typing
pnpm lint
```

Check how `tests/a11y` is type-checked: if Playwright's own TypeScript transform is
the only check, say so in the history.

## Risks & Mitigations

- **A vacuous pass.** Each region needs at least one target, and the recentre spec
  checks that the rail exists. Both positive controls prove the probes can see a
  failure.
- **Font dependence.** Measure element boxes only.
- **The spec runs too long** (NFR-001 is the published lane's budget). Keep the
  matrix as given; one page load per cell.

## Review Guidance

- Both specs are green on the merged lane, and the red runs under mutation are in
  the history.
- The simulation removes both the attribute and the sidebar element, and asserts the
  rail is still there.
- The spacing algorithm has synthetic unit cases.
- No product file was touched.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP06 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP06 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
