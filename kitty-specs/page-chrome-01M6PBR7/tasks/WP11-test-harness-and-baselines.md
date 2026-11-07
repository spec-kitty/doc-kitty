---
work_package_id: WP11
title: Test harness, baselines and dependencies
dependencies: []
requirement_refs:
- C-003
- NFR-001
- NFR-002
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: 8ef2ae28d834899c1053da77302011b6238d7a8d
created_at: '2026-11-05T18:24:44.795582+00:00'
subtasks:
- T043
- T044
- T045
- T046
- T047
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/fixtures/chrome/
create_intent:
- src/tests/chrome-baseline.test.ts
- src/scripts/capture-chrome-baseline.mjs
execution_mode: code_change
owned_files:
- src/package.json
- package.json
- pnpm-lock.yaml
- src/vitest.workspace.ts
- playwright.config.ts
- .github/workflows/ci.yml
- src/tests/fixtures/chrome/**
- src/tests/chrome-baseline.test.ts
- src/scripts/capture-chrome-baseline.mjs
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP11 – Test harness, baselines and dependencies

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Give every later work package a way to vary options, a frozen pre-mission baseline to compare with, and the dependencies it needs. **This WP must land before any behaviour changes**, because its goldens record today's output.

**Concern**: Foundation for all concerns. Runs first, despite its number. **Requirements**: NFR-001, NFR-002, C-003.
**Depends on**: nothing.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP11 --agent <name> --mission page-chrome-01M6PBR7
```

## Rules for every subtask

- **Read first**: [spec.md](../spec.md), [plan.md](../plan.md) and the contracts it links.
- **Non-vacuity** (tactic `acceptance-criteria-non-vacuity`): a test that asserts absence or no change needs a positive control on the same fixture, and must go through the production path. For a build-level claim, that means real built HTML.
- **Build suites** share `example/.astro`. WP11 registers every new build test named in this mission in the serialized `build` project in `src/vitest.workspace.ts`, so you shouldn't need to edit it.
- **Varying options**: use WP11's fixture config (`DK_TEST_OPTIONS`) and frozen fixture site. Don't edit `example/astro.config.mjs` for a test, and don't compare a build with itself.
- **No DOM test environment**: jsdom is forbidden here (`toc-rail-preference.test.ts:3`). Unit tests use stubs, and behaviour proofs go in Playwright.
- **Gates**: `pnpm assert:artifacts` is part of every code WP's definition of done.
- **Byte-sensitive templates**: Astro trims whitespace differently around `{expr}` and bare elements. Rebind components rather than wrapping existing positions in conditionals, as `MarkdownContent.astro` explains.
- **Changelog**: a user-visible change adds `docs/changelog/unreleased/<issue>-<slug>.md`, and never edits `CHANGELOG.md`.
- **Out-of-map edits**: only the small ones this prompt names, or others recorded with a one-line reason in the commit message.
- **Don't commit** `kitty-ops/` or the regenerated `example/docs/glossary/**` `generated.by` stamps.
- Record subtask progress with `spec-kitty agent tasks mark-status T001 --status done --mission page-chrome-01M6PBR7`.

## Subtasks

### T043: Fixture config with varied options

Today, build tests can only vary output through the `DK_MARKUA` and `DK_OUTDIR` seams, or a `--config` fixture that duplicates options. Add one fixture config under `src/tests/fixtures/chrome/` that spreads `JSON.parse(process.env.DK_TEST_OPTIONS ?? '{}')` over options shared with the example, and takes `DK_OUTDIR`. Later WPs pass, for example, `{"sidebar":{"titleIsIndex":true}}`, `{"metadataBlocks":{"collapsed":false}}` or `{"theme":null}`. It must support a **no-theme** build, since no unthemed example fixture exists and both current `--config` sidebar fixtures set a theme.

Options that don't exist until WP01 pass through harmlessly here, since WP01 adds their validation. Add a helper that runs a fixture build once per distinct option set and caches by key, so suites share builds.

### T044: Frozen fixture site

Add a small site under `src/tests/fixtures/chrome/site/`, written out at test time to `example/.dk-test-chrome/` if the loader needs it there, as `exclude-folders-build.test.ts` does. It holds: nested sections with index pages, a relabelled index, a group with no index (a variant for WP06's parity test), a non-hub page with all four metadata blocks, a hub with children, a hub with none, a draft page, an undated page, a generated-stamp page, and its own `rss.xml.ts`.

It is frozen, so ordinary edits to `example/docs` can't break a golden. No OpenAPI or Gherkin, so captures stay small.

### T045: Pre-mission goldens

`src/scripts/capture-chrome-baseline.mjs`, modelled on `capture-stock-header.mjs`, builds the frozen fixture and writes, under `src/tests/fixtures/chrome/golden/`:

- one deep page's whole sidebar fragment, including `data-hash`;
- one non-hub page's HTML, with build ids normalised;
- the list and content of emitted CSS.

Run it **on this WP's base, before any behaviour change**, and commit the result in its own commit. `chrome-baseline.test.ts` rebuilds the fixture and compares, with a stamp recording the toolkit commit and Starlight version, so a golden can't be silently regenerated after the change. Later WPs edit this test's expectations only where this mission's defaults change them; opt-outs must still match.

**Prove it isn't vacuous**: temporarily change one class in the fixture's output and confirm the test goes red. Note that in the commit.

### T046: Register suites and dependencies

**Build suites**: add every new build test this mission names to the serialized `build` project in `src/vitest.workspace.ts` now, so lanes don't conflict: `chrome-baseline`, `served-surfaces-build`, `hub-block-order-build`, `metadata-blocks-build`, `sidebar-renderer-parity`, `sidebar-title-as-index-build`, `sidebar-icons-build`, `page-atom-build`, `footer-links-build`. Confirm a listed file that doesn't exist yet doesn't fail the run.

**Dependencies**, pinned exactly in `src/package.json`, then `pnpm install`, committing the lockfile:

- `@iconify-json/fa6-solid@1.2.4` in `dependencies`. Sites without `fa-` icons don't read it.
- `sax@1.6.1` in `devDependencies`. It's already in the tree transitively. Check the lockfile's version before pinning, and match it if it differs.

For each, run DIRECTIVE_051's five controls and record results in `plan.md`'s table's style in the commit message: registry authenticity, first and latest publish dates, lifecycle scripts, lockfile-driven install, and license. This WP is a code change, so the orchestrator copies the results into `research.md`. Don't add a `minimumReleaseAgeExclude` entry.

### T047: Playwright projects and CI

Playwright serves only `dist` and `dist-nodrafts` today, so a spec needing other options would silently run against the wrong site. In `playwright.config.ts`, add two `webServer` entries, projects and `testMatch` rules:

- **title-as-index**: `DK_TEST_OPTIONS={"sidebar":{"titleIsIndex":true}}`, for `sidebar-title-as-index.spec.ts`.
- **unthemed**: no theme, for the Axe cells in `metadata-blocks.spec.ts` and `footer-links.spec.ts`.

Add one root script that builds all the dists the suite needs, including `dist-nodrafts`, which `build:a11y` omits. Add the matching build and artifact steps to `.github/workflows/ci.yml`. `ci-ok` stays the one required check, and path scoping stays as it is.

**Validate**: `playwright test --list` shows the new projects, and each server starts. Specs arrive in later WPs.

## Risks

- Writing a golden after a behaviour change would make it worthless. Keep this WP first, and the stamp test honest.
- Runtime: about 20 more fixture builds, at roughly 6 seconds each when warm. Cold CI runs are unmeasured, so report them. Sharing builds per option set is what keeps this acceptable.
- The dependency's size: about 900 KB on disk for every consumer. WP07 only reads it for an `fa-` name.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (NFR-001, NFR-002, C-003) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Check the golden's commit precedes every behaviour change on the branch. Revert one fixture detail and confirm the baseline test fails.

Check that tests fail without the change, not only that they pass with it.
