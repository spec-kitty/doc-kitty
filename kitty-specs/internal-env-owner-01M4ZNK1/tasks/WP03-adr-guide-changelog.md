---
work_package_id: WP03
title: ADR-0057, consumer guide, CHANGELOG and byte-identical check
dependencies:
- WP01
- WP02
requirement_refs:
- FR-006
- FR-007
- FR-008
- NFR-001
- SC-002
- SC-003
planning_base_branch: chore/internal-env-owner
merge_target_branch: chore/internal-env-owner
branch_strategy: Planning artifacts for this mission were generated on chore/internal-env-owner. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/internal-env-owner unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-internal-env-owner-01M4ZNK1
base_commit: a4f7220edc30ec6b2ccd5df221f79388f667f620
created_at: '2026-10-15T11:57:22.110947+00:00'
subtasks:
- T010
- T011
- T012
- T013
agent: claude
history:
- timestamp: '2026-10-15T12:00:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: docs/
create_intent:
- docs/adr/0057-internal-env-handoff-seam.md
execution_mode: code_change
model: sonnet
owned_files:
- docs/adr/0057-internal-env-handoff-seam.md
- docs/adr/0050-*.md
- docs/adr/0055-*.md
- docs/adr/0056-gherkin-results-followups.md
- docs/adr/README.md
- docs/guides/consumer-setup.md
- CHANGELOG.md
role: implementer
---
# WP03 — ADR-0057, consumer guide, CHANGELOG and byte-identical check

## ⚡ Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill before reading anything else. Then load the action doctrine: `spec-kitty charter context --action implement`.

## Test economy (DIRECTIVE_041) — read before writing any test

Add a test only when it guards real behaviour through the existing entry point and fails on a real regression. No duplicate assertions, no shape pins, no tests that are inert once the fix lands. Prefer strengthening an existing test. A red-first demo that is not worth keeping goes in your hand-off as evidence (command + failing output), not in the commit. In your hand-off, give a table of every test you added or changed: regression caught, existing coverage.

## Environment notes

- Run vitest SERIALLY from `src/`: `cd src && ./node_modules/.bin/vitest run <files>`. Never `pnpm exec`. Parallel runs clash on `example/` fixtures.
- ESLint: `./node_modules/.bin/eslint <files>` from the repo root. `tsc --noEmit -p src` shows 29 known pre-existing errors; add none.
- The PlantUML figure assertion in `example-adopter.test.ts` fails locally (no PlantUML server); that is environmental.

## Objective

Document the seam and the fix for maintainers and site authors, and prove the built site did not change.

## Subtasks

### T010 ADR-0057 "Internal env handoff seam"
Use `docs/adr/template.md` and match the style of ADR-0056. Status Accepted, date 2026-10-15. Record: the five names; the two write times (define, setup); clear-on-define; readers read `process.env` at call time and why (Vite SSR separate module graphs); no module state; "never set by hand"; why the format check stays on `DK_INDEX_BASENAME` only (C-003); the out-of-scope interleaved-define case. Add one "See ADR-0057" line to ADR-0050, ADR-0055 and ADR-0056 without changing their decisions. Add the ADR to `docs/adr/README.md` if it indexes ADRs.

### T011 Consumer guide
`docs/guides/consumer-setup.md`: where it discusses `DK_*` environment variables (or a short new subsection), list the five internal names and say "DocKitty sets these for its own use; never set them by hand." Keep adopter settings described as today.

### T012 CHANGELOG
`CHANGELOG.md` `[Unreleased]` → Fixed: bold impact-first lead with (#167): a second DocKitty config in the same process (for example in a test suite) no longer inherits the first config's draft-publication setting; then one before → after sentence. Production builds (one config per process) were not affected — say so. Match the existing entry style exactly.

### T013 Byte-identical example build (NFR-001)
Baseline = `git merge-base origin/main HEAD` (record both SHAs). Before each build `rm -rf <dir>` and run `pnpm clean` (example `.astro` cache trap). Each build must exit 0 and `find <dir> -type f | wc -l` must be > 0 and equal for both (paste both counts). Build the baseline and the branch tip in the same checkout and diff: `env -u BASE_URL DK_OUTDIR=<dir> DK_PUBLISH_DRAFTS=off pnpm --filter example build` (≈10 s, no PlantUML server needed), `git checkout --detach <main>` for the baseline, back to the branch, `diff -rq` the two dirs. Expect 0 differences (paste the output). Then run the docs gates: `node src/scripts/check-links.mjs docs example/docs` and markdownlint as in ci.yml doc-sanity (`npx --registry https://registry.npmjs.org/ markdownlint-cli2 ...`).

## Definition of Done
- `grep -l 'ADR-0057\|0057-internal-env' docs/adr/0050-*.md docs/adr/0055-*.md docs/adr/0056-*.md docs/guides/consumer-setup.md` lists all 4; the three older ADRs' diffs are additions only.
- ADR-0057 present and linked; three pointers added; guide and CHANGELOG updated.
- Example build diff empty; link check and markdownlint clean.
- Commit: `docs: record ADR-0057 and the internal env handoffs (#167)`.

## Branch Strategy

Planning branch: `chore/internal-env-owner`. Final merge target: `chore/internal-env-owner`. Execution worktrees are allocated per computed lane from `lanes.json`; claim with:

```bash
spec-kitty agent action implement WP03 --agent claude --mission internal-env-owner-01M4ZNK1 --acknowledge-not-bulk-edit
```
