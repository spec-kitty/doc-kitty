---
affected_files: []
cycle_number: 1
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T17:07:52Z'
reviewer_agent: claude:claude-opus-5-5:reviewer
wp_id: WP11
---

WP11 review: REJECTED (docs only; code, tests and all gates are green)

Must-fix:
1. docs/guides/openapi-reference.md, section 5 error table, archive row: the quoted messages don't exist. The real ones (src/lib/openapi/archive.mjs) are `no files match the archive glob`, `no files match the label pattern`, `empty label: labelPattern captured nothing`, `labelPattern must compile` / `must have exactly one capturing group`, and `the derived label … contains "."`. Quote those.
2. Same table, remote row: `a remote spec requires … sha256` is not a user-facing message. options.mjs says `sha256 is required for a remote spec`. Also add `the url must end in .yaml, .yml or .json`.
3. Guide, section 2 field table, `section` row: SAFE_SEGMENT (options.mjs:38) allows `_`, and the doc leaves it out. Write "a-z, 0-9, ., _ and -". Also document `archive.released` (optional, default true; archive.mjs:261).
4. docs/adr/0078-openapi-surface-matrix.md does not record offline mode (the brief requires it). Add it to section 3 or 4: `openapi.offline`, default `DOCKITTY_OFFLINE === '1'`, zero requests, the cache under node_modules/.cache/doc-kitty/openapi keyed by sha256, fail closed when the entry is missing or corrupted.
5. Changelog: the dotted-label breaking change is buried in docs/changelog/unreleased/260-openapi-inputs.md (section: Added). Move it into its own fragment with `section: Breaking`, for example docs/changelog/unreleased/259-openapi-dotted-labels-refused.md, so it lands under Breaking.

Nice-to-have:
- Mention in a quickstart that `pnpm build:test-dists` must run before the a11y playwright run (extras #10).

Verified OK: ADR-0078 is the next free number (origin/main ends at 0077; no open PRs). ADR-0049 and the ADR index are untouched. The dotted-label error is clear and tested. The keyed seams have an idempotence test. The routeOfSlug fix and the assert:openapi script are in place. The switcher test edit is justified, with dot slugification still unit-covered at openapi-switcher.test.ts:103.
