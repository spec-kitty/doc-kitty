---
work_package_id: WP01
title: 'Foundation: green build, committed lockfile, toolchain'
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-007
- NFR-008
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: node-norris
authoritative_surface: package.json
create_intent:
- pnpm-lock.yaml
- eslint.config.js
execution_mode: code_change
owned_files:
- package.json
- src/package.json
- example/package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- eslint.config.js
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile:

```
/ad-hoc-profile-load node-norris
```

Apply its identity, boundaries, directives, and tactics. State which you applied,
then proceed.

## Objective

Turn the structure-first repo green on Node 22 and commit the lockfile, and
establish every package manifest, script, and CI devDependency the rest of the
mission depends on. This WP is the **single owner of all `package.json` files and
`pnpm-lock.yaml`** — no other WP edits them, so add here everything downstream
lanes will call.

## Context

- The repo has **never** been installed: there is no `pnpm-lock.yaml`. Local Node
  is ≥22; CI floor is Node 22. `packageManager` is `pnpm@11.22.0` (use corepack).
- Workspace: root `package.json`, `@commondocs-kitty/toolkit` in `src/`, and
  `example/`. See `pnpm-workspace.yaml`.
- Existing scripts (root): `dev`, `build` (`--filter example build`), `preview`,
  `test` (`--filter @commondocs-kitty/toolkit test`), `lint` (`-r --if-present
  lint` — currently a **no-op**), `validate` (`--filter example run validate`).
- Toolkit `src/package.json` has `test: vitest run`, `typecheck: tsc --noEmit`,
  `lint: tsc --noEmit` (lint is just typecheck — make lint real).
- Tests already scaffolded in `src/tests/` (`agent-api.test.ts`, `metadata.test.ts`).

## Subtasks

### T001 — Install on Node 22 and commit the lockfile
- `corepack enable` then `pnpm install` from repo root on Node 22.
- Resolve any peer-dependency issues (Astro 5 / Starlight 0.30). Do **not** loosen
  the Node engine below 22.
- Commit the produced `pnpm-lock.yaml`.

### T002 — Add CI devDependencies to the correct manifests
- Add, in the manifest that runs them (prefer root or toolkit as a workspace dev
  dependency): `eslint` + `typescript-eslint` (flat-config), `markdownlint-cli2`,
  `@lhci/cli`.
- Do **not** add Vale, lychee, or Lighthouse browsers as npm deps — Vale/lychee run
  as pinned GitHub Actions in later WPs; only `@lhci/cli` is an npm dep here.
- Supply-chain (DIRECTIVE_051): all from the official npm registry; none require
  `postinstall`. Re-run install and re-commit the updated lockfile.

### T003 — Add the scripts downstream lanes call
Add to root `package.json` (and delegate into workspaces as needed):
- `typecheck`: run the toolkit `tsc --noEmit` (e.g. `pnpm --filter @commondocs-kitty/toolkit typecheck`).
- `lint`: run eslint over the toolkit (real, not `--if-present`).
- `validate:docs`: `node src/scripts/validate-frontmatter.mjs docs` (script extended in WP02).
- `validate:example`: `node src/scripts/validate-frontmatter.mjs example/docs`.
- `validate:links`: `node src/scripts/check-links.mjs docs example/docs` (script authored in WP02).
- `assert:artifacts`: `node src/scripts/assert-build-artifacts.mjs example/dist` (script authored in WP03).
- Keep existing `build`/`test`. These script *names* are the contract WP04 wires
  into CI; author them even though WP02/WP03 fill in the referenced files.

### T004 — Author a real eslint flat config
- Create `eslint.config.js` (flat config) covering `src/**/*.ts`. Keep the ruleset
  boring and idiomatic (recommended + typescript-eslint recommended).
- Verify `pnpm lint` runs eslint and a deliberately introduced `let x: number =
  "s"` / unused var **fails** the command (then revert the probe).

### T005 — Toolkit test suite runs non-trivially and passes
- `pnpm test` must execute the scaffolded `src/tests/` (non-zero, non-trivial
  count) and pass. If the suite is empty/trivial, that is a red flag — confirm the
  existing tests actually assert behavior; do not fake green.
- **Non-triviality floor (mutation probe)**: temporarily mutate one
  `src/lib/routes/` handler (e.g. flip a conditional) and confirm a *named* existing
  test fails; then revert. Record the probe and the observed failure as evidence. A
  suite where no test fails under a real mutation is not protecting behavior
  (charter mutation-testing directive).

### T006 — Example builds clean
- `pnpm build` must exit 0 with **no error-level output** and produce a non-empty
  `example/dist/`. Fix any build breakage (boy-scout, DIRECTIVE_025). If a fix must
  touch `src/` or `example/src/` runtime, keep it minimal and record a one-line
  rationale (out-of-map edit is acceptable per ownership rules).

### T007 — Frozen install correctness
- Verify `pnpm install --frozen-lockfile` succeeds against the committed lockfile.
- Verify it **fails** when a manifest is drifted without updating the lockfile
  (temporarily bump a dep, confirm failure, revert). This proves NFR-008.

## Branch Strategy

Planning/base branch: `feat/ci-cd-pipeline`. Final merge target: `feat/ci-cd-pipeline`
(the human PR later lands that branch → `main`). Execution worktrees are allocated
per computed lane from `lanes.json`; work inside the worktree the runtime assigns.

## Definition of Done

- `pnpm-lock.yaml` committed; `pnpm install`, `pnpm test`, `pnpm build` all green on
  Node 22; `pnpm typecheck` and `pnpm lint` are real gates that fail on a bad probe;
  frozen install passes and fails-on-drift.
- All script names in T003 exist (even where they reference files authored by
  WP02/WP03).

## Risks

- Peer-dep churn on Astro/Starlight; keep the Node engine ≥22.
- Making `lint`/`typecheck` real may surface existing issues — fix them (boy-scout),
  do not silence.
- Adding devDeps changes the lockfile — commit the final lockfile once, after T002.

## Reviewer guidance

- Confirm the lockfile is present and frozen-install works; confirm `lint`/`test`
  are not vacuously green (check the probe evidence); confirm the example `dist/` is
  non-empty and the build log has no error output.

## Activity Log

- 2026-08-22T16:45:44Z – claude – shell_pid=3384353 – FLAG for reviewer: pnpm test/lint/build all green; frozen-install passes and fails-on-drift; lint+mutation probes recorded. Pre-existing scaffold debt: toolkit 'pnpm typecheck' (raw 'tsc --noEmit') is red at baseline because the routes import Astro's project-generated 'astro:content' virtual module and config.ts pulls Starlight's shipped .ts source — neither resolves under standalone tsc. Fixing requires an architectural typecheck-strategy decision (astro check, or tsconfig scoping/ambient shim) touching src/tsconfig.json, which is outside WP01 owned_files and the node-norris no-architecture boundary. typecheck script NAME is wired per T003; recommend WP04 code-quality lane (IC-03, lists src/package.json) owns making it green.
