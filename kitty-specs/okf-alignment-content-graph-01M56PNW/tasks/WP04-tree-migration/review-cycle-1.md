---
affected_files: []
cycle_number: 1
mission_slug: okf-alignment-content-graph-01M56PNW
reproduction_command:
reviewed_at: '2026-10-18T06:15:49Z'
reviewer_agent: claude
wp_id: WP04
---

# WP04 review: REJECTED

## Blocking (orchestrator ruling)
- The one-off migration script still ships in the published package.
  `cd src && npm pack --dry-run | grep -i oneoff` prints:
  `npm notice 5.8kB scripts/oneoff/migrate-okf-metadata.mjs`
  Fix: move src/scripts/oneoff/migrate-okf-metadata.mjs out of the published tree (e.g. repo-root scripts/),
  or delete it and record its run evidence (counts, idempotency) in the commit message. Update any references or tests that point at it.
  Re-check: the dry-run grep must print nothing.

## Re-verify after fix
- validate:* and pnpm build stay green; the glossary generator test still passes.
