---
affected_files: []
cycle_number: 1
mission_slug: okf-alignment-content-graph-01M56PNW
reproduction_command:
reviewed_at: '2026-10-18T05:57:50Z'
reviewer_agent: claude
wp_id: WP03
---

# WP03 review: changes requested

## BLOCKER: FR-024 version bump is incomplete
`tests/consumption/scripts/assert-consumer-artifacts.mjs:280-303` still requires `body.version !== '2'` → fail, and its ok-message says `'2'`. After this diff the consumer-fixture clean-room proof will go red (agent-index now emits '3'). Change it to '3' (both the check and the message). The brownfield note "no test pins '2' literally" was wrong, so grep tests/ and scripts/ for every pinned agent-index version as well as src/tests.

## Also check
- Agent records now carry `updated` as `YYYY-MM-DDTHH:MM:SSZ`. Confirm that no consumer-artifact or build-artifact assertion checks a `YYYY-MM-DD` shape for `pages[].updated`, and update any that does.
- Run `pnpm validate:adr-index`. The implementer didn't run it, and this WP touches `generate-adr-index.mjs`.

Verified OK: MetadataBand/PageTitle/rss are already UTC (toISOString / updatedMillis). The metadata/Persona/ADR changes and the new tests look correct.
