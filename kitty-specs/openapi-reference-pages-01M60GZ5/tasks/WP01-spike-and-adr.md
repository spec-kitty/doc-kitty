---
work_package_id: WP01
title: Spike starlight-openapi and record the ADR-0049 addendum
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- C-006
- FR-013
- NFR-001
- NFR-002
planning_base_branch: feat/openapi-reference-pages
merge_target_branch: feat/openapi-reference-pages
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-reference-pages. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-reference-pages unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-reference-pages-01M60GZ5
base_commit: bc1dfec885f5f460b1b403a97f287ea7899a6f68
created_at: '2026-10-29T07:18:39.037938+00:00'
subtasks:
- T001
- T002
- T003
- T004
history:
- '2026-10-29: created by /spec-kitty.tasks'
agent_profile: architect-alphonso
authoritative_surface: example/openapi/
create_intent:
- example/openapi/v1.yaml
- example/openapi/main.yaml
execution_mode: code_change
model: opus
owned_files:
- docs/adr/0049-openapi-reference-via-existing-integration.md
- example/openapi/**
- src/package.json
- example/package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
role: implementer
tags: []
tracker_refs:
- '#244'
---

## ⚡ Do This First: Load Agent Profile

Load the `architect-alphonso` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Resume note (2026-10-29)

The first run of this WP hit the STOP rule on NFR-002. The operator then **waived NFR-002 narrowly**: the pinned plugin's known inline scripts are allowed and pinned by hash. The operator also set the default section to `reference/api`. Read `research.md` R7 in the MAIN checkout: it holds the full verdicts, and its numbers stand.

This run **commits** the spike result:
- the fixtures (already untracked in the worktree);
- the pinned deps: `starlight-openapi@0.27.0`, and `@astrojs/markdown-satteri@0.4.4` (the version already in the tree, not 0.4.6);
- the ADR-0049 addendum, which records the verdicts, the waiver, the adapters (the description adapter and the stylesheet filter), the default section, and the surfaces, and moves the status to Accepted.

Do not re-run the whole spike. Re-check only what the commit depends on: a frozen install, and `package-runtime-deps.test.ts`. The lockfile check for DIRECTIVE_051 is integrity hashes against `dist.integrity`, because pnpm 11 has no resolution URLs.

## Objective

De-risk the renderer before any feature code. Prove or disprove that `starlight-openapi@0.27.0` meets every C-006 exit criterion on this repo's stack (Astro 7.4, Starlight 0.42.6, the `unified()` processor of ADR-0060). Record the verdicts as an **addendum** to ADR-0049, which also moves its status to Accepted. Leave the deps and fixtures in place for WP02 and WP03.

**STOP RULE.** If any C-006 criterion fails, do not work around it. Do NOT commit the deps. Report `SPIKE FAILED: <criterion>` with the evidence, and draft the addendum text in your report. The orchestrator escalates to the operator, because the own-generator fallback is a scope change, and abandons this lane.

## Subtasks

**T001: Fixtures.**
- Add `example/openapi/v1.yaml`, an OpenAPI 3.1 document with at least 2 operations, 2 component schemas and a `type: [string, "null"]` property.
- Add `example/openapi/main.yaml`, the same API plus one more operation.
- Keep them small and deterministic: no dates, no external `$ref`.

**T002: Dependencies, under DIRECTIVE_051.**
- Add `starlight-openapi` (exact `0.27.0`) and `@astrojs/markdown-satteri` (exact current version) as **optional peers** in `src/package.json`:
  - `peerDependencies` plus `peerDependenciesMeta: { optional: true }`;
  - also as exact-pinned `devDependencies`, so the repo's own tests and example can use them.
- Add both to `example/package.json`.
- Install with the public registry (`--registry=https://registry.npmjs.org`; the local default is a corporate mirror) and keep the lockfile frozen-compatible.
- Record evidence in the ADR addendum for all five DIRECTIVE_051 controls:
  - the lockfile `resolution` URLs point at registry.npmjs.org;
  - the publish dates;
  - any `preinstall`, `install` or `postinstall` script in the whole new transitive tree (`pnpm why` / lockfile `requiresBuild`) — expect none, and do not add `onlyBuiltDependencies` entries without justification;
  - the transitive package list;
  - the Sätteri per-platform binary packages.

**T003: Spike.** On a throwaway local config (do not commit integration code; WP03 owns that), wire `starlight-openapi` for both fixtures and build the example. Record a verdict for each item:
1. It installs and builds with Astro 7.4 / Starlight 0.42.6, with the site processor left at `unified()`, and DocKitty's remark plugins still run on ordinary pages.
2. It supports several specs, each with its own `base` (route prefix) and sidebar group.
3. The pages render inside the DocKitty frame: header, sidebar, TOC rail, footer.
4. Styling works with the plugin's `styles` export NOT loaded, and `--dk-*` tokens can style its markup. Record the markup hooks (class names) WP03 will target.
5. Operation and schema text is in the static HTML (JS off).
6. Code samples (from `httpsnippet`) are static text, with no request console. If there is a console, find the config switch that disables it.
7. Two builds give byte-identical API pages (`diff -r`).
8. The inline-script and inline-style hashes and the external origins on an API page equal those of an ordinary page (NFR-002 method). Write a small script; WP03 turns it into a gate.
9. Routes are injected rather than content entries. Note which site surfaces they reach (sitemap, Pagefind, llms.txt, agent API, content graph, glossary autolinker, frontmatter gate). FR-013 needs this list.
10. The build-time cost for the 2 fixtures (median of 3).

**T004: ADR-0049 addendum.**
- Append a dated `## Addendum 2026-10-29: spike result (#244)` section. Never edit the body above it.
- It contains: the verdict table for T003, the DIRECTIVE_051 evidence, the surfaces list (FR-013), and the known limit (descriptions bypass the glossary autolinker and link checks).
- If every criterion passes, it records the decision to accept: the status line changes to Accepted, citing the addendum. Status is the one line the ADR convention allows to change; check docs/adr/README for the convention and follow it.
- Regenerate the ADR index: `node src/scripts/generate-adr-index.mjs` (then `--check`).
- Put the full spike notes in the addendum itself. Do NOT edit files under `kitty-specs/`, because lane worktrees do not merge planning files back; the orchestrator copies the notes into `research.md` R7.

## Definition of Done

- Every C-006 item has a verdict with evidence.
- The deps are pinned, and the lockfile installs with `--frozen-lockfile`.
- The ADR addendum is in place and the index check passes.
- Fixtures are committed.
- No integration code is committed, and no static import of either peer exists anywhere under `src/lib`.
- `src/tests/package-runtime-deps.test.ts` passes.

## Reviewer guidance

- Check the DIRECTIVE_051 evidence is real: lockfile URLs, scripts.
- Check the verdicts were measured, not assumed.
- Check the ADR body above the addendum is unchanged.

## Branch Strategy

- Planning branch and final merge target: `feat/openapi-reference-pages` (the mission PR goes to `main`).
- Execution worktrees are allocated per computed lane from `lanes.json`. Do not pick a base branch by hand.
- Implement command: `spec-kitty agent action implement WP01 --agent claude --mission openapi-reference-pages-01M60GZ5`

## Environment

- In a fresh worktree, run `corepack pnpm install --frozen-lockfile` first; it takes about 1 s from the store.
- Unit tests: `cd src && ./node_modules/.bin/vitest run --project fast <files>`.
- Lint: `./node_modules/.bin/eslint <files>` from the worktree root.
- Typecheck: `corepack pnpm typecheck`.
- PlantUML is not available locally (the local config points at `127.0.0.1:8091`; CI runs a `plantuml` service). Build-suite reds caused only by that `ECONNREFUSED` are environmental; say so and do not "fix" them.
- Lane worktrees have no installed deps. Run the frozen install in EVERY lane worktree before any test.
- `--project fast` does not run the build-project tests. Run the integrated build suite once, and never in parallel with another vitest run, because they share `dist`.
- New branches and helpers get tests in the same commit. Cyclomatic complexity stays ≤15.
- Read `kitty-specs/openapi-reference-pages-01M60GZ5/{spec,plan,research,data-model}.md` and `contracts/openapi-option.md` before coding. Use the MAIN-checkout copy of this prompt if the worktree copy looks stale.
