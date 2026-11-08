---
affected_files: []
cycle_number: 1
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T15:21:06Z'
reviewer_agent: claude:claude-opus-5-5:reviewer
wp_id: WP07
---

# WP07 review: changes requested

## Must-fix
1. **src/scripts/assert-openapi-artifacts.mjs:250-253** checks for overview hrefs only (`href="[^"]*/<section>/<label>/"`). WP07's deep links make `assert:openapi` fail on every shared-operation page, which turns example-adopter `T023` and `#103` red. WP07 introduced both failures. Fix:
   - Precompute each spec's operation slugs before the page loop (`slugOfOperation`, including the duplicate `/<method>` suffix).
   - On an operation page, expect `/<section>/<slug(other.label)>/operations/<slug>/` when the other spec has that operation. Otherwise expect `/<section>/<slug(other.label)>/`.
   - On an overview page, keep the overview expectation.

   This is about 10 lines and keeps the check meaningful: it now also checks the same-operation mapping. Record it as an out-of-map edit, as you did for the integration test.
2. Run the full suite again (`pnpm --filter @spec-kitty/doc-toolkit exec vitest run`). Only the 4 known WP02 failures may remain: config-invariants, sidebar-build-html and header-carrier ×2.

## Nice-to-have
- `versionBase` in switcher.ts drops empty and `.` segments; the renderer's `getSchemaBasePath` does not. This is harmless, but either align the two or document the difference.
- A non-ASCII operation slug comes through percent-encoded in the pathname, so it silently falls back to the overview. Decode it in `operationSlugOf`.
- A slug collision such as labels `v1.1` and `v11` is not detected.

## Verified OK
- The slug rules match starlight-openapi 0.27.0 (`libs/operation.ts`, `libs/path.ts`).
- The component adds no inline script, and the CSP allowlist is unchanged.
- a11y: openapi.spec.ts passes 36/36. The dropdown is opened before axe runs, in both themes. The deep link works with scripts off.
- The edit to the integration test's "chrome sources" assertions is a correction, not a weakening.
- typecheck and lint pass.
