---
work_package_id: WP05
title: Content graph builder and route (#176)
dependencies:
- WP01
- WP03
requirement_refs:
- FR-010
- FR-011
- FR-012
- FR-013
- FR-021
- FR-022
- NFR-001
- C-002
- C-003
- C-009
- C-010
- C-011
- SC-001
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: d24b958b2876fd60caa954dd5263ffdccec7ff13
created_at: '2026-10-18T06:02:31.064184+00:00'
subtasks:
- T021
- T022
- T023
- T024
- T025
phase: Phase 2 - Content graph (#176)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/docs-index.ts
create_intent:
- src/lib/routes/content-graph.ts
- src/lib/integrations/content-graph.ts
- src/tests/content-graph.test.ts
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/lib/docs-index.ts
- src/lib/routes/content-graph.ts
- src/lib/routes/index.ts
- src/lib/integrations/content-graph.ts
- src/lib/config.ts
- src/tests/content-graph.test.ts
- src/tests/type-registry-authority.test.ts
role: implementer
task_type: implement
---

# Work Package Prompt: WP05 – Content graph builder and route (#176)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude` (model `sonnet`)

---

## ⚠️ IMPORTANT: Review Feedback

- Check `review_ref` in the event log. Address all feedback before completing.

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the Activity Log below or in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks. Use language identifiers in code blocks.

---

## Objectives & Success Criteria

Every build publishes `api/content-graph.json` (FR-010) from one pure builder (C-010), with nodes (FR-011) and frontmatter-only edges from the shared resolvers (FR-012, C-002, C-003), drafts excluded and output byte-deterministic (FR-013, C-011, NFR-001).

Done when:

- `buildContentGraph(entries, { drafts, catalog, sections })` lives in `src/lib/docs-index.ts` next to `buildDocsIndex` (`:58`) and returns the shape in `contracts/content-graph.schema.json` (`schema: "dockitty.content-graph/1"`, `okf_version: "0.2"`).
- Nodes: pages (id = bundle path without `.md`), catalog entries, personas, and `resource:<url-or-path>` nodes for distinct `sources[].resource` that are not pages. OKF field names where OKF has them (`type`, `title`, `description`, `status` via `okfStatusOf`, `generated`, `verified` normalised to a list, `stale_after`), plus DocKitty fields.
- Edges `{id, source, target, rel, note?}`, `rel ∈ {related, audience, cites, in-section, derived-from}`; `id = source|rel|target`; nodes sorted by `id`, edges by `(source, rel, target)` with `compareCodeUnit` (`vocabulary-core.mjs:76`).
- Drafts and every edge touching one excluded via `draftRoutesOf` (`src/lib/draft-publication.mjs:392`) whatever `DK_PUBLISH_DRAFTS` is.
- The route is injected always-on (no adopter page file needed) and `api/index.json` `_links.contentGraph` points to it.
- SC-001: for a sample page, graph edges equal what `resolveRelated` / `resolveProfile` / `resolveCitation` return for the rendered blocks.

## Context & Constraints

- Plan IC-05 and decision 4 (`in-section` via parent index using `readmeToIndexId`/`resolveIndexEntries` at `vocabulary-core.mjs:873,923` and `sectionOf` at `metadata.ts:217`; `derived-from` via `sources[].resource`, main producer `feature-core.mjs:657`).
- Resolvers (verified): `resolveRelated` `metadata.ts:558`, `resolveProfile` `:602`, `resolveCitation` `:647`. Call them; do not copy logic into the builder.
- `metadata.ts` is owned by WP03 (done before you); if you need a new export from it, a minimal export-only edit is a justified out-of-map change — note it in the Activity Log.
- **Out-of-map (justified)**: T025 edits `src/lib/routes/agent-index.ts` (`:24-35` options, `:96`/`:112` `_links`) and `src/tests/agent-api.test.ts` (owned by WP03, which merges first).
- Route injection precedent: `src/lib/integrations/gherkin.ts:82,130` (`injectRoute` inside `astro:config:setup`, mounting `/api/scenarios.json`). Register the new integration in `src/lib/config.ts` (see the integrations list around `:663`).

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T021 – Red-first focused test

- Create `src/tests/content-graph.test.ts` (the one new focused test of this change). Pure builder, in-memory entries:
  1. Same input in shuffled order → identical `JSON.stringify` output.
  2. Edge `id` equals `source|rel|target`; no counters.
  3. Draft page A: absent, and no edge has A as source or target.
  4. A `related` to B → exactly one `{source: A, target: B, rel: 'related'}`.
  5. SC-001: edges for a sample page equal the resolver outputs used by the Related/Audience/External-references blocks.
  6. Output validates against `kitty-specs/.../contracts/content-graph.schema.json` (copy the schema shape into the test as an inline object or a fixture under `src/tests/fixtures/` — do not import from `kitty-specs/`).

### Subtask T022 – Nodes

- Implement node construction. `verified` normalised to a list; `updated` serialised via `normaliseInstant` as `…Z`; `status` via `okfStatusOf`. Persona nodes: id `context/audience/<profile>` (they are pages). Catalog nodes: kind `catalog`, id from the catalog entry key; never invented as pages.

### Subtask T023 – Edges and draft exclusion

- `related` (resolveRelated), `audience` (resolveProfile → persona page id), `cites` (resolveCitation → catalog node), `in-section` (nearest published ancestor index), `derived-from` (`sources[].resource` → page id or `resource:` node). Frontmatter only — no glossary autolink or body links (C-002). Filter with the `draftRoutesOf` set.
- If section typing affects `in-section`, strengthen `src/tests/type-registry-authority.test.ts`.

### Subtask T024 – Route and injection

- Create `src/lib/routes/content-graph.ts` (static `GET`, `getCollection('docs')`, serialise with stable 2-space JSON and trailing newline). Export from `src/lib/routes/index.ts`.
- Create `src/lib/integrations/content-graph.ts` that `injectRoute`s `/api/content-graph.json`; register it in `src/lib/config.ts`. Note: the example and `tests/consumption/consumer-fixture` mount other agent routes as page files under `src/pages/api/`; injecting keeps it always-on without adopter edits. Confirm no adopter page collides.

### Subtask T025 – `_links.contentGraph` (out-of-map)

- `agent-index.ts`: always declare `_links.contentGraph: { href: <base>/api/content-graph.json }`. Strengthen `agent-api.test.ts` `_links` assertions.

### Post-tasks adversarial additions (must do)

- **Draft ids vs routes**: `draftRoutesOf` (`draft-publication.mjs:392`) returns a Set of **routes** (from `buildRouteTable`), not bundle ids. Map each graph page id to its route through the same `buildRouteTable` call (do not hand-build `/${id}/`) and exclude when the route is in the set. Test case 3 must use an entry whose id and route differ (a section `README.md`) so a naive id comparison fails.
- **The injected route needs a package export**: `injectRoute` entrypoints are package specifiers (precedent `SCENARIO_INDEX_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/scenario-index-injected'`, `integrations/gherkin.ts:151`, exported at `src/package.json:34`). Create `src/lib/routes/content-graph-injected.ts` (reads options from a `virtual:doc-kitty/content-graph` module: `docsDir`, `indexBasename`, `base`) and add `"./routes/content-graph-injected"` to `src/package.json` `exports`. `src/package.json` is owned by WP08; this one-line `exports` addition is a justified out-of-map edit here (WP05 merges first) — record it. Without it the consumption clean-room build (NFR-005) cannot resolve the route.
- **Always-on means unconditional**: push the integration in `defineDocKittyIntegrations` without a `DocKittyOptions` toggle (like `tocRailIntegration`, `config.ts:~650`). Both `example/astro.config.mjs` and `tests/consumption/consumer-fixture/astro.config.mjs` call `defineDocKittyIntegrations`, so neither needs a page file. Do not add `src/pages/api/content-graph.json.ts` to either.
- **FR-021/FR-022 in the graph test**: add a case with bare `verified: {by, at}` → node `verified` is a one-element list; `stale_after` passes through as `…Z`.
- **`_links.contentGraph` href is base-prefixed** the same way the existing `_links` are (`agent-index.ts:96/112`).

## Test Strategy

- `pnpm --filter @spec-kitty/doc-toolkit test -- content-graph agent-api type-registry-authority`
- Toolkit typecheck. Note the known `astro:content` tsc wrinkle when splitting modules (docs-index-owner lesson); keep `buildContentGraph` free of `astro:content` imports — the route does the collection read.
- Build the example once and check `example/dist/api/content-graph.json` exists.

## Risks & Mitigations

- New integration shifts the integration enumerator / remark-stack pinned tests (determinism-hardening lesson). Pinned baseline updates for the build output belong to WP06; if a toolkit unit test pinning the integration list fails here, update it in this WP (C-007) and note it.

## Review Guidance

- Reviewer runs on `opus`. Check: no relation logic duplicated; drafts excluded independent of the publish flag; sort and id rules; no `astro:content` in the pure builder.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- Cites verified: docs-index.ts:58, draft-publication.mjs:392, vocabulary-core.mjs:873/923, metadata.ts:217/558/602/647, gherkin.ts:82/130, agent-index.ts:96/112.
- Draft authority: use `src/lib/integrations/shared.ts:20` (the existing integration-side wrapper around `draftRoutesOf`), not a fresh `path.resolve` call. Four callers already exist (check-links, check-redirect-coverage, assert-build-artifacts:2145, shared.ts). Do not add a fifth way of resolving the root.
- The route table comes from `vocabulary-core.mjs:1021` `buildRouteTable`. markdown-pipeline.ts:71 already builds one per build, so reuse that pattern (and its collision handling) for the id-to-route map.
- Adding `_links.contentGraph` grows the href count that `assert-build-artifacts.mjs:466` sums. Every pinned agent JSON (example/dist, consumer-fixture dist, dist-nodrafts) changes.
