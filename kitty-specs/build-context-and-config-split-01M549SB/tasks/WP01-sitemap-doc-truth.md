---
work_package_id: WP01
title: '#103: the docs name the real sitemap'
dependencies: []
requirement_refs:
- FR-001
- FR-002
- SC-002
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: 8712a64122940f09fa9d33c38ea45714c001631a
created_at: '2026-10-17T07:08:21.844271+00:00'
subtasks:
- T001
- T002
- T003
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- README.md
- docs/guides/adopting.md
- docs/architecture/generators.md
- docs/architecture/metadata-model.md
- docs/architecture/overview.md
- docs/architecture/README.md
- docs/context/convention.md
- docs/context/product.md
- example/docs/architecture/overview.md
- example/docs/context/product.md
- example/docs/presentations/feature-tour.md
- example/README.md
- agents/doc-kitty-find/SKILL.md
role: implementer
---
# WP01 — #103: the docs name the real sitemap

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
Every adopter-facing doc names the sitemap the site really serves (`sitemap-index.xml`, plus `sitemap-0.xml` where the parts matter), and nothing still claims the package is unpublished (#103 items 1 and 3).

## Subtasks
### T001 Sitemap paths
Replace `/sitemap.xml` as a SERVED path in the owned files (list from `grep -rln "sitemap\.xml"` excluding docs/adr, docs/changelog, CHANGELOG, research/, .kittify/, kitty-specs/). Read each hit: change it only where it names the URL a site serves; keep it where it names something else (a filename pattern, history). `docs/context/agent-first.md` and `docs/plans/features/*` are WP07's (they also get `_links` text) — leave them.
### T002 Package-published guard (FR-002)
`grep -rniE "not (yet )?published|npm install @spec-kitty|registry\.npmjs|commondocs-kitty/toolkit" README.md docs example/README.md` outside history: anything still claiming the package is unpublished or naming another install path gets corrected to the GitHub Packages path in docs/guides/consumer-setup.md. Paste the grep output (expected empty or history only).
### T003 Gates
`node src/scripts/check-links.mjs docs example/docs`; markdownlint as ci.yml doc-sanity (`npx --registry https://registry.npmjs.org/ markdownlint-cli2 …`, read the exact globs from .github/workflows/ci.yml). Then a final `grep -rn "sitemap\.xml"` over the owned files and paste what remains with a reason per hit.

## Definition of Done
- No served-path `/sitemap.xml` in the owned files; T002 grep clean.
- Commit: `docs: name the real sitemap files (#103)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP01 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
