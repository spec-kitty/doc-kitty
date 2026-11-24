---
work_package_id: WP03
title: Section and whole-site print routes
dependencies:
- WP01
- WP02
requirement_refs:
- FR-014
- FR-015
- FR-016
- FR-017
- FR-018
- FR-019
- NFR-005
- SC-002
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
- T017
- T018
- T019
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/print/
create_intent:
- src/lib/print/order.ts
- src/lib/print/rewrite.ts
- src/lib/routes/print-injected.astro
- src/components/print/PrintCover.astro
- src/components/print/PrintPage.astro
- src/lib/integrations/print-route.ts
- src/tests/print-order.test.ts
- src/tests/print-rewrite.test.ts
- src/tests/print-route.test.ts
execution_mode: code_change
owned_files:
- src/lib/print/order.ts
- src/lib/print/rewrite.ts
- src/lib/routes/print-injected.astro
- src/components/print/**
- src/lib/integrations/print-route.ts
- src/package.json
- src/scripts/assert-build-artifacts.mjs
- src/scripts/site-config-eval.mjs
- example/docs/_meta/sections.yaml
- example/astro.config.mjs
- src/tests/print-order.test.ts
- src/tests/print-rewrite.test.ts
- src/tests/print-route.test.ts
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP03 – Section and whole-site print routes

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP03 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

`/print/<section>/` and `/print/` render whole sections or the whole site through the site's own content render (#380 and the whole-site ruling). Requirements: FR-014–FR-019, NFR-005. Contract: `contracts/print-route.md`.

Out-of-map: one registration line in `src/lib/config.ts` (owned by WP02), recorded in the commit message.

## Subtasks

### T013 `print/order.ts` (pure)

`printOrder(entries, sectionId, opts)`: depth-first slug tree walk; folder index first, then children by `sidebar.order` (if set), title (`localeCompare 'en'`), slug code unit. Filters: `excludeKinds`, `doc_status` draft only when `DK_PUBLISH_DRAFTS` is off (the loader already drops them), ADR-0070 excluded folders are absent from the collection. `siteOrder(registry, resolved)`: sections in registry order minus `excludeSections`/`omit`, then folders with no registry entry (by name), then `appendix` sections. The section index page is returned separately as the cover body (D-06).

### T014 `print/rewrite.ts` (pure)

`rewritePage(html, { prefix, pageHrefs: Map<path, index>, base, site, demote })`: prefix `id`, `href="#…"`, `xlink:href="#…"`, `url(#…)`, `aria-labelledby|aria-describedby|aria-controls|for`, and `#id` selectors inside `<style>` blocks (only for ids defined in the page); same-document page links → `#p<N>` or `#p<N>-frag`; other root-relative links → absolute `site + path`; every rewritten link gets `data-dk-print-link`; demote `<hN>` by `demote` (cap 6), including Starlight `level-hN` wrapper classes.

### T015 Route and components

`src/lib/routes/print-injected.astro` with `getStaticPaths` from `pdfOptions()` + registry: `{ name: '<id>' }` per section PDF, `{ name: undefined }` for `/print/` when `site`. `StarlightPage` frontmatter: `title`, `description`, `doc_status: 'active'`, `pagefind: false`, `head: [robots noindex]`, `kind`? none. `PrintCover.astro` renders no `<h1>`: the cover title is the `StarlightPage` title (`h1#_top` through `PageTitle`). It holds the index page's body as cover body with its headings demoted below the page-title level (section document: `h2`→`h4`; whole-site: `h2`→`h5`), so they never enter the outline's page-title depth, site name, purpose/description, build date from `SOURCE_DATE_EPOCH` or `git log -1 --format=%ct`, TOC). Cover and TOC use no `h2`/`h3`. `PrintPage.astro`: `Astro.slots.render('default')` → `rewritePage` → `set:html`; hero with title (`h2`/`h3`), `doc_status`, `updated`; `class="dk-print-page"` with `break-before: page` (rule in `print.css` scoped `.dk-print-document`).

### T016 Route integration

`src/lib/integrations/print-route.ts`: `injectRoute({ pattern: '/print/[...name]', entrypoint: '@spec-kitty/doc-toolkit/routes/print-injected.astro', prerender: true })` only when any document exists; `registerSitemapPredicate('print:routes', page => !/\/print\//.test(page))`; collision check against `/print` content; `astro:build:done` writes `dist/print/manifest.json` (contract in `data-model.md`) by reading the rendered pages' `data-dk-print-*` attributes. Export path added to `src/package.json` `exports`.

### T017 Build gate

`assert-build-artifacts.mjs`: derive the expected document names from `sections.yaml` (extended `vocabulary-loader.mjs`) and the evaluated site config (`site-config-eval.mjs`, extended to return the `DK_PDF_OPTIONS` value and to clear that env name in its child process), never from `print/manifest.json` (used only for counts/titles); assert `print/manifest.json` lists exactly the expected names, each route exists, has `noindex`, no `data-pagefind-body`, one `<h1>`, no duplicate `id`, and is absent from `sitemap-*.xml`; every same-site absolute link maps to a built file; and no `print/<id>/` exists for a section without a PDF; a manifest document with `pages: 0` fails (a section with `pdf: true` and no published pages). Sitemap/index pins unchanged.

### T018 Example opt-in

`example/docs/_meta/sections.yaml`: `architecture: pdf: true`, `guides: pdf: true`, `rhetoric: pdf: { site: appendix }`. `example/astro.config.mjs`: `pdf: { site: true }`.

### T019 Tests

Order (index first, sort keys, floor exclusion, appendix last), rewrite (ids, url(#), style selectors, links, demotion, no change to text containing `#`), integration (injects only when needed, predicate, collision).

## Definition of Done

Example builds; `assert-build-artifacts` and `assert-no-broken-links` pass on drafts-on and drafts-off builds; unit tests pass.
