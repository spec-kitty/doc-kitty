# Tasks: Base-aware links in generated outputs

**Mission:** base-aware-generated-links-01M5PFPE. **Branch:** `fix/base-aware-generated-links`, merging into `fix/base-aware-generated-links`, which then goes as a PR into `main`.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red-first: based-site test for the per-page `source` | WP01 | [P] |
| T002 | Emit an absolute `source` in `agentPageRoute` | WP01 | |
| T003 | Unbased regression row for the per-page `source` | WP01 | |
| T004 | Red-first: based-site rows for the OKF site URL (D1), including the CLI path | WP02 | [P] |
| T005 | Compose origin plus base in `exportOkfBundle`, without adding the base twice | WP02 | |
| T006 | Red-first: `.md` resolution rows (D2+D3) and edge cases | WP02 | |
| T007 | Add id-based `.md` resolution to `rewriteUrl`; pass `pageId`/`ids` from core | WP02 | |
| T007b | Check relative links in the conformance check | WP02 | |
| T008 | Unbased parity check and the route-relative regression row | WP02 | |
| T009 | Update the export-okf guide (`--site-url` meaning, `.md` link rules) | WP03 | |
| T010 | Addendum to ADR-0059 §Link form | WP03 | |
| T011 | CHANGELOG `[Unreleased]` entries for #236 and #237 | WP03 | |

## WP01: Absolute per-page agent `source` (#236)

**Prompt:** [tasks/WP01-agent-page-absolute-source.md](tasks/WP01-agent-page-absolute-source.md). **Priority:** P1. **Dependencies:** none.

T001 Red-first: based-site test for the per-page `source` (WP01)
T002 Emit an absolute `source` in `agentPageRoute` (WP01)
T003 Unbased regression row for the per-page `source` (WP01)

**Independent test:** `pnpm vitest run src/tests/agent-page-includes.test.ts`.

## WP02: OKF export links that know about the base and the source file (#237)

**Prompt:** [tasks/WP02-okf-base-and-md-links.md](tasks/WP02-okf-base-and-md-links.md). **Priority:** P1. **Dependencies:** none. It can run in parallel with WP01.

T004 Red-first: based-site rows for the OKF site URL (D1), including the CLI path (WP02)
T005 Compose origin plus base in `exportOkfBundle`, without adding the base twice (WP02)
T006 Red-first: `.md` resolution rows (D2+D3) and edge cases (WP02)
T007 Add id-based `.md` resolution to `rewriteUrl`; pass `pageId`/`ids` from core (WP02)
T007b Check relative links in the conformance check (WP02)
T008 Unbased parity check and the route-relative regression row (WP02)

**Independent test:** `pnpm vitest run src/tests/okf-export-links.test.ts src/tests/okf-export.test.ts`.

## WP03: Docs and CHANGELOG

**Prompt:** [tasks/WP03-docs-and-changelog.md](tasks/WP03-docs-and-changelog.md). **Priority:** P2. **Dependencies:** WP01, WP02.

T009 Update the export-okf guide (`--site-url` meaning, `.md` link rules) (WP03)
T010 Addendum to ADR-0059 §Link form (WP03)
T011 CHANGELOG `[Unreleased]` entries for #236 and #237 (WP03)
