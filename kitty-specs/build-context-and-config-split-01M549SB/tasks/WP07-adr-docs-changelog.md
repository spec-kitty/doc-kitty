---
work_package_id: WP07
title: ADR-0058, _links docs, "published" vocabulary, CHANGELOG and final gates
dependencies:
- WP01
- WP02
- WP03
- WP04
- WP05
- WP06
requirement_refs:
- FR-006
- FR-011
- FR-012
- FR-013
- NFR-001
- NFR-002
- NFR-004
- NFR-005
planning_base_branch: chore/build-context-and-config-split
merge_target_branch: chore/build-context-and-config-split
branch_strategy: Planning artifacts for this mission were generated on chore/build-context-and-config-split. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/build-context-and-config-split unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-build-context-and-config-split-01M549SB
base_commit: 3f5e063f657eddf69fc5e652876f382341e67d99
created_at: '2026-10-17T07:38:17.309873+00:00'
subtasks:
- T022
- T023
- T024
- T025
- T026
agent: claude
history:
- timestamp: '2026-10-17T07:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: docs/
create_intent:
- docs/adr/0058-build-state-owner-and-config-split.md
execution_mode: code_change
model: sonnet
owned_files:
- docs/adr/0058-build-state-owner-and-config-split.md
- docs/adr/README.md
- docs/context/agent-first.md
- docs/plans/roadmap.md
- docs/plans/features/README.md
- docs/plans/features/generated-sitemap-and-read-api.md
- docs/plans/design-readiness.md
- docs/guides/draft-publication.md
- docs/guides/consumer-setup.md
- CHANGELOG.md
role: implementer
---
# WP07 — ADR-0058, _links docs, "published" vocabulary, CHANGELOG and final gates

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
Document the shipped behaviour and run the mission's end gates.

## Subtasks
### T022 ADR-0058
Template docs/adr/template.md, style of ADR-0057, Accepted, 2026-10-17. Records: the per-config build-state owner and the warning-sink outcome (from WP02's report); the module split (table of modules); the env contract (`envDir`, `--mode`, `local` rejected, process env wins, gate `--env-dir`); redirect withholding kept static-only and why (DocKitty builds static sites); the draft-only empty-group drop kept and why; `_links` relation set and the rule that additive keys keep version `'2'` (DIRECTIVE_018). Index row in docs/adr/README.md; pointer lines (additive) in ADR-0057 if it describes the draft value channel.
### T023 `_links` docs (FR-006)
`docs/plans/roadmap.md` ~108, `docs/plans/features/README.md` ~46/103, `docs/plans/features/generated-sitemap-and-read-api.md`, `docs/plans/design-readiness.md` ~95/106 (relation set now defined → point at ADR-0058), `docs/context/agent-first.md` (also fix its `/sitemap.xml`): describe the shipped shape and relation names exactly as WP06 emits them (read the built example output).
### T024 Vocabulary (FR-011) and env docs
A short note (in docs/guides/draft-publication.md and the glossary if the repo has an entry for "published" — grep `glossary`) giving "published" = `isPublished()` true and "emitted" = built, incl. drafts under `DK_PUBLISH_DRAFTS=on`. Update draft-publication.md's env-file section (~117-121) and consumer-setup.md for `envDir`, `--mode` and the gate `--env-dir` flag.
### T025 CHANGELOG (FR-013)
`[Unreleased]`: Added — `_links` (bold impact-first lead, (#103)); Changed — the env reader honours `vite.envDir` and `--mode` (who is affected: sites that set envDir or build with a custom mode; before → after) (#115); Fixed/Changed for the sitemap docs only if a site author would notice. Match neighbouring entry style exactly.
### T026 End gates
- NFR-004: `wc -l src/lib/config.ts` ≤ 1,000.
- NFR-002: export list vs `research/config-exports-before.txt` identical (paste diff).
- NFR-001: the WP06 byte check re-run on the final tree.
- NFR-005: `cd src && npm pack --dry-run --registry https://registry.npmjs.org/` lists every `lib/integrations/*.ts` and `lib/build-state.ts`; the consumption test runs in CI (note it).
- No cycles: `grep -c "from '\.\./config" src/lib/integrations/*.ts` is 0 for every file.
- NFR-003: `git diff <merge-base> -- src/tests` touches only assertions on the agent-API bodies or the integration-name constant; list them.
- check-links over docs and example/docs; markdownlint as ci.yml doc-sanity.

## Definition of Done
- Commit: `docs: record ADR-0058 and document _links, envDir/--mode and "published" (#115, #103)`.

## Branch Strategy

Planning branch: `chore/build-context-and-config-split`. Final merge target: `chore/build-context-and-config-split`. Execution worktrees are allocated per computed lane from `lanes.json`. Lanes start from the mission base: the orchestrator merges dependency lanes in before you start. Claim with:

```bash
spec-kitty agent action implement WP07 --agent claude --mission build-context-and-config-split-01M549SB --acknowledge-not-bulk-edit
```
