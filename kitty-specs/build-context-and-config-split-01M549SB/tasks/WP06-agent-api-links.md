---
work_package_id: WP06
title: '#103: _links in the agent-API index and per-page JSON'
dependencies:
- WP01
requirement_refs:
- FR-003
- FR-004
- FR-004a
- FR-004b
- FR-004c
- FR-005
- SC-001
- NFR-001
- NFR-003
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: 7ab8501168eb6ec25d92b82dd0c2798628d3c776
created_at: '2026-10-17T07:13:34.990150+00:00'
subtasks:
- T018
- T019
- T020
- T021
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/routes/
create_intent:
- src/tests/agent-links.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/routes/agent-index.ts
- src/lib/routes/agent-page.ts
- example/src/pages/api/index.json.ts
- example/src/pages/api/pages/[...slug].json.ts
- src/tests/agent-links.test.ts
role: implementer
---
# WP06 — #103: _links in the agent-API index and per-page JSON

## ⚡ Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill before reading anything else. Then load the action doctrine: `spec-kitty charter context --action implement`. Read `spec.md` and `plan.md` in the mission directory.

## Test economy (DIRECTIVE_041) — read before writing any test

Add a test only when it guards real behaviour through the existing entry point and fails on a real regression. No duplicate assertions, no shape pins, no tests inert once the change lands. Prefer strengthening an existing test. A red-first demo not worth keeping goes in your hand-off as evidence, not in the commit. Hand-off includes a table of every test added or changed: regression caught, existing coverage.

## Environment notes

- Run vitest SERIALLY from `src/`: `cd src && ./node_modules/.bin/vitest run <files>`; never `pnpm exec`. Parallel runs clash on `example/` fixtures.
- ESLint from the repo root: `./node_modules/.bin/eslint <files>`. `tsc --noEmit -p src`: 29 known errors; add none.
- Import-guard suites: when you add an import to an existing module, also run `grep -rlE "importSpecifiers|import-scan|allow-list" src/tests` suites (an allow-list guard caught PR #169).
- Example build (≈10 s, no PlantUML server needed): `env -u BASE_URL DK_OUTDIR=<rel-dir> DK_PUBLISH_DRAFTS=off pnpm --filter example build` — DK_OUTDIR is relative to `example/`; `pnpm clean` first (cache trap). The PlantUML figure assertion in example-adopter.test.ts fails locally (environmental).
- Commits: author Stijn Dejongh <stijn.dejongh@sddevelopment.be>; end messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011sNPRykaeRFrS4AUqTP73f`.

## Objective
Add `_links` to `/api/index.json` (top level and every record) and to each per-page agent JSON, built in the routes, never in `toAgentRecord` (metadata.ts ~327, shared with other consumers). Index `version` stays `'2'`.

## Design (plan.md, binding)
- hrefs via `absolute(site, …)` (routes/shared.ts ~138), like `url`/`source` today (agent-index.ts ~66-67).
- Index top level `_links`: `self` (/api/index.json), `llms` (/llms.txt), `sitemap` (/sitemap-index.xml), plus declared optional surfaces (`pages`, `rss`, `bibliography`, `scenarios`). `scenarios` is DECLARED like the others (planner review: neither `DK_GHERKIN_ROUTE` — set only for a site-owned route — nor the routes can see the injected scenario route, and C-001 bans new env names); the example declares it because it builds `/api/scenarios.json`.
- Index record `_links`: `self` (/api/pages/<slug>.json, only when the per-page route is declared), `html` (= url), `source` (when present), `related: [{ href, title }]` for resolved entries only.
- Per-page JSON `_links`: `self`, `up` (/api/index.json), `html`, `source`, `related`.
- Optional site-owned surfaces are declared via a `links` option on `agentIndexRoute` / `agentPageRoute` with defaults matching the example; the example route files pass it only if the defaults differ.

## Subtasks
### T018 Index `_links` (red first)
The FR-005 test (T020) is the red-first test; write it first.
### T019 Per-page `_links`
### T020 FR-005 test (`src/tests/agent-links.test.ts`)
Build the example once (or reuse the suite's existing build helper — check example-adopter.test.ts for one), read dist/api/index.json and every dist/api/pages/**/*.json, and assert every `href` under any `_links` maps to a file in dist (strip the site + base; `/x/` → `x/index.html`). One test; it also covers SC-001. It also asserts: the index has top-level `self`, `llms` and `sitemap`; every record has `html`; at least one record has a non-empty `related` and a `source`; the number of hrefs checked is > 2 × the record count; a `scenarios` link exists exactly when `dist/api/scenarios.json` exists. Red first: before T018 the test fails on missing `_links`.
### T021 Body pins and gates
Existing tests pinning the index or per-page body may need the added keys (NFR-003 allows ONLY that change — list each). Byte check vs main (NFR-001): build main and the branch, `diff -rq`; for every differing file, JSON-parse both, delete `_links` recursively, deep-equal must hold; non-JSON differences must be only the WP01 sitemap-text pages. Paste the summary. eslint, tsc (29).

## Definition of Done
- Commit: `feat(agent-api): _links in the agent-API index and per-page JSON (#103)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP06 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
