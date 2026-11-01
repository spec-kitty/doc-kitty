---
work_package_id: WP04
title: Publish the raw document, llms.txt lines and build asserts
dependencies:
- WP03
requirement_refs:
- FR-006
- FR-008
- FR-012
- NFR-001
- NFR-004
planning_base_branch: feat/openapi-reference-pages
merge_target_branch: feat/openapi-reference-pages
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-reference-pages. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-reference-pages unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-reference-pages-01M60GZ5
base_commit: e8755fda53df2a3b15b462ffcc752d5702c13560
created_at: '2026-10-31T14:23:00.876856+00:00'
subtasks:
- T011
- T012
- T013
history:
- '2026-10-29: created by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/lib/integrations/openapi-publish.ts
create_intent:
- src/lib/integrations/openapi-publish.ts
- src/tests/openapi-raw-document.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/integrations/openapi-publish.ts
- src/lib/routes/llms-txt.ts
- src/tests/openapi-raw-document.test.ts
- src/scripts/assert-build-artifacts.mjs
- src/tests/route-table.test.ts
- src/tests/sitemap-order.test.ts
- src/tests/sitemap-feeds.test.ts
- src/tests/agent-links.test.ts
- src/tests/docs-root-cross-surface.test.ts
- example/url-baseline.txt
role: implementer
tags: []
tracker_refs:
- '#244'
---

## ⚡ Do This First: Load Agent Profile

Load the `frontend-freddy` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Publish each version's raw document and its sha256 sidecar, add the `llms.txt` lines, make sure every API page is in the sitemap and search, and extend the build asserts. Put the emit logic in a new `src/lib/integrations/openapi-publish.ts`, which `openapi.ts` (WP03) calls. A one-line hook-up in `openapi.ts` is allowed; record the rationale in the commit.

## Subtasks

**T011: Raw document and checksum** (FR-006, FR-012).
- At build end, copy each spec byte for byte to `dist/<section>/<label>/openapi.<ext>`. Never round-trip it through YAML or JSON.
- Write `openapi.<ext>.sha256` containing `<hex>  openapi.<ext>\n`.
- On any failure, write nothing for any version.
- Generated-page rules (ADR-0049 §3):
  - an authored file at the output path stops the build, with the path named;
  - stale outputs are pruned;
  - an empty or unreadable spec never deletes existing output.

Tests in `src/tests/openapi-raw-document.test.ts`: byte equality (`Buffer.compare`), the `sha256sum -c` format, no partial output when one of two specs is broken, and each generated-page rule.

**T012: llms.txt, sitemap and search** (FR-008). In `src/lib/routes/llms-txt.ts`, add one line per version: `- [<label>](<absolute raw URL>)`, with ` (unreleased)` appended for unreleased versions. Every API page (including unreleased ones) must be in the sitemap; check the sitemap draft filter does not drop them. The page title must be findable in the Pagefind index. Update `route-table.test.ts`, `sitemap-order.test.ts`, `sitemap-feeds.test.ts`, `agent-links.test.ts`, `docs-root-cross-surface.test.ts` and `example/url-baseline.txt` deliberately, listing the new URLs exactly. Do not loosen them; CI's `check-redirect-coverage` reads the baseline.

**T013: Build asserts, determinism and cost.** Extend `src/scripts/assert-build-artifacts.mjs` to check that:
- the pages exist;
- every operation and component-schema name of each fixture is visible;
- the version links and badge are present;
- the raw document and checksum equal the input;
- the `llms.txt` lines and sitemap entries are present;
- there is no request console and no fetch of the spec;
- NFR-002 as waived: the external origins equal an ordinary page's, and the inline hashes equal an ordinary page's plus ONLY the hashes in a pinned allowlist (the plugin's known script, and the overview `--sl-icon-size` style attribute if it needs an allowance). The allowlist is a constant next to the pinned version, with a comment saying to re-derive it when the pin changes. Negative control: turning snippets on adds hashes and must fail the assert.

Determinism (NFR-001): build twice and `diff -r` exactly `example/dist/reference/api/` (pages plus raw documents) and `example/dist/llms.txt`.

Build cost (NFR-004): measure the median of 3 builds with and without the fixture config. Report the numbers. **Pass/fail is ≤10 s**, and the reviewer checks it against the CI timings, not local ones.

## Definition of Done

- The raw-document tests and asserts bite (mutation-checked: change one byte, drop one line).
- Determinism holds.
- The NFR-004 numbers are reported with a pass or fail.

## Reviewer guidance

- Check the raw-document bytes are untouched.
- Check unreleased pages are in the sitemap.
- Check every updated pin test lists exact URLs.

## Branch Strategy

- Planning branch and final merge target: `feat/openapi-reference-pages` (the mission PR goes to `main`).
- Execution worktrees are allocated per computed lane from `lanes.json`. Do not pick a base branch by hand.
- Implement command: `spec-kitty agent action implement WP04 --agent claude --mission openapi-reference-pages-01M60GZ5`

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
