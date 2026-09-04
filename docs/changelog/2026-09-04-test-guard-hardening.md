---
title: Test-guard hardening — Hub draft-exclusion guard + no CI vitest build-race
description: "Closes #53/#54 — Hub's draft-exclusion is now a mutation-true unit guard, and the two astro-build test suites no longer race under vitest parallelism."
doc_status: active
updated: 2026-09-04
type: Changelog
kind: Changelog
tags: [testing, ci, hub, reliability]
related:
  - adr/0035-vocabulary-core-consolidation
  - context/convention
---

# 2026-09-04 — Test-guard hardening

Two quality follow-ups from the metadata-vocab-hub-consolidation mission (PR #55). Both are test/CI-infra only — no change to shipped site behavior.

## What changed

- **Hub draft-exclusion is now regression-guarded (#53).** `Hub.astro`'s child-selection (published ∧ parent-of-current ∧ kind, then sort) is extracted into a pure, importable `src/lib/hub-children.mjs` (`selectHubChildren`), and a new `hub-children.test.ts` exercises the **real** predicate. Previously the only Hub test replicated the filter, so removing the `isPublished` draft-exclusion left the suite green while draft pages would leak into hubs. The new test is **mutation-true**: deleting the `isPublished` clause reds it. `Hub.astro`'s rendered output is unchanged (pure extraction).

- **No more CI vitest build-race (#54).** `example-adopter` and `glossary-build-warning` each spawn a full `astro build` against the shared `example/dist`; under default file-parallelism they raced and flaked intermittently. `src/vitest.config.ts` now sets `fileParallelism: false`, so file-level suites run sequentially and the two builds no longer clobber each other. Trade-off: full-suite wall-clock rises (~10.5s → ~28s) because the two builds serialize; a future refactor giving each build suite its own output dir could restore parallelism.

## Why it matters

Closes the gap between "the suite is green" and "the suite catches the regression" for Hub draft-exclusion, and removes a flaky CI signal that was being misattributed to unrelated PRs. No dependency added, upgraded, or removed.
