---
work_package_id: WP06
title: Specification layout and test lanes
dependencies:
- WP05
requirement_refs:
- FR-014
- FR-015
- FR-017
- FR-018
- NFR-003
- NFR-004
- NFR-005
- C-004
- SC-004
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: 6210f49a2e8ffdc2d916ad7bbc2c7f5d1a1fc7f8
created_at: '2026-10-19T07:38:26.513219+00:00'
subtasks:
- T024
- T025
- T026
- T027
- T028
- T029
phase: 'Phase 3 - #198 presentation'
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/layouts/
create_intent:
- src/lib/spec-card.ts
- src/layouts/Specification.astro
- src/styles/specification.css
- src/scripts/assert-specification-artifacts.mjs
- src/tests/spec-card.test.ts
- src/tests/specification-css.test.ts
execution_mode: code_change
model: ''
owned_files:
- src/lib/spec-card.ts
- src/layouts/Specification.astro
- src/styles/specification.css
- src/lib/manifest.ts
- src/scripts/assert-specification-artifacts.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/spec-card.test.ts
- src/tests/specification-css.test.ts
- src/tests/manifest-plugin.test.ts
- tests/a11y/routes.ts
- tests/a11y/layout-geometry.spec.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP06 – Specification layout and test lanes

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
Use language identifiers in code blocks: ````astro`, ````ts`, ````css`

---

## Objectives & Success Criteria

Ship the base-kind `Specification` layout:

- A labelled header card above the content shows the feature's **tags** and its
  **source**. The source is a link when it resolves to a URL, plain text
  otherwise.
- The "On this page" TOC stays the only scenario navigation (D9, FR-015).
- The ADR-0055 results summary stays in the body, unrepeated (operator decision
  `01M59CQM76Q0NJ3F3GM1S8BYAN`).
- The layout is on by default for `kind: Specification`. A theme maps
  `Specification` to `Default` to opt out (FR-017).

Also bring feature pages into the geometry and axe lanes (FR-018).

**Done when**:

- The card model, manifest and CSS unit tests pass.
- The new artifact module passes on the example build.
- `pnpm test:a11y` passes with the two added routes.

## Context & Constraints

- Spec: FR-014, FR-015, FR-017, FR-018, NFR-003, NFR-004, NFR-005, C-004,
  SC-004; US3 scenarios 1, 2, 4, 5 and 6.
- Contract: `contracts/specification-layout.md` gives the card markup, the
  resolution rule and the styling rule.
- Research: R-08 (card content and degradation; source link rule).
- **Source rule.** The generator writes `sources[0].resource` as
  `sourceUrlPrefix + relative path`; `src/lib/routes/scenario-index.ts:172`
  documents the inverse. So:
  - an absolute `http(s)://` resource renders as `<a href>`, with text that is
    the path portion after the prefix (or the last path segments; keep it
    readable and test it);
  - anything else renders as `<code>` text.

  The example sets no prefix, so it shows text. The link form is proven in
  `spec-card.test.ts`.
- **Layout resolution.** `src/lib/manifest.ts:72-74` has
  `BASE_KIND_LAYOUTS = { Hub: ... }`, and themes merge over it per key
  (`:96-99`). The carrier is `MarkdownContent.astro:54-58`. Read `Hub.astro` for
  the in-frame layout contract: props are the Starlight route data, the body
  flows through `<slot />`, and styles come from an imported sheet
  (`import '../styles/hub.css'`). Mirror it.
- **Accessibility.** The card is a `<section aria-labelledby>` with a visually
  hidden heading "Specification details" (use the repo's existing
  visually-hidden class). It is not a `nav` and has no `aria-current`. Check
  that Starlight's TOC does not list the hidden card heading. The TOC is built
  from Markdown headings, so a layout-level heading should not appear; verify
  on the build.
- **Draft notice.** WP05 renders it in the page-title carrier. The card never
  renders its own.
- **Lanes.** `tests/a11y/routes.ts` already has `behaviourFeature`
  (`/behaviour/shipping/book-consignment/`, around lines 98–103) in the axe
  matrix (around 410–414). `layout-geometry.spec.ts:433-439` `SCROLL_ROUTES`
  has no feature page.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP06 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T024 – Pure card model `src/lib/spec-card.ts`

- **Purpose**: Keep the decisions testable without a build.
- **Steps**:
  1. **Red first.** Create `src/tests/spec-card.test.ts`:
     - `specCard({ tags: ['FR-003', 'shipping'], sources: [{ resource: 'features/a.feature', title: 'Gherkin source' }] })`
       gives `{ tags: [...], source: { text: 'features/a.feature' } }` (no
       href).
     - A `resource` of `https://github.com/o/r/blob/main/features/a.feature`
       gives `source.href` equal to that URL, and readable `source.text`.
     - `tags: []` with no sources gives `null` (no card).
     - `@dk:*` tags never appear (defensive filter, even though frontmatter
       `tags` excludes them today).
     - A non-http resource such as `javascript:…` never becomes an href. This
       is a security guard: only `http:` and `https:` are allowed.
  2. Implement `specCard(data)` as a pure TypeScript function with a typed
     return.
- **Files**: `src/lib/spec-card.ts`, `src/tests/spec-card.test.ts`.

### Subtask T025 – `Specification.astro` and `specification.css`

- **Steps**:
  1. Create `src/layouts/Specification.astro` with the same props contract as
     `Default.astro` and `Hub.astro`. Compute `card = specCard(entry.data)`. If
     `card` is set, render the contract markup **before** `<slot />`; otherwise
     render only `<slot />`.
  2. Create `src/styles/specification.css` with `.dk-spec-card`,
     `.dk-spec-card__tags` (an inline list of chips), and
     `.dk-spec-card__source` (monospace path, `overflow-wrap: anywhere` so long
     paths wrap at 390px).
     - Use only `var(--dk-*)` for colour, spacing, radius and type.
     - Keep chips at least 24px high as targets only if they are interactive.
       Here they are text, so just keep readable spacing.
  3. Import the sheet from the layout, as Hub does.
- **Files**: `src/layouts/Specification.astro`, `src/styles/specification.css`.

### Subtask T026 – Register the base kind

- **Steps**:
  1. **Red first** in `src/tests/manifest-plugin.test.ts`:
     - with no theme, `generateManifestSource(resolved)` maps `Specification`
       to the new layout path;
     - a theme with `layouts: { Specification: '<Default path>' }` overrides
       it. That is the opt-out.
     - `Hub` is unchanged.
  2. Add `Specification: '@spec-kitty/doc-toolkit/layouts/Specification.astro'`
     to `BASE_KIND_LAYOUTS`. Confirm the package `exports` (`src/package.json`)
     already exposes `./layouts/*`; if not, add the export. That counts as a
     recorded out-of-map edit; note it in history.
- **Files**: `src/lib/manifest.ts`, `src/tests/manifest-plugin.test.ts`.

### Subtask T027 – Built-artifact module

- **Steps**:
  1. Create `src/scripts/assert-specification-artifacts.mjs`, in the same style
     as `assert-chrome-artifacts.mjs` (zero dependencies, string search, exit
     non-zero on the first failure). On `<dist>/behaviour/shipping/book-consignment/index.html`:
     - exactly one `class="dk-spec-card"`;
     - the tag text `FR-003` inside it;
     - `features/shipping/book-consignment.feature` inside it;
     - no `<nav` inside the card;
     - exactly one Starlight TOC (`starlight-toc`, or the marker the existing
       rail checks use);
     - **at most one** `class="dk-gherkin__results"` on the page, so the card
       never repeats it.
     Then a non-Specification page (a Hub or guide) has **no** `dk-spec-card`.
     That is the positive and negative pair.
  2. Import and call it from `assert-build-artifacts.mjs`, the way the chrome
     module is wired. Only that wiring line changes in that file.
  3. Run `pnpm --filter example build && pnpm assert:artifacts`. Also run it on
     the drafts-off dist; `book-consignment` is active, so it exists there too.
- **Files**: `src/scripts/assert-specification-artifacts.mjs`, `src/scripts/assert-build-artifacts.mjs`.

### Subtask T028 – Geometry and axe routes

- **Steps**:
  1. In `tests/a11y/routes.ts`:
     - add `behaviourDraftFeature: '${BASE}/behaviour/shipping/track-consignment/'`
       with a comment (it is the `@wip` draft);
     - add it to the axe matrix in both colour modes, with guard roots that
       require the draft notice (`.dk-draft-notice`), so the scan cannot pass
       on a page without it.
  2. In `tests/a11y/layout-geometry.spec.ts`, add both `behaviourFeature` and
     `behaviourDraftFeature` to `SCROLL_ROUTES`.
  3. Run `pnpm test:a11y`. It needs a built example; follow the repo's
     Playwright config (`playwright.config.ts`) for how it serves `dist`. Fix
     real overflow or contrast problems in this WP's CSS. Update visual
     baselines only for intended changes, with a history note.
- **Parallel?**: Yes, independent of T024–T027 until the run.

### Subtask T029 – Literal guard for `specification.css`

- **Steps**: create `src/tests/specification-css.test.ts`. It reads the sheet
  and fails on any hex, `rgb(`, `hsl(`, named colour or bare length outside
  `var()`. It also asserts at least one `var(--dk-` declaration exists, as the
  positive control. Reuse WP05's parsing helper only if it is exported from a
  shared test util; otherwise keep a small local parser. Do not edit WP05's test
  file.
- **Parallel?**: Yes.

## Test Strategy

- **Red first** for T024, T026, T027 and T029.
- `pnpm test`, then the TypeScript typecheck, then the example build plus
  `pnpm assert:artifacts`, then `pnpm test:a11y`.

## Risks & Mitigations

- **Hidden heading appears in the TOC.** Verify on the built page, and move the
  heading or use `aria-label` instead if needed. Record the choice.
- **Authored `kind: Specification` pages.** The example has none, so the
  degradation is proven by `spec-card` returning `null` and by the layout
  rendering only `<slot />`.
- **Geometry at 390px.** Long source paths must wrap; test it.

## Review Guidance

- **Navigation**: one scenario navigation (the TOC). The card is a region, not
  a nav.
- **Results summary**: not duplicated.
- **Theme opt-out**: proven in the manifest test.
- **Security**: only `http` and `https` sources become links.
- **Styling**: tokens only, enforced by a test with a positive control.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP06 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP06 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
