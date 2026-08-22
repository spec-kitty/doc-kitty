# Contract — `ci-ok` aggregate job

**Role**: the single required status check in branch protection.

## Dependencies
`needs: [detect-changes, code-quality, doc-sanity, build-example]`, `if: always()`.

## Pass/fail rule
- GREEN iff `detect-changes.result == 'success'` AND none of the three lanes has
  result `failure` or `cancelled` (a `skipped` lane is a pass).
- RED otherwise — including a `detect-changes` failure (no all-skip false green).

## Acceptance (maps to spec)
- FR-012, C-005, NFR-003; US2.11 (lane failure → red), US2.12 (detect-changes
  failure → red), US2.13 (pass on pass/skip), US2.7 + SC-005 (ignored-only mergeable).

## Non-fakeability
- An implementation of `always() + exit 0` MUST fail US2.11/US2.12; the E2E adds a
  deliberately red lane and asserts ci-ok reports failure.
