---
work_package_id: WP08
title: Export CLI, build hook and consumption proof (#178)
dependencies:
- WP06
- WP07
requirement_refs:
- FR-018
- FR-019
- NFR-001
- NFR-005
- NFR-006
- C-004
- C-007
- C-010
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: 73f46d3ad82fd69d087db75135e02a1ae9ebf115
created_at: '2026-10-18T06:41:12.632069+00:00'
subtasks:
- T035
- T036
- T037
- T038
phase: Phase 3 - OKF export (#178)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/okf-export/integration.ts
create_intent:
- src/scripts/export-okf.mjs
- src/lib/okf-export/integration.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/scripts/export-okf.mjs
- src/lib/okf-export/integration.ts
- src/package.json
- tests/consumption/consumption-gap.test.ts
- tests/consumption/consumer-fixture/**
role: implementer
task_type: implement
---

# Work Package Prompt: WP08 – Export CLI, build hook and consumption proof (#178)

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

Adopters can export on demand and every build ships a bundle (FR-018), proven in the clean-room packed-tarball build (NFR-005), at ≤ 10% build-time cost (NFR-006, measured once).

Done when:

- `dockitty-export-okf` bin (`src/scripts/export-okf.mjs`): `--dist <dir>` (reads `<dist>/api/content-graph.json`, or `--graph <file>`), `--docs <dir>`, `--out <dir>` (default `./okf-export`), `--check` (run `checkOkfBundle` on the output, exit 1 on violations). Uses `exportOkfBundle` from WP07; writes files in sorted order; cleans `--out` first.
- `src/package.json` `bin` (`:44-53`) gains `"dockitty-export-okf": "./scripts/export-okf.mjs"`; `files` includes `lib/okf-export/` if `files` is an allowlist.
- `src/lib/okf-export/integration.ts`: an Astro integration with `astro:build:done` that reads the built graph and writes `dist/okf/`, ordered after the sitemap-order `build:done` step (`config.ts:60,663`).
- The artifact gate runs the §11 checker on `dist/okf/` and fails on violations.
- `consumption-gap.test.ts` asserts the packed-tarball adopter build contains `api/content-graph.json` and `okf/index.md`.
- Two exports byte-identical; NFR-006 figure recorded once in the Activity Log (no census).

## Context & Constraints

- Plan IC-06 (CLI part) and IC-07; decisions 01M56PQ34KMD8F7CSHB0QP717C (CLI + always-emitted output), 01M56PQ67AJX89DHDQ0KFYFZK5 (drafts excluded). Plan decision 1: directory `dist/okf/`, no archive, not in sitemap.
- **Out-of-map (justified, sequenced)**: one registration line in `src/lib/config.ts` (owned by WP05) and an `assertOkfBundle` call in `src/scripts/assert-build-artifacts.mjs` (owned by WP06). Both WPs merge before this one. Record both in the Activity Log.
- C-004: the bin's version banner (if any) uses `toolkitVersion()`.
- The build hook must read the graph file, never call the builder or resolvers (C-010).

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T035 – Red-first consumption assertion

- In `tests/consumption/consumption-gap.test.ts`, extend the existing packed-tarball build case (the one that asserts built outputs; see `packToolkit` at `:266` and the GREEN arm at `:358`) with: `existsSync(dist/api/content-graph.json)` and `existsSync(dist/okf/index.md)`, plus `checkOkfBundle(dist/okf)` returns 0 violations. Strengthen, do not add a new `it`.
- If the consumer fixture (`tests/consumption/consumer-fixture/`) needs no change (route is injected), leave it untouched.

### Subtask T036 – CLI bin

- Shebang `#!/usr/bin/env node`, executable bit, argument parsing in the style of the other bins (`validate-catalog.mjs`). Clear errors: missing graph → exit 2.

### Subtask T037 – Build hook

- `astro:build:done({ dir })`: `fileURLToPath(dir)`, read `api/content-graph.json` and source files for graph page nodes (docs root from the evaluated config, same as other integrations), call `exportOkfBundle`, write to `dist/okf/`. Register in `config.ts` after `sitemapOrderIntegration()`.

### Subtask T038 – Gate + NFR-006

- `assert-build-artifacts.mjs`: after `assertContentGraph` (WP06), call the checker on `dist/okf/`; message prefix `okf-export:`.
- Build the example twice; `diff -r` both `dist/okf/` copies (0 differences). Time one build with and one without the hook (env toggle only for measurement, not shipped) and record the ratio.

### Post-tasks adversarial additions (must do)

- **Hook factory signature**: register as `okfExportIntegration(docsDir, indexBasename)` in `defineDocKittyIntegrations`, unconditionally, after `sitemapOrderIntegration()` (`config.ts:663`), the same way `baseAbsoluteLinksIntegration(base, docsDir, indexBasename)` receives the evaluated values. Do not re-read `astro.config`.
- **Packed tarball**: `files` (`src/package.json:54`) already includes `lib` and `scripts`, so no `files` change is needed; add only the `bin` entry. Verify with `npm pack --dry-run` that `scripts/export-okf.mjs` and `lib/okf-export/*` are listed.
- **NFR-005 assertion is concrete**: in the GREEN arm, `expect(existsSync(join(dist,'api/content-graph.json'))).toBe(true)`, `expect(JSON.parse(...).schema).toBe('dockitty.content-graph/1')`, `expect(existsSync(join(dist,'okf/index.md'))).toBe(true)`, `expect(checkOkfBundle(join(dist,'okf'))).toEqual([])`. The consumer fixture must NOT gain a page file for the graph; if the assertion fails without one, WP05's injection is broken — reopen WP05, do not paper over it here.
- **CLI test**: one case in `okf-export.test.ts` (or the existing bin smoke test) spawning the bin with `--check` on a fixture dist: exit 0 clean, exit 1 with a missing-`type` fixture, exit 2 with no graph.

## Test Strategy

- `pnpm build && pnpm assert:artifacts`
- `pnpm --filter @spec-kitty/doc-toolkit test -- okf-export example-adopter`
- Consumption: run the consumption suite as CI does (`tests/consumption/vitest.config.ts`).
- Toolkit typecheck (`integration.ts` is typed).

## Risks & Mitigations

- vitest build project can clobber `dist/` (known race): keep gate assertions post-build and serial.
- New integration may shift pinned integration-list tests; update them here if they fail (C-007), noting out-of-map.

## Review Guidance

- Reviewer runs on `opus`. Install from the packed tarball path the consumption test uses and run `dockitty-export-okf --check`; confirm the hook reads the built graph only.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- Cites verified: config.ts:60/663, package.json bin :44-53, files :54 (contains `lib` and `scripts`, so no files change is needed).
- Any new integration has broken pinned baselines and the remark-stack/integration enumerator before (memory: determinism-hardening). Check `remark-version-pin.test.ts` and any test that enumerates `defineDocKittyIntegrations` output.
