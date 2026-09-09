---
work_package_id: WP01
title: Buildable isolated fixture + clean-room orchestrator (MVP)
dependencies: []
requirement_refs:
- FR-001
- FR-003
- FR-004
- NFR-001
- NFR-003
- NFR-004
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: tests/consumption/
create_intent:
- tests/consumption/consumer-fixture/package.json
- tests/consumption/consumer-fixture/pnpm-workspace.yaml
- tests/consumption/consumer-fixture/pnpm-lock.yaml
- tests/consumption/consumer-fixture/tsconfig.json
- tests/consumption/consumer-fixture/astro.config.mjs
- tests/consumption/consumer-fixture/url-baseline.txt
- tests/consumption/consumer-fixture/src/content.config.ts
- tests/consumption/consumer-fixture/src/pages/rss.xml.ts
- tests/consumption/consumer-fixture/src/pages/llms.txt.ts
- tests/consumption/consumer-fixture/src/pages/api/index.json.ts
- tests/consumption/consumer-fixture/src/pages/api/pages/[...slug].json.ts
- tests/consumption/consumer-fixture/src/pages/api/bibliography.json.ts
- tests/consumption/consumer-fixture/src/pages/presentations/[...slug].astro
- tests/consumption/consumer-fixture/docs/README.md
- tests/consumption/consumer-fixture/docs/guides/README.md
- tests/consumption/consumer-fixture/docs/guides/getting-started.md
- tests/consumption/scripts/run-consumption-test.mjs
execution_mode: code_change
owned_files:
- tests/consumption/consumer-fixture/package.json
- tests/consumption/consumer-fixture/pnpm-workspace.yaml
- tests/consumption/consumer-fixture/pnpm-lock.yaml
- tests/consumption/consumer-fixture/tsconfig.json
- tests/consumption/consumer-fixture/astro.config.mjs
- tests/consumption/consumer-fixture/url-baseline.txt
- tests/consumption/consumer-fixture/src/content.config.ts
- tests/consumption/consumer-fixture/src/pages/**
- tests/consumption/consumer-fixture/docs/README.md
- tests/consumption/consumer-fixture/docs/guides/**
- tests/consumption/scripts/run-consumption-test.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_001 (architectural integrity — the fixture is the isolation boundary), DIRECTIVE_010 (spec fidelity), DIRECTIVE_051 (supply-chain — **no new third-party package**; re-declare already-locked peers only).

## Objective

Stand up a net-new consumer docsite at `tests/consumption/consumer-fixture/` that
consumes the **packed** `@commondocs-kitty/toolkit` tarball (never the workspace
symlink), and a `run-consumption-test.mjs` orchestrator that packs, installs in
genuine isolation, and builds it **with the toolkit source hidden**. A green run is
the SC-001 clean-room proof and the mission MVP.

Read first: `../spec.md`, `../plan.md` (IC-01/IC-04), `../research.md` (D2, D3, D7),
`../contracts/consumption-test-contract.md` (**C-0 and C-1 are authoritative**), and
`../data-model.md` (E-01, E-04, E-05; INV-1). Mirror the wiring in the repo's
`example/` (astro.config.mjs, src/content.config.ts, src/pages/*) — but swap
`workspace:*` for the tarball and isolate from the workspace.

## Subtasks

### T001 — Fixture package manifest + workspace isolation
- `tests/consumption/consumer-fixture/package.json`: `"@commondocs-kitty/toolkit":
  "file:./toolkit.tgz"`, peers `astro ^5`, `@astrojs/starlight` (0.32.x, matching the
  toolkit peer range `>=0.32.0 <0.33.0`), `@astrojs/sitemap ^3`; `"type":"module"`;
  scripts `build: astro build`, `typecheck: astro check`.
- `tests/consumption/consumer-fixture/pnpm-workspace.yaml` with **`packages: []`** —
  this makes the fixture its own workspace root so pnpm stops here and does NOT join
  the repo workspace (contract C-0). Add `tsconfig.json` extending astro's strict base.

### T002 — Astro config via toolkit exports
- `astro.config.mjs`: `import { defineDocKittyIntegrations } from
  '@commondocs-kitty/toolkit/config'`; `defineConfig({ site, base, integrations:
  defineDocKittyIntegrations({ title, description, base, markua:true, diagrams:false,
  indexBasename:['README','index'] }) })`. **No `theme` yet** (WP02 wires it). `base`
  MUST equal the loader `base` in T003 (config invariant).

### T003 — Content collections + route endpoints
- `src/content.config.ts`: register `docs` (`docKittyDocsLoader({ base:'docs',
  indexBasename:['README','index'] })` + `docKittyDocsSchema()`), `bibliography`, and
  `tools` collections from `@commondocs-kitty/toolkit/schema` (copy example's shape).
- `src/pages/`: `rss.xml.ts` (`rssRoute`), `llms.txt.ts` (`llmsTxtRoute`),
  `api/index.json.ts` (`agentIndexRoute`), `api/pages/[...slug].json.ts`
  (`agentPageRoute`), `api/bibliography.json.ts` (`bibliographyRoute`),
  `presentations/[...slug].astro` (deck route) — all from
  `@commondocs-kitty/toolkit/routes`. These are consumer-owned wiring (not shipped).

### T004 — Seed buildable content + redirect baseline
- Minimal real content so the build is green before WP03's slice lands:
  `docs/README.md` (root section index, with frontmatter), `docs/guides/README.md`
  (Hub) + `docs/guides/getting-started.md`. Keep it small; WP03 adds the book slice.
- `url-baseline.txt`: seed the redirect-coverage baseline for the fixture's built URLs.

### T005 — The orchestrator (`tests/consumption/scripts/run-consumption-test.mjs`)
Implement contract C-1 exactly, aborting non-zero on any step:
1. `npm pack` in `src/` → move the versioned tgz to
   `tests/consumption/consumer-fixture/toolkit.tgz` (stable name).
2. Install in the fixture: `pnpm install --frozen-lockfile --ignore-workspace`.
3. **Isolation assertions (C-0)**: `realpath(node_modules/@commondocs-kitty/toolkit)`
   is inside the fixture dir, is **not a symlink**, is **not under** repo `src/`, and
   its `package.json` version === `0.1.0`; plus a grep proving **0** `../src`
   toolkit-source imports in the fixture. Fail closed otherwise.
4. **Source-hidden build**: temporarily rename repo `src/` (e.g. to `src.hidden`),
   `astro build` in the fixture, and restore `src/` in a `finally`. A green build with
   `src/` unresolvable is the SC-001 proof.
5. Run the four tarball-portable gates from the installed package
   (`node <fixture>/node_modules/@commondocs-kitty/toolkit/scripts/<x>.mjs …`):
   `validate-frontmatter.mjs <fixture>/docs --index-basename README,index` (tolerate
   `type: Reference` warnings — exit 0 is the pass), `check-links.mjs <fixture>/docs`,
   `check-redirect-coverage.mjs <fixture>/url-baseline.txt <fixture>/dist`,
   `assert-no-broken-links.mjs <fixture>/dist --base <base>`.
6. **Auto-discover** and run every `tests/consumption/scripts/assert-consumer-*.mjs`
   against `<fixture>/dist` (so WP02's theme checker and WP04's artifact checker plug
   in without editing this file). Aggregate a single non-zero exit on any failure.

### T006 — Commit the fixture lockfile
Run one pack+install to generate `tests/consumption/consumer-fixture/pnpm-lock.yaml`
and commit it (deterministic peer pin, NFR-004). Keep `toolkit.tgz` out of git
(add to the fixture `.gitignore`; it is a build artifact regenerated each run).

### T007 — Green MVP run
`node tests/consumption/scripts/run-consumption-test.mjs` exits 0 locally. This proves
the clean-room build from the tarball with source hidden (SC-001).

## Definition of Done
- The fixture builds from `toolkit.tgz` with repo `src/` renamed away; orchestrator exits 0.
- Isolation assertions present and effective: realpath-not-symlink-not-under-`src/`, version `0.1.0`, 0 `../src` imports, `--ignore-workspace` + own `pnpm-workspace.yaml`.
- Committed `pnpm-lock.yaml`; `toolkit.tgz` gitignored; **0** files added to the toolkit tarball (`cd src && npm pack --dry-run` file list unchanged — NFR-003).
- `base` matches between `astro.config.mjs` and the docs loader.

## Reviewer guidance
Verify the source-hidden build is real (not a grep-only proxy) and that a workspace
symlink cannot satisfy the resolution assertion (try: without `--ignore-workspace`, does
it catch the symlink?). Confirm `npm pack --dry-run` is unchanged by this WP.

## Branch Strategy
Planning branch: `feat/release-0.1.0-consumption-readiness`; final merge target:
`feat/release-0.1.0-consumption-readiness`. Execution worktrees are allocated per
computed lane from `lanes.json`. Implement with `spec-kitty agent action implement WP01 --agent claude`.
