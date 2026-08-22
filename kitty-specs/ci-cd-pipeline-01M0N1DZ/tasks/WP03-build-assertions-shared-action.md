---
work_package_id: WP03
title: Build-integration assertions + shared build action
dependencies:
- WP01
requirement_refs:
- FR-010
- FR-011
- FR-015
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T014
- T015
- T016
- T017
- T018
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: node-norris
authoritative_surface: src/scripts/assert-build-artifacts.mjs
create_intent:
- src/scripts/assert-build-artifacts.mjs
- .github/actions/build-example/action.yml
execution_mode: code_change
owned_files:
- src/scripts/assert-build-artifacts.mjs
- .github/actions/build-example/action.yml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

```
/ad-hoc-profile-load node-norris
```

Apply its identity, boundaries, directives, and tactics; state which you applied.

## Objective

Two deliverables: (1) a Node script that asserts the example build produced its
expected artifacts (and fails if any is missing/malformed), and (2) a **composite
GitHub Action that runs the shared `astro build`**, so the CI build lane (WP04) and
deploy (WP05) build the site through one definition — what is gated equals what is
published (FR-015).

## Context

- The example produces (design §"Test taxonomy"): `sitemap*.xml`, `rss.xml`,
  `llms.txt`, an agent index JSON (`/api/index.json`), README-as-index routing, and
  rendered pages. The route handlers live in `src/lib/routes/` (`rss.ts`,
  `llms-txt.ts`, `agent-index.ts`, `agent-page.ts`).
- Assertions must target **today's** output shape/count — NOT the M1 metadata
  contract (out of scope, C-010).
- WP01 already added the `assert:artifacts` script name pointing at this file.

## Subtasks

### T014 — Author assert-build-artifacts.mjs
- `node src/scripts/assert-build-artifacts.mjs <distDir>` asserts, over
  `example/dist/`:
  - `sitemap*.xml` present, non-empty, parses as XML;
  - `rss.xml` present, parses as XML;
  - `llms.txt` present, non-empty;
  - agent index JSON present, valid JSON, expected top-level shape;
  - a section `README.md` is served at its directory route (README-as-index);
  - at least one known content page rendered to HTML.
- Exit non-zero with a precise message on the first failure.
- **Zero new dependencies**: WP01 vendors no XML parser; assert XML *well-formedness*
  at string level (or a tiny hand check), not a new dependency.

### T015 — Pin agent-index shape + count
- Build the example once, inspect the produced agent index JSON, and pin the
  expected top-level shape and the entry **count** for today's example content
  (restores the design's "shape/count", which an earlier spec draft dropped). Make
  the count assertion tolerant to intentional content changes only via an explicit
  constant the reviewer can see.
- **Cross-check the count** against an independent countable source (e.g. the number
  of content entries under `example/docs/`) rather than trusting a hand-copied
  number, so a wrong build cannot silently lock in a wrong baseline.

### T016 — Composite build action (shared build definition)
- Create `.github/actions/build-example/action.yml` (composite) that: enables
  corepack, sets up Node 22 with pnpm cache, `pnpm install --frozen-lockfile`, and
  `pnpm build`. This is the single build definition reused by WP04 and WP05.
- Per `contracts/build-example-action.contract.md`: inputs `node-version` (default
  22) + `working-directory` (default `.`); the composite does **not** self-checkout
  (callers run `actions/checkout` first) and does **not** run assertions.

### T017 — Assertions run in the build-example JOB, not the composite
- **Resolved (post-tasks squad)**: the composite is the *pure build*; artifact
  assertions run as a step in WP04's build-example job *after* the composite. This
  keeps deploy (WP05) able to reuse the build without inheriting the PR-gate
  assertion (a legitimate content-count change must not fail the mainline publish).
  Confirm the composite `action.yml` contains **no** assert step.

### T018 — Prove failure
- Demonstrate that deleting or corrupting one artifact (e.g. truncating the agent
  index JSON) makes `assert:artifacts` exit non-zero.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. Worktree per
lane from `lanes.json`.

## Definition of Done

- `assert-build-artifacts.mjs` asserts all six targets incl. shape+count and fails
  on missing/malformed; composite build action exists and is reusable by both CI and
  deploy; failure demo shown.

## Risks

- Coupling the count too tightly to content churn — use an explicit, reviewable
  constant and comment it.
- Composite-action interface drift: keep its inputs minimal (working-directory,
  node-version default 22) so both callers use it unchanged.

## Reviewer guidance

- Confirm the assertions are real (not filename greps — JSON is parsed and shape
  checked); confirm the composite action is genuinely shared (WP04 and WP05 both
  reference it); confirm the failure demo.
