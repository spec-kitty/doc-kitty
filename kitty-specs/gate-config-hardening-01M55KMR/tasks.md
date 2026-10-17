# Tasks: Gate config hardening

**Mission**: gate-config-hardening-01M55KMR | **Branch**: `fix/gate-config-hardening` → merges into `fix/gate-config-hardening` (the PR then targets `main`)

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Extract the shared config evaluator (`evaluateSiteConfig`) | WP01 | |
| T002 | `assert-build-artifacts`: evaluate the config, fail closed, `--env-dir`/`--astro-config` | WP01 | |
| T003 | `check-redirect-coverage` without `--docs`: same behaviour; conflicting `--docs`/`--site-root` → exit 2 | WP01 | |
| T004 | Remove the text search and `configEvaluated` from `draft-publication.mjs` | WP01 | |
| T005 | Strengthen the existing gate tests; delete the text-search tests | WP01 | |
| T006 | `--index-path` flag: parsing and refusal rules | WP02 | |
| T007 | Move every index check to the flag path; derive the base from `self` | WP02 | |
| T008 | Strengthen `agent-links-gating`/`example-adopter` with a custom-path fixture | WP02 | |
| T009 | Update the route JSDoc (drop the path rule, point to `--index-path`) | WP02 | |
| T010 | Move `sitemapDraftFilter` to `integrations/route-shaping.ts` and re-export it | WP03 | [P] |
| T011 | Repoint `sitemap-feeds.test.ts` | WP03 | [P] |
| T012 | Add the `./config` export-list assertion to `config-invariants.test.ts` | WP03 | [P] |
| T013 | Amend ADR-0058 (evaluation, limits, the index-path rule) | WP04 | |
| T014 | Update `docs/guides/consumer-setup.md` (`--index-path`, evaluation) | WP04 | |
| T015 | CHANGELOG `[Unreleased]` entries for #172 and #173 | WP04 | |

## WP01 — Draft gates read the evaluated config (#173)

- **Prompt**: [tasks/WP01-draft-gates-evaluate-config.md](tasks/WP01-draft-gates-evaluate-config.md)
- **Priority**: P1. **Dependencies**: none.
- **Independent test**: an imported-base `envDir` fixture resolves with no flag; a throwing config exits 2; `--env-dir` bypasses evaluation.

T001 Extract the shared config evaluator (WP01)
T002 assert-build-artifacts evaluates the config (WP01)
T003 check-redirect-coverage without --docs (WP01)
T004 Remove the text search and configEvaluated (WP01)
T005 Strengthen the gate tests (WP01)

## WP02 — `--index-path` on the artifact gate (#172)

- **Prompt**: [tasks/WP02-artifact-gate-index-path.md](tasks/WP02-artifact-gate-index-path.md)
- **Priority**: P2. **Dependencies**: WP01 (same file, `assert-build-artifacts.mjs`).

T006 Parse --index-path (WP02)
T007 Move the index checks to the flag path (WP02)
T008 Custom-path fixture (WP02)
T009 Route JSDoc (WP02)

## WP03 — Move `sitemapDraftFilter` and pin the `./config` exports (#174)

- **Prompt**: [tasks/WP03-sitemap-filter-move.md](tasks/WP03-sitemap-filter-move.md)
- **Priority**: P3. **Dependencies**: none (can run in parallel with WP01).

T010 Move sitemapDraftFilter (WP03)
T011 Repoint sitemap-feeds test (WP03)
T012 Export-list assertion (WP03)

## WP04 — ADR-0058, consumer guide, CHANGELOG

- **Prompt**: [tasks/WP04-adr-guide-changelog.md](tasks/WP04-adr-guide-changelog.md)
- **Priority**: P2. **Dependencies**: WP01, WP02.

T013 Amend ADR-0058 (WP04)
T014 Consumer guide (WP04)
T015 CHANGELOG (WP04)
