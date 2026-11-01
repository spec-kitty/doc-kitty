---
work_package_id: WP06
title: How-to, NOTICE and CHANGELOG
dependencies:
- WP04
- WP05
requirement_refs:
- FR-011
planning_base_branch: feat/openapi-reference-pages
merge_target_branch: feat/openapi-reference-pages
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-reference-pages. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-reference-pages unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-reference-pages-01M60GZ5
base_commit: 10a09245f0c2093fc9803588d69c32eafc04dd54
created_at: '2026-10-31T16:00:01.131914+00:00'
subtasks:
- T016
- T017
- T018
history:
- '2026-10-29: created by /spec-kitty.tasks'
agent_profile: comms-cleo
authoritative_surface: docs/guides/
create_intent:
- docs/guides/openapi-reference.md
execution_mode: code_change
model: sonnet
owned_files:
- docs/guides/openapi-reference.md
- NOTICE
- CHANGELOG.md
- docs/guides/consumer-setup.md
role: implementer
tags: []
tracker_refs:
- '#244'
---

## ⚡ Do This First: Load Agent Profile

Load the `comms-cleo` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Document the feature for docsite authors. Follow the writing-preferences memory and the doctrine: audience-oriented, plain, no hype. Run Vale and markdownlint before committing.

## Subtasks

**T016: How-to** at `docs/guides/openapi-reference.md`, with the full frontmatter (`kind: How-To`, `doc_status`, `updated`; ADR-0065 requires `kind`). It covers:
- installing the two optional peers at the pinned versions;
- the `openapi` option, with the `import starlightOpenAPI from 'starlight-openapi'` line and `renderer: starlightOpenAPI`, and an example of one released and one unreleased version;
- the stable addresses (pages, `openapi.<ext>`, `.sha256` in `sha256sum` format) as a contract, with a `sha256sum -c` example;
- what the pages show (version links, the "unreleased" badge);
- every `[dk-openapi]` error and its fix;
- a **content-security note**: API pages add the pinned renderer's known inline script(s). List the exact `sha256-…` hashes from WP04's allowlist, for a `script-src` (and `style-src` if needed) hash allowance, with `'unsafe-inline'` as the alternative. Say the hashes change only when the pinned plugin version changes. State that there is no browser fetch and no request console;
- the known limits: descriptions bypass the glossary autolinker and link checks; pages are not in the agent API or content graph yet; one bundled file per version. Link each limit to the follow-up issue the orchestrator gives you in the prompt hand-off (FR-013).
- links to ADR-0049 and its addendum.

`docs/guides/README.md` is a generated Hub, so do not edit it; the page appears there by its frontmatter.

**T017: NOTICE.** Add `starlight-openapi` (MIT) and `@astrojs/markdown-satteri` (MIT) as optional third-party components, in the existing NOTICE style.

**T018: CHANGELOG.** Add an `[Unreleased]` → Added entry: a bold, impact-first lead with `(#244)`, then before and after, naming the optional peers and linking the how-to. Run `corepack pnpm -s validate:docs`, `validate:links` and markdownlint on the touched files.

## Definition of Done

- The docs validators pass.
- Vale and markdownlint are clean on the new files. MD038 at `CHANGELOG.md:437` is pre-existing; leave it.

## Reviewer guidance

- Check every error in the how-to matches a real message in WP02 and WP03.
- Check the contract addresses match `contracts/openapi-option.md`.

## Branch Strategy

- Planning branch and final merge target: `feat/openapi-reference-pages` (the mission PR goes to `main`).
- Execution worktrees are allocated per computed lane from `lanes.json`. Do not pick a base branch by hand.
- Implement command: `spec-kitty agent action implement WP06 --agent claude --mission openapi-reference-pages-01M60GZ5`

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
