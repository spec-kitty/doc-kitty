---
work_package_id: WP06
title: Artifact gate walks the content graph (#176)
dependencies:
- WP04
- WP05
requirement_refs:
- FR-014
- NFR-001
- NFR-006
- C-007
- C-010
- SC-005
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: 28cbf83dcf5039c5d5fa0c4b1faae1042a4c1d3b
created_at: '2026-10-18T06:23:19.074613+00:00'
subtasks:
- T026
- T027
- T028
- T029
phase: Phase 2 - Content graph (#176)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/assert-build-artifacts.mjs
create_intent: []
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/scripts/assert-build-artifacts.mjs
- src/tests/example-adopter.test.ts
- src/tests/agent-links-gating.test.ts
- example/url-baseline.txt
role: implementer
task_type: implement
---

# Work Package Prompt: WP06 – Artifact gate walks the content graph (#176)

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

Broken edges cannot ship (FR-014): the build-artifact gate follows `_links.contentGraph` from `api/index.json`, checks every edge target against the graph's own node set and the built paths (C-010), fails naming the edge, and does not report edges into drafts (drafts are absent from the graph).

Done when:

- `assert-build-artifacts.mjs` loads the graph via `_links.contentGraph` (fail closed if the link is missing or the file does not exist).
- For each edge: `source` and `target` ∈ node ids; for page nodes, the built route exists in `dist`. Failure message: `content-graph: dangling edge <id>`.
- `example-adopter.test.ts` has a dangling-edge fixture (exit 1, names the edge) and a draft-target fixture (not reported).
- Two consecutive example builds produce byte-identical `api/content-graph.json` (NFR-001/SC-005); recorded in the Activity Log.

## Context & Constraints

- Plan IC-05 (gate half). Seams (verified): `linkHrefsOf` `:350`, `collectLinkObjects` `:361`, `assertAgentLinksResolve` `:378-400`, called at `:2334`. Add an `assertContentGraph(distDir, index)` next to `assertAgentLinksResolve` and call it right after it.
- The gate's existing `--index-path` option (gate-config-hardening, ADR) must apply: resolve the graph relative to the evaluated index path, not a hard-coded one.
- No CI two-build oracle exists; do the two-build diff locally (`cmp`), plus the builder-level determinism already in `content-graph.test.ts` (WP05).
- `tests/consumption/**` is owned by WP08 (one assertion for graph + bundle, NFR-005); do not touch it here.

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T026 – Red-first fixtures

- In `src/tests/example-adopter.test.ts`, next to the existing `dangling` / `withBase` mutations (around `:190-206`): copy the built dist to a temp dir, then
  1. inject an edge whose target id is absent → expect exit 1 and stderr containing the edge id;
  2. remove `_links.contentGraph` from `api/index.json` → expect exit 1;
  3. confirm the clean build passes (existing case at `:134`).
- A draft-target positive control: with `DK_PUBLISH_DRAFTS=on` build (see `draft-publication-build.test.ts` pattern), the graph still omits drafts and the gate passes. If this needs a second build, reuse an existing drafts-on build in the suite rather than adding one.
- Strengthen `src/tests/agent-links-gating.test.ts` if it enumerates `_links` keys.

### Subtask T027 – Graph walk

- Implement `assertContentGraph`. Validate top-level `schema` value; check sort order (nodes by id, edges by `(source, rel, target)` with `compareCodeUnit` imported from `vocabulary-core.mjs`) — a missorted graph fails (cheap determinism guard).

### Subtask T028 – Two-build byte diff

- `pnpm build && cp example/dist/api/content-graph.json /tmp/... && pnpm build && cmp`. Record the result. Measure the graph's build-time cost once (NFR-006 partial; WP08 measures the full figure).

### Subtask T029 – Baseline ripple

- `example/url-baseline.txt` and any enumerator of built API files: add `api/content-graph.json` if the baseline lists API outputs. Update in this WP (C-007). Never regenerate a timing census.

## Test Strategy

- `pnpm build && pnpm assert:artifacts`
- `pnpm --filter @spec-kitty/doc-toolkit test -- example-adopter agent-links-gating`
- Beware the vitest build project clobbering `dist/` (known race): run gate tests serially (`fileParallelism: false` is already set).

## Risks & Mitigations

- Base-prefixed hrefs: derive the base exactly as `assertAgentLinksResolve` does (`_links.self.href`).

## Review Guidance

- Reviewer runs on `opus`. Run the gate on a hand-broken graph; confirm the message names the edge; confirm the check uses the graph node set, not a second existence rule.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- Correction: `assertAgentLinksResolve` spans `assert-build-artifacts.mjs:378-~473` (ends at the `ok(...)` near :473), not 378-400. Insert the new function after it. The call site at :2334 is correct.
- example-adopter.test.ts mutations are at ~:197-208 (`dangling`, `withBase`). Verified.
- Draft-slug cross-check precedent: `assert-build-artifacts.mjs:2145` already uses `draftRoutesOf(EXAMPLE_DOCS_DIR, exampleIndexNames())`. Reuse it to assert that no draft id appears in the graph.
