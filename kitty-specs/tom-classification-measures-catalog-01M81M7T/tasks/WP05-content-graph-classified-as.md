---
work_package_id: WP05
title: classified-as edges and measure nodes in the content graph
dependencies:
- WP02
- WP03
requirement_refs:
- FR-007
- FR-005
- FR-010
- SC-003
- SC-005
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T016
- T017
- T018
- T019
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/docs-index.ts
create_intent:
- src/tests/content-graph-measures.test.ts
execution_mode: code_change
owned_files:
- src/lib/docs-index.ts
- src/lib/routes/content-graph.ts
- src/tests/content-graph.test.ts
- src/tests/content-graph-measures.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 - classified-as edges and measure nodes in the content graph

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Teach `buildContentGraph` the `classified-as` relation. Each published page with `tom_classification` gets one edge per measure to a `catalog:measure:<id>` node. An unknown id throws, naming the page and the id. Wire the catalog into the always-on route, so **every** site fails its build on a typo, including sites that mount no `/api/pages`.

Requirements: FR-007, FR-005 (build side), FR-010, NFR-001. Depends on: WP02 (core and loader), WP03 (`tom_classification` in `DocKittyFrontmatter`).

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP05 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- `src/lib/docs-index.ts`, from line ~120: `GraphRel`, `GraphNode`, `GraphEdge`, `ContentGraphContext`, the emitters (`relatedEdges`, `citeEdges`, …) and the `Sink` with code-unit sorting. Follow `citeEdges`: it resolves through the shared resolver and throws on a miss.
- `src/lib/routes/content-graph.ts` builds the context from `collectDocEntries()`, `collectCitationCatalog()` and the walk of `docsDir`.
- Contract: `contracts/machine-surfaces.md` (node and edge JSON); research R3 and R4.
- `src/tests/content-graph.test.ts` holds a strict Zod schema of the graph ("validates against the content-graph schema"). It must learn the new optional fields.
- Graph schema id stays `dockitty.content-graph/1` (additive).

## Subtasks

### T016: Types and context

- `GraphRel` adds `'classified-as'`.
- `GraphNode` adds `measure?: { nature: string; frameworks: Array<{ framework: string; ref: string }> }`. Place it after `openapi` in the interface and in the write order (keys are written in declared order; check `compact` usage).
- `GraphEdge` adds `scope?: 'system' | 'organisation'`, written after `note`.
- `ContentGraphContext` adds `measures?: { index: ReadonlyMap<string, MeasureRecord>; source: string }`. It is optional so existing callers and tests compile. When it is absent and a page carries the field, throw the same unknown-id message as an empty catalog would. Do not silently skip: no catalog means nothing resolves.
- `GraphScope` carries the measures.

### T017: `classifiedEdges` emitter

```ts
function classifiedEdges({ slug, data }: DocEntry, g: GraphScope, sink: Sink): void {
  if (data.tom_classification === undefined) return;
  const resolved = resolveClassification(data.tom_classification, g.measures.index, g.locate(slug).id + <ext?>, g.measures.source);
  ...
}
```

- Page label in the message: use the bundle path with its extension, for example `security/audit-log.md`. If `locate` only knows the id, `<id>` is acceptable, but the label must name the page. Match what WP06 uses (`page path relative to the docs root`). Coordinate with the contract: `<page path>`.
- Node: `{ id: \`catalog:measure:${m.measure}\`, kind: 'catalog', title: m.label, url: m.dpv, measure: { nature: m.nature, frameworks: m.frameworks } }` through `compact`.
- Edge: `sink.edge(source, 'classified-as', nodeId, m.note)`, plus scope. Extend `Sink.edge` with an optional 5th `extra?: { scope?: GraphEdge['scope'] }` parameter, or add a dedicated `sink.edgeWithScope`. Keep the `id` as `source|rel|target`. Always write `scope` on `classified-as` edges, including the default `system`.
- Resolution must run for **draft** pages too (fatal over the full corpus, as `related` is; see `buildContentGraph`'s comment), but only published pages emit. Do it like this: before the emit loop, resolve every entry's classification in `entries` (all, drafts included) so a draft typo still fails, then emit for `published`.
- Register `classifiedEdges` in the emit list, after `citeEdges`.

### T018: Route wiring

In `contentGraphRoute`: `const measures = loadMeasuresCatalog(path.resolve(process.cwd(), docsDir));` and pass `{ index: measures.index, source: measures.source }`. `loadMeasuresCatalog` throws on a malformed consumer catalog, which is the intended build failure. Update the route's header comment with one sentence.

### T019: Tests (write first)

- `src/tests/content-graph-measures.test.ts`, using in-memory entries like `content-graph.test.ts` does (read its `build()` helper and copy the pattern):
  - a page with `[transmission-protection, { measure: events-logging, note: 'n' }]` gives two edges `classified-as` with `scope: 'system'` and the note on the second, plus two measure nodes with the label, the DPV `url` and `measure.nature`;
  - an organisation-scope entry gives an edge with `scope: 'organisation'` (US5.1);
  - two pages on the same measure give one node and two edges;
  - an unknown id throws an Error whose message contains the page and the id;
  - a **draft** page with an unknown id still throws, and a draft page with a valid id emits no edge and no node;
  - **FR-010 ratchet**: the same corpus without any `tom_classification` produces a graph `JSON.stringify`-identical to the graph built with `measures` absent from the context, and to the graph built with the default catalog. No measure node appears. Positive control on the same fixture: adding the field makes edges appear;
  - determinism: shuffled entry order gives a byte-identical graph.
- `content-graph.test.ts` strict schema: add `'classified-as'` to the rel enum, an optional `scope` enum on edges, and an optional `measure` object on nodes. Add one classified page to its fixture so the schema test covers the new fields.

Use the shipped default catalog through `loadMeasuresCatalog` on a temp dir with no `_meta`, or `buildMeasuresIndex(parseMeasuresCatalog(...).records)` on an inline list. Both are fine.

## Definition of done

- Graph tests green (red first); `pnpm test` toolkit suite, lint and typecheck clean; no suppressions.
- `pnpm build` of the example still succeeds. WP08 adds classified example pages, and until then the graph must be unchanged for the example (FR-010).

## Risks

- `#341` (sidebar child cap) and `#330` runners may touch `docs-index.ts`. Keep hunks local and rebase through the dispatcher.
- A changed write order of existing node or edge keys breaks byte identity. Only append.

## Reviewer guidance

- Unknown id fatal for drafts too; scope always present on classified-as edges; no new bytes for unclassified trees.
