---
work_package_id: WP04
title: Sidebar and table-of-contents shaping
dependencies: []
requirement_refs:
- FR-011
- FR-019
- FR-020
- FR-021
- FR-022
- FR-023
- NFR-006
- C-004
- SC-006
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-sidebar-frame-header-carrier-01M4T3CB
base_commit: c10d67936cda48f5015edce95b5bd75c85c87515
created_at: '2026-10-13T07:56:12.094530+00:00'
subtasks:
- T018
- T019
- T020
- T021
- T022
- T023
- T024
- T025
history: []
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/route-shaping.ts
- src/lib/route-middleware.ts
- src/tests/route-shaping.test.ts
- src/tests/sidebar-build-html.test.ts
execution_mode: code_change
owned_files:
- src/lib/route-shaping.ts
- src/lib/route-middleware.ts
- src/lib/config.ts
- src/lib/sections.ts
- src/package.json
- src/tests/route-shaping.test.ts
- src/tests/sidebar-build-html.test.ts
- example/docs/**/index.md
role: implementer
tags: []
tracker_refs: []
---

# WP04 — Sidebar and table-of-contents shaping

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`node-norris`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Make the left sidebar read like a table of contents: nested groups labelled and ordered from their index pages, each index first, the current entry in view on load; and stop reserving a rail for a table of contents with one entry or fewer.

Requirements: FR-011, FR-019, FR-020, FR-021, FR-022, FR-023, NFR-005, NFR-006, C-004. Research: R5, R6, R7.

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## What is wrong today

`registrySidebar()` in `src/lib/config.ts` builds one `autogenerate` group per registered top-level section (`registryToSidebar()` in `src/lib/sections.ts`). Top-level labels come from `sections.yaml` and are fine. Inside each group Starlight 0.32 autogenerates subgroups and labels them with the **directory name**.

Observed on the published example site:

- group labels `audience`, `missions`, `book-one`, `book-three`, `book-two`, `hr`, `rhetoric`, `shipping`;
- order alphabetical by slug, so book three precedes book two;
- section index pages in the middle of their group (`/plans/` after its missions, `/rhetoric/` after the books);
- on a deep page the current entry sits far below the visible part of the sidebar (measured y=1621 with scroll position 0);
- hub and persona pages reserve a 360px rail for a single "Overview" link.

## Subtask T018 — Spike: can route middleware rewrite the sidebar and TOC?

**Purpose**: de-risk the approach before building on it. Time-box to about an hour.

Starlight 0.32.6 accepts `routeMiddleware` (see `node_modules/@astrojs/starlight/utils/user-config.ts` around line 231 and `utils/routing/types.ts`: route data exposes `sidebar: SidebarEntry[]` and `toc`). A middleware module exports `onRequest` created with `defineRouteMiddleware` from `@astrojs/starlight/route-data` and can mutate `context.locals.starlightRoute`.

**Steps**:
1. Write a throwaway middleware in the example that renames one group label and sets `toc = undefined` on one page; register it through the integration's Starlight options.
2. Build. Confirm in the HTML that the label changed on every page, that prev/next links still work, that `aria-current` is still on the right entry, and that the page with `toc` removed has no `.right-sidebar` and no `data-has-toc`.
3. Confirm the middleware resolves from a consumer install (a package-export specifier such as `@spec-kitty/doc-toolkit/route-middleware`), not only inside this monorepo.
4. Check how `starlight.routeMiddleware` supplied by a consumer through the escape hatch composes with the toolkit's (it must be an array merge, toolkit first, consumer after — C-004).

**Outcome**: if all four hold, continue with T019–T022 as written. If the sidebar cannot be rewritten this way, use the fallback from research R5: build an explicit nested sidebar config at config time from the docs index, inside `registrySidebar()`, and keep the same pure shaping function. Record the outcome and the reason in your hand-off and in the module header.

## Subtask T019 — Directory metadata map

**Purpose**: one lookup from directory path to label, order and index route.

**Steps**: in `src/lib/route-shaping.ts`, write a pure function that takes the docs entries (the same data `src/lib/docs-index.ts` collects: slug, title, front matter including the Starlight `sidebar` block, and whether the entry is an index page under the configured index basename — see `index-basename` handling in `config.ts`/`docs-index.ts`) and returns `Map<dirPath, { label?: string; order?: number; indexHref?: string }>`.

- `label` = the index page's `sidebar.label` if set, else its `title`.
- `order` = the index page's `sidebar.order` if set.
- A directory with no index page has no entry in the map.
- Deterministic: sort inputs with the shared comparator from `src/lib/vocabulary-core.mjs` (`compareCodeUnit`) wherever iteration order could matter (NFR-006).

## Subtask T020 — Pure sidebar shaping function

**Purpose**: the testable core. Signature along the lines of `shapeSidebar(entries: SidebarEntry[], meta: Map<…>, options): { sidebar: SidebarEntry[]; warnings: string[] }`.

**Rules** (data-model.md, "Sidebar group metadata"):
1. For each **group** entry that corresponds to a directory (derive the directory from the hrefs of its link descendants: the longest common path segment prefix; do not rely on the label):
   - label: `meta.label`; else a humanised directory name (`book-one` → `Book one`) plus a warning naming the directory (FR-023);
   - if the group contains a link whose href equals `meta.indexHref`, move that link to position 0 (FR-021).
2. Order the children of every group: entries with an `order` ascending; then entries without, by label using `compareCodeUnit`; links keep Starlight's own `sidebar.order` handling relative to each other — do not reorder links among themselves beyond moving the index first (FR-020).
3. Recurse into nested groups.
4. Do not touch top-level groups' labels (they come from `sections.yaml`) or their order.
5. Do not mutate the input; return new objects. Preserve every other field (`collapsed`, `badge`, `attrs`, `isCurrent`).
6. Idempotent: shaping an already shaped tree returns an equal tree.

**Consumer precedence (C-004)**: when the consumer supplies their own `sidebar` config, the integration does not register shaping for it. Decide where that switch lives (the integration knows whether `resolvedSidebar` came from the registry or the consumer) and test it.

**Draft index pages**: WP05 will filter drafts out when the setting is off. A group whose index is absent then falls to the humanised label. Make sure shaping does not throw on a missing index, and does not warn for a directory whose index exists but is filtered (accept an optional set of known-but-unpublished directories).

## Subtask T021 — Near-empty table of contents

**Purpose**: FR-011.

**Steps**: export `shapeToc(toc)` that returns `undefined` when `toc` has no item other than the page-title entry (Starlight's first item, the "Overview" link to `#_top`) — that is, `items.length <= 1` and that item has no children. Otherwise return it unchanged. Front-matter `tableOfContents: false` already yields `undefined`.

## Subtask T022 — Wire the middleware into the integration

**Steps**:
1. `src/lib/route-middleware.ts`: `defineRouteMiddleware` that reads the metadata map (build it once at module scope from the docs collection, or have the integration serialise it into a virtual module the way `src/lib/manifest.ts` does for slot components — prefer the pattern already in the codebase), applies `shapeSidebar` and `shapeToc`, and assigns the results.
2. `src/lib/config.ts`: add the middleware specifier to the Starlight options the integration builds, merged **before** any consumer-supplied `routeMiddleware`. Only when the sidebar is toolkit-generated.
3. `src/package.json`: add the export for the middleware module, following the existing `./components/*` and `./config` entries; check `files`/tarball inclusion (`src/tests/package-runtime-deps.test.ts` and the consumption test will tell you).
4. Emit shaping warnings once per build, not once per page (collect in the integration, print in a build hook, prefixed like the existing `[dk-sections]` warnings).

`src/lib/config.ts` is owned by this work package. WP05 and WP06 will make small edits to it later; leave clear, separate insertion points (do not restructure the file).

## Subtask T023 — Reveal the current sidebar entry

**Purpose**: FR-022 without layout shift (NFR-005).

**Steps**:
1. Find how Starlight 0.32 persists sidebar state (`SidebarPersister.astro`, `SidebarRestorePoint`): it restores group open state and scroll position from `sessionStorage` on navigation within a session. On a first visit there is nothing to restore.
2. Add a small inline script that runs after the sidebar markup (through an existing carrier — `Head.astro` with a `DOMContentLoaded`-free inline script placed late is not acceptable if it runs before the sidebar exists; the cleanest place is an inline `<script is:inline>` rendered by a carrier that outputs after the sidebar, or a `head` entry that defers to `document.currentScript`-free logic on `DOMContentLoaded`). It finds `#starlight__sidebar [aria-current="page"]`; if its bounding box is outside the sidebar scroll container's visible range, call `scrollIntoView({ block: 'center' })` on it, scoped so the **page** does not scroll (set the container's `scrollTop` directly instead if `scrollIntoView` moves the document).
3. It must not fight the persister: run after restoration, and only when the entry is out of view.
4. No dependency, no framework; a dozen lines. Put the source in `src/lib/` next to the other inline scripts (see `src/lib/toc-rail/pre-paint.ts` for the house pattern of a tested string-returning module) inside `route-shaping.ts` or a sibling you add to `owned_files` in your hand-off.

## Subtask T024 — Example site: titles and order for nested sections

**Steps**: for each nested directory in `example/docs` that showed a raw slug (`context/audience`, `plans/missions`, `rhetoric/book-one|two|three`, the glossary contexts `hr`, `rhetoric`, `shipping`):
1. If it has an index page, make sure its `title` is a reader-facing title and add `sidebar: { order: n }` where order matters (books 1, 2, 3).
2. If it has none and is authored content, add a short index page with valid front matter (run `pnpm validate:example`; required fields are enforced).
3. Glossary context pages are **generated** by the glossary integration (`src/lib/glossary/…`); do not hand-write files there. If the generated index titles are lowercase context ids, note it in your hand-off as a follow-up rather than editing generated output, unless the generator has an obvious title field to set.

Keep `example/url-baseline.txt` consistent: adding index pages adds URLs; the redirect-coverage gate (`pnpm` script in `package.json`) tells you what to update.

## Subtask T025 — Tests

1. `src/tests/route-shaping.test.ts` (unit): label from index title; label from `sidebar.label`; humanised fallback + warning; order by declared order then label; index first; nested recursion; idempotence; input not mutated; shuffled input gives identical output; unknown directory; `shapeToc` for 0, 1 and 2+ items and for a single item with children.
2. `src/tests/sidebar-build-html.test.ts` (built HTML, following `toc-rail-build-html.test.ts`): no sidebar group label equals a directory slug from the list above; "Book one/two/three" (whatever titles you set) appear in that order; each section's index is first in its group; a hub page has no `.right-sidebar`; sidebars of two different pages are identical apart from `aria-current`.
3. Mutation check: break each rule once and see a test fail.

## Verification

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm validate`, `pnpm clean && pnpm build`, then the link and artifact gates (`pnpm assert:artifacts`, `pnpm assert:no-broken-links` if present in `package.json`).

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP04 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- Spike outcome recorded; the chosen mechanism is implemented.
- `shapeSidebar` and `shapeToc` are pure, tested, deterministic and idempotent.
- The built example sidebar has no raw directory labels for authored sections, numbered sections in numeric order, and each index first.
- Pages with a near-empty TOC have no rail.
- The current entry is in view on load of a deep page, with no visible content movement.
- A consumer-supplied sidebar is not reshaped (tested).
- All unit, lint, typecheck, validate and build gates pass.

## Risks

- **Middleware reach**: settled by T018; fallback defined.
- **Directory inference** from hrefs must respect the site `base` (`/doc-kitty`) and the configurable index basename.
- **Sidebar identity across pages**: shaping must be a pure function of the tree, or pages will disagree.
- **Removing a rail changes baselines** for hub and persona pages (WP03 regenerates).
- **`config.ts` is large and shared**: keep the diff minimal and localised.

## Reviewer Guidance

- Read the spike note first: is the mechanism the one that was proven?
- Diff the sidebar HTML of two pages.
- Confirm warnings are emitted once per build.
- Confirm generated glossary files were not hand-edited.
