---
work_package_id: WP02
title: Shared site graph
dependencies: []
requirement_refs:
- NFR-002
- C-004
- NFR-004
- NFR-005
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
- T009
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/routes/
create_intent:
- src/lib/routes/site-graph.ts
- src/tests/site-graph.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/site-graph.ts
- src/lib/routes/content-graph.ts
- src/tests/site-graph.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 - Shared site graph

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Build the content graph **once per build** and share it between
`/api/content-graph.json` and the new `/api/tom-annex.json` (WP03), so the annex
adds no second graph build (C-004, NFR-002). This is a behaviour-preserving
extraction: `content-graph.json` must stay byte-identical.

Requirements: NFR-002, C-004, NFR-004, NFR-005. Depends on: none. It can run in
parallel with WP01.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP02 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

`src/lib/routes/content-graph.ts:56-77` builds the graph inline:

```ts
const entries = await collectDocEntries();
const catalog = await collectCitationCatalog();
const docsRoot = path.resolve(process.cwd(), docsDir);
const { index, source } = loadMeasuresCatalog(docsRoot);
const paths = walkMarkdownPaths(docsRoot);
const graph = buildContentGraph(entries, {
  locations: locatePages(paths, indexBasename),
  draftRoutes: siteDraftRoutes(docsDir, indexBasename),
  catalog,
  measures: { index, source },
});
```

After that it appends OpenAPI resource nodes, which the annex does **not** need.
Those stay in `content-graph.ts`.

## Subtasks

### T007 — Ratchet first

**Steps**:
1. Write a test, in `src/tests/site-graph.test.ts` or an existing content-graph
   test file if one fits better, that captures the current behaviour:
   - It calls `contentGraphRoute({docsDir, indexBasename})` against a fixture docs
     tree.
   - Look at how `src/tests/content-graph-measures.test.ts` drives the route or
     `buildContentGraph`, mocking `astro:content` if needed, and follow it.
   - It stores the exact response text as the expected bytes.
2. It must pass on the unchanged code. This is a ratchet, so it is green from the
   start. Prove it is not vacuous: change one byte of the expectation, see it fail,
   then revert.

### T008 — Extract `siteContentGraph()`

**Steps**:
1. Create `src/lib/routes/site-graph.ts` exporting
   `siteContentGraph({docsDir, indexBasename}): Promise<SiteGraph>`, where
   `SiteGraph = { graph: ContentGraph; measures: { index, records, source, isDefault }; docsRoot: string; locations: Record<string, PageLocation> }`.
   - WP03 needs `records` and `isDefault` for `uncovered` and for `catalog.default`.
   - WP06 needs `locations[id].file` for the source digest.
2. **Memoisation**:
   - In a production build, cache **the promise** in a module-level `Map` keyed by
     `${docsRoot}\0${indexBasename ?? ''}`, so concurrent route renders share it.
   - In dev (`import.meta.env.DEV`), do **not** memoise, or edits would serve a
     stale graph.
   - Export `resetSiteContentGraph()` for tests.
3. A unit test: two calls in production mode run `buildContentGraph` once (spy on
   it), and dev mode runs it each time.

### T009 — Route `content-graph.json` through it

**Steps**:
1. `contentGraphRoute` calls `siteContentGraph()`, appends the OpenAPI nodes as
   before, and serialises as before.
2. **Do not mutate the shared graph.** Today's code reassigns `graph.nodes` to a
   new sorted array. Build a new object (`{...graph, nodes: [...]}`) so the annex
   route never sees OpenAPI nodes.
3. The T007 ratchet stays green. Add a test that a second `siteContentGraph()`
   call after the content-graph route still has no OpenAPI node.

## Definition of Done

- [ ] `api/content-graph.json` is byte-identical: the ratchet is green and its non-vacuity was shown.
- [ ] The shared graph is never mutated by a caller.
- [ ] Memoisation is off in dev, and `reset` is exported for tests.
- [ ] `pnpm test` passes in full (NFR-005).

## Risks

- **Cross-build leakage in tests that build several sites in one process.** The
  key includes `docsRoot`. Call `resetSiteContentGraph()` in `afterEach` where
  tests build more than one site.
- **Hidden callers of `contentGraphRoute`.** Grep `src/` and `example/`, and keep
  its signature.

## Reviewer guidance

- Diff `api/content-graph.json` from a real example build before and after.
- Confirm there is no `graph.nodes =` assignment on the shared object.
