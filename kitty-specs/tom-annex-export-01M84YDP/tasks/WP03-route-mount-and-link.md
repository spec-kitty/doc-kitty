---
work_package_id: WP03
title: Route, conditional mount and discovery link
dependencies:
- WP01
- WP02
requirement_refs:
- FR-005
- FR-006
- FR-012
- C-003
- C-004
- C-005
- NFR-004
- NFR-005
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-tom-annex-export-01M84YDP
base_commit: 31444dba294c419db2a6aa60b8b97a477aea844a
created_at: '2026-11-23T22:52:10.346823+00:00'
subtasks:
- T010
- T011
- T012
- T013
- T014
- T015
- T016
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/integrations/tom-annex.ts
create_intent:
- src/lib/integrations/tom-annex.ts
- src/lib/tom-annex/scan.mjs
- src/lib/routes/tom-annex.ts
- src/lib/routes/tom-annex-injected.ts
- src/tests/tom-annex-scan.test.ts
- src/tests/tom-annex-route.test.ts
- src/tests/fixtures/tom-annex-scan/classified/docs/page.md
execution_mode: code_change
owned_files:
- src/lib/integrations/tom-annex.ts
- src/lib/tom-annex/scan.mjs
- src/lib/routes/tom-annex.ts
- src/lib/routes/tom-annex-injected.ts
- src/lib/served-surfaces.ts
- src/lib/contract.ts
- src/lib/routes/agent-index.ts
- src/lib/config.ts
- src/package.json
- src/tests/tom-annex-scan.test.ts
- src/tests/tom-annex-route.test.ts
- src/tests/fixtures/tom-annex-scan/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 - Route, conditional mount and discovery link

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Serve `/api/tom-annex.json` on every site that has **at least one published page
with `tom_classification`**, and only there. Link it from `api/index.json`
`_links.tomAnnex`. A site without classified pages must see no new route, no new
link and no new failure (FR-012).

> **Evidence index, not the contractual annex.** Not legal advice.

Requirements: FR-005, FR-006 (by construction), FR-012, C-003, C-004, C-005,
NFR-004, NFR-005. Depends on: WP01 (core) and WP02 (`siteContentGraph`).

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP03 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- **Pattern to copy**: `src/lib/integrations/content-graph.ts`, which uses a
  virtual options module, `injectRoute` and `prerender: true`. Its route is
  `src/lib/routes/content-graph.ts` plus `content-graph-injected.ts`, and the
  export is `src/package.json:36`.
- **Registration**: `src/lib/config.ts:983-987` adds `contentGraphIntegration`.
  Add the annex integration right after it.
- **Surface detection**: in `src/lib/served-surfaces.ts`, `SURFACE_ROUTES` maps a
  surface to its route pattern, and `detectServedSurfaces` sets the flag when the
  pattern is injected. Adding `tomAnnex: '/api/tom-annex.json'` there makes the
  flag follow the mount automatically.
- **`_links`**: `indexLinks()` in `src/lib/routes/agent-index.ts:189-219` follows
  the `scenarios` conditional-spread pattern. `DeclaredSurfaces` and the
  `declared` defaults are at about lines 222-234. `IndexLinks` is in
  `src/lib/contract.ts:138-151`.
- **Draft rule**: `draftRoutesOf(docsRoot, indexBasename)` in
  `src/lib/draft-publication.mjs:392`, wrapped by `siteDraftRoutes()` in
  `src/lib/integrations/shared.ts:19`. That is the sitemap's source (C-005). The
  graph already drops drafts (`buildContentGraph`).

## Subtasks

### T010 — Config-time scan for published classified pages

**Purpose**: Astro cannot skip a prerendered static endpoint at render time, so
the decision to mount is made at `astro:config:setup`.

**Steps**:
1. Create `src/lib/tom-annex/scan.mjs`, fs-based and bare-Node safe, exporting
   `hasPublishedClassifiedPages(docsRoot, indexBasename) -> boolean`:
   - Walk the docs tree with `walkMarkdownPaths` (`src/lib/docs-walk.mjs`), the
     same walk the graph uses.
   - Map each path to its route with `locatePages`.
   - Skip routes in `draftRoutesOf(...)`.
   - Parse frontmatter only, the way `draft-publication.mjs` reads `doc_status`.
     Reuse its reader if one is exported; otherwise use gray-matter, which the repo
     already depends on.
   - Return true on the first page whose frontmatter has a non-empty
     `tom_classification`.
   - Respect excluded folders (ADR-0070): check how `walkMarkdownPaths` and
     `draftRoutesOf` already handle them.
2. Red tests (`src/tests/tom-annex-scan.test.ts`), with fixtures under
   `src/tests/fixtures/tom-annex-scan/`:
   - A classified published page gives true.
   - The **same tree** with that page set to `doc_status: draft` gives false. This
     is the positive control.
   - An empty `tom_classification: []` gives false.
   - No classified pages gives false.
   - A classified page in an excluded folder gives false.

### T011 — Route factory and injected entrypoint

**Steps**:
1. Create `src/lib/routes/tom-annex.ts` exporting
   `tomAnnexRoute({docsDir, indexBasename}): APIRoute`:
   - `const { graph, measures } = await siteContentGraph({docsDir, indexBasename})`.
   - `const annex = buildTomAnnex(graph, {records: measures.records, source: measures.source, isDefault: measures.isDefault}, {site, base: import.meta.env.BASE_URL})`.
     Check how `absolute()` gets the base, and pass the same value.
   - Return `new Response(serializeTomAnnex(annex), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })`.
2. Create `tom-annex-injected.ts`, which mirrors `content-graph-injected.ts` with
   the virtual module `virtual:doc-kitty/tom-annex`.
3. Red test (`src/tests/tom-annex-route.test.ts`): drive the route with a mocked
   `siteContentGraph` (vi.mock), and assert the response body equals
   `serializeTomAnnex(buildTomAnnex(...))` and the content type. Keep it at the
   unit level; the real build is WP05's.

### T012 — Integration with a conditional mount

**Steps**:
1. Create `src/lib/integrations/tom-annex.ts` exporting
   `tomAnnexIntegration(docsDir, indexBasename): AstroIntegration`. In
   `astro:config:setup`:
   - resolve `docsRoot` the way the content-graph route does (`path.resolve(process.cwd(), docsDir)`);
   - if `!hasPublishedClassifiedPages(...)`, return without injecting anything;
   - otherwise add the virtual module and call
     `injectRoute({pattern: '/api/tom-annex.json', entrypoint: '@spec-kitty/doc-toolkit/routes/tom-annex-injected', prerender: true})`.
2. In `config.ts`, add it after `contentGraphIntegration(docsDir, indexBasename)`.
   Note: there is no site option in this WP. The hub page is a CLI flag (WP07).
3. **Order matters for surface detection.** Confirm that `detectServedSurfaces`
   sees routes injected by every integration, and check where it reads its
   patterns. If detection runs before this integration's `config:setup`, move the
   integration earlier or follow how `gherkin.ts:139` handles it.

### T013 — Surface flag and link type

**Steps**:
1. Add `tomAnnex: '/api/tom-annex.json'` to `SURFACE_ROUTES`. Update any test that
   enumerates the keys.
2. Add `tomAnnex?: AgentLink` to `IndexLinks`, with a doc comment: "Present only
   when a published page is classified (ADR-0080, #401). Evidence index, not the
   contractual annex."
3. **The MCP package**: grep `mcp/` for `IndexLinks`, `contentGraph` or a `_links`
   schema. If it validates `_links` strictly, add the optional key there too. That
   is an out-of-map edit: record a one-line rationale in the hand-off.

### T014 — Conditional `_links.tomAnnex` (FR-005)

**Steps**:
1. Red tests:
   - With surfaces where `tomAnnex: true`, `_links.tomAnnex.href` is the absolute
     `/api/tom-annex.json`.
   - With `tomAnnex: false`, there is no `tomAnnex` key at all.
   - Find the existing `indexLinks` / `agentIndexRoute` tests (`src/tests/agent-api.test.ts`,
     `served-surfaces.test.ts`) and extend them. Do not duplicate them.
2. Add `tomAnnex` to `DeclaredSurfaces`, default `surfaces?.tomAnnex ?? false`.
   **The default is false**, unlike most surfaces: a site that never set up the
   surfaces environment must not advertise a file that is not built.
3. Spread `...(declared.tomAnnex ? { tomAnnex: { href: absolute(site, '/api/tom-annex.json'), title: TOM_ANNEX_LABEL } } : {})`,
   if `AgentLink` allows `title` (check `contract.ts`; otherwise use `href` only).
   Place it after `scenarios`.

### T015 — Package exports

**Steps**: add `"./routes/tom-annex-injected": "./lib/routes/tom-annex-injected.ts"`
next to line 36 of `src/package.json`. If the package has an exports test (grep
`exports` in `src/tests`), make it pass. Do not add the CLI `bin` here: WP07 owns
that.

### T016 — Cross-check that the mount and the graph agree

**Steps**:
1. In `tomAnnexRoute`, if the graph has **no** `classified-as` edge, throw
   `[dk-tom-annex] the route is mounted but the content graph has no classified-as edge: the config-time scan and the graph disagree (…)`.
   Name the docs root. A silent empty index would be a lie.
2. Red unit test with a mocked graph that has no edges.

## Definition of Done

- [ ] The route is injected only when a published classified page exists. Unit tests cover the scan with same-fixture positive controls.
- [ ] `_links.tomAnnex` is present exactly when the route is mounted. The default is false.
- [ ] The route serves the core's bytes, and its mounted-but-empty disagreement throws.
- [ ] Existing agent-API, served-surfaces and MCP tests are unchanged in behaviour for sites without classified pages.
- [ ] `pnpm test` passes in full (NFR-005).

## Risks

- **Scan and graph drift**: T016 makes it loud.
- **Detection order**: see T012 step 3.
- **The example site has classified pages** (`architecture/audit-logging`,
  `context/incident-handling`). Existing example goldens that list `_links` or the
  `api/` files will change. Update them deliberately, and list each in the
  hand-off.

## Reviewer guidance

- Read the `DeclaredSurfaces` default: it must be false for `tomAnnex`.
- Run an example build and confirm both `dist/api/tom-annex.json` and
  `_links.tomAnnex` exist.
- Build a site without classified pages (WP05 automates this) and confirm neither
  exists.
