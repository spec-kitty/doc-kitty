---
affected_files: []
cycle_number: 1
mission_slug: gherkin-trim-and-fixes-01M4X4YF
reproduction_command:
reviewed_at: '2026-10-14T13:03:59Z'
reviewer_agent: claude
wp_id: WP05
---

# WP05 review cycle 1 — changes requested

Adversarial check of commit 637765f: two retirements were coverage disguised as duplicates.

1. **integration › rejects the reserved section (`_meta`, `glossary`).** `config.ts` passes its own list
   (`reservedSections: ['_meta', ...BUILD_GENERATED_SECTION_IDS]`) to `normalizeGherkinOptions`. The named
   covers (`options › passes reservedSections through`, the default-list parity test) never reach that
   list. Planted `reservedSections: []` in config.ts: 640/640 green. Restore one integration row (`_meta`).
2. **integration › throws [dk-gherkin] for a missing source directory.** The load test calls `loadFeatures`
   directly, so it cannot see how config.ts passes `sources` in. Planted
   `sources: opts.sources.map((s) => path.resolve(root, s))` in config.ts: 640/640 green, while the message
   no longer names the source as the user wrote it. Restore the row.

Everything else held (feature-core goldens covered by generate:210 on EXAMPLE_DOCS; check-cli error and
drift paths; include rows; options rows; default source root).
