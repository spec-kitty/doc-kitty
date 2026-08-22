---
title: CI/CD Pipeline — Acceptance Record
description: Offline-proven acceptance evidence and the live post-activation checklist for mission M0.
status: active
updated: 2026-08-22
type: Operations
authors:
  - stijn@sddevelopment.be
tags: [ci, cd, acceptance]
related:
  - architecture/ci-cd-pipeline
  - adr/0007-ci-cd-path-scoped-lanes
---

# CI/CD Pipeline — Acceptance Record (WP08)

Mission **ci-cd-pipeline-01M0N1DZ**. This record separates acceptance that is
**offline-provable in-mission** (executed and evidenced here) from acceptance that
is **intrinsically live** (needs the pipeline running on GitHub with branch
protection active + a real Pages deployment). Live items are a tracked
post-activation checklist, not claimed as proven.

## Offline acceptance — executed 2026-08-22 (all green)

| Check | Command | Result |
|---|---|---|
| Frozen install (Node 22) | `pnpm install --frozen-lockfile` | PASS |
| Typecheck (astro check, covers toolkit) | `pnpm typecheck` | PASS (0 errors) |
| Lint (eslint) | `pnpm lint` | PASS |
| Toolkit unit tests | `pnpm test` | PASS (16/16) |
| Example build | `pnpm build` | PASS (14 pages) |
| Build-artifact assertions | `pnpm assert:artifacts example/dist` | PASS |
| Frontmatter (docs) | `pnpm validate:docs` | PASS |
| Frontmatter (example) | `pnpm validate:example` | PASS |
| Link/related integrity | `pnpm validate:links` | PASS (401 refs) |
| Markdown lint (docs+example) | `markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"` | PASS |
| Classifier + gate table tests | `node --test .github/scripts/*.test.mjs` | PASS (8/8) |
| Workflow static lint | `actionlint` (1.7.12) on ci/deploy/nightly | PASS (0) |
| Trigger safety | no `pull_request_target` in any trigger | PASS |
| Supply-chain | all 9 third-party actions SHA-pinned | PASS |

### Failure-path proofs (the gates actually bite)
- **code-quality**: injected type error → `pnpm typecheck` red; unused var → `pnpm lint` red (WP01).
- **doc-sanity**: malformed frontmatter, dangling `related`, bare-URL markdownlint, banned-hedge Vale each → red (WP02); reviewer re-confirmed the dangling-ref probe.
- **build-example**: missing/truncated artifact, corrupted sitemap, wrong index count each → `assert:artifacts` non-zero (WP03, 5 demos).
- **ci-ok**: `ci-ok-decision` table proves red on any lane failure/cancellation and on a detect-changes failure; green on all-skip (ignored-only) + detect success.
- **lockfile**: drifted manifest → `pnpm install --frozen-lockfile` fails `ERR_PNPM_OUTDATED_LOCKFILE` (WP01, NFR-008).

## Success-criteria → evidence

| SC | Statement | Status | Evidence |
|----|-----------|--------|----------|
| SC-001 | doc-only PR → single sanity lane, no build/test | Logic proven; run live-pending | `derive-change-groups` test: `repo_docs` → run_doc_sanity only |
| SC-002 | code-only PR → code checks + build, no doc build | Logic proven; run live-pending | classifier test: `code` → CQ+DS+BE; DS is build-free |
| SC-003 | example_content PR → sanity + build, no code | Logic proven; run live-pending | classifier test: `example_content` → DS+BE |
| SC-004 | ci-ok sole required; green on pass/skip, red on fail | Logic proven; gate live-pending | `ci-ok-decision` table (all 10 rows) |
| SC-005 | ignored-only PR mergeable | Logic proven; run live-pending | classifier (ignored→all false) + ci-ok (all-skip→pass) |
| SC-006 | docs-only mainline no redeploy; deployable redeploys | Logic proven; run live-pending | deploy.yml path-gate reuses filters; trace in WP05 |
| SC-007 | fresh checkout install/test/build green; shared build | Proven offline (build); Pages publish live-pending | offline sweep above; composite reused (actionlint clean) |
| SC-008 | fresh checkout green on Node 22; drifted lockfile fails | Proven offline | frozen-install PASS + drift demo (WP01) |
| SC-009 | nightly runs only after new deploy; issue only on fail; never gates | Logic proven; behavior live-pending | gate job (Deployments API vs git-ref marker); actionlint clean |
| SC-010 | build lane + each doc/code gate red on injected defect | Proven offline | failure-path proofs above |

## Live post-activation checklist (repo admin + first deploy)

Run once after activating the pipeline (see `docs/ops/ci-cd.md`):

1. **Branch protection**: Settings → Branches → require **only** the `ci-ok` status
   check on `main`. **Pages**: Settings → Pages → Source = GitHub Actions.
2. **Lane matrix** (throwaway PRs): a `docs/**`-only PR runs only doc-sanity; a
   `src/**`-only PR runs code-quality+build-example (+build-free doc-sanity); an
   `example/docs/**`-only PR runs doc-sanity+build-example; a `.github/workflows/**`
   PR runs all; a `research/**`-only PR runs no heavy lane and is **mergeable**.
3. **Gate red paths**: a PR with a real type error / bad frontmatter / missing
   artifact turns `ci-ok` red; confirm a detect-changes failure also reds `ci-ok`.
4. **Deploy**: merge a `repo_docs`-only change to `main` → no redeploy; merge a
   `code`/`example_content` change → site publishes to Pages from the shared build.
5. **Nightly**: dispatch once (first run) → suite runs, marker set; dispatch again
   with no new deploy → gate no-ops (0 checks); force a threshold miss → the single
   "Nightly smoke failures" issue is opened/updated; confirm it never gates a merge.

## Notes
- `.excalidraw` under `docs/` classifies as `repo_docs` (first-match: `docs/**`
  outranks `**/*.excalidraw`); asserted in the classifier test. Low impact
  (doc-sanity is build-free and skips non-`.md`).
- Lighthouse thresholds (SEO/a11y/best-practices ≥ 0.9, console-errors = 0) are
  conservative starting values, tunable after the first live run (C-009: perf/CWV
  not gated at M0).
