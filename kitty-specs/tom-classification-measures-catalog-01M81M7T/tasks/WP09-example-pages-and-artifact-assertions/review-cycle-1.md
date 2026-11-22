---
affected_files: []
cycle_number: 1
mission_slug: tom-classification-measures-catalog-01M81M7T
reproduction_command:
reviewed_at: '2026-11-22T14:36:45Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP09
---

# WP09 review cycle 1: REQUEST_CHANGES (reviewer: claude::reviewer-renata)

Reviewed lane-g at fd25863 (range 3830b1b..fd25863): commit 2411190 (example pair and
`assertTomClassification`) and fd25863 (pin counts).

## Blockers: the full unit suite is red on this lane

`pnpm test` on fd25863 gives src 2 failed | 4331 passed. Both failures come from this lane, and
both reproduce when the two test files run on their own.

1. **`src/tests/agent-api-build-identity.test.ts` › "emits no key the published contract does not
   declare".**
   - Received: `pages/architecture/audit-logging.json.tom_classification` and
     `pages/context/incident-handling.json.tom_classification`.
   - The test's exhaustive `KEYS` table for `AgentPagePayload` (around line 110) lacks
     `tom_classification`.
   - WP06 added the key to `contract.ts` (`AgentPagePayload.tom_classification?:
     AgentPageMeasure[]`). No example page emitted it before this WP, so the gap was invisible.
   - The `satisfies Record<keyof AgentPagePayload, true>` guard would catch it, but only the
     toolkit's own `tsc` checks this file, and that run is not in root `pnpm typecheck`.
   - Fix: add `tom_classification: true` to the `AgentPagePayload` table. Add an
     `AgentPageMeasure` table (`measure, label, nature, scope, note`) and register it in the
     nested-record map, so the walk checks entry keys too.
   - This touches a test file outside WP09's map, so record it as an out-of-map edit; it closes a
     gap WP06 left.

2. **`src/tests/glossary-build-warning.test.ts` › "emits the pinned warning exactly once per
   offending page".**
   - Expected 1 `[glossary] unresolved collision "policy" in hr, shipping` line; got 3.
   - Both new pages carry the banner "It is not **policy** text and it is not legal advice", and
     "policy" is the example's deliberately unresolved cross-context term.
   - Fix: reword the banner so it doesn't use "policy" (e.g. "It is not a statement of
     practice…"), or give the pages a `glossary_context`. Rewording is simpler and keeps the
     warning pinned to the demonstrator page.

## Should fix (non-blocking)

3. "Link, don't copy" is asserted for `accountability` only. Loop over every
   `classified-as` edge of `context/incident-handling` and assert that `architecture/audit-logging`
   has none of them, so `availability-restoration` is covered too.

## Checked and fine

- The merge of lanes d, e and f is clean: every non-kitty-specs file at e9c6664 equals its version
  in an approved lane head (d/e/f). lane-e's code (ff3a71a) is included. The only extra difference
  is the WP01 changelog fragment, which lane-g never had; a merge won't delete it.
- The assertions read `dist/` only: the content graph via `loadContentGraph(distDir)`,
  `api/pages/*.json` and `okf/*.md`. No source is read.
- Pin counts: the index goes 73→75 and the sitemap 78→80. The two new pages are the only example
  files added across lanes d–g, and the real build reports exactly 75 / 80.
- Real build (drafts on) plus `pnpm assert:artifacts`: PASS, including the `tom-classification`
  line.
- Negative case, run by me: changing `events-logging` to `events-loging` fails the build (exit 1)
  with `[dk-measures] architecture/audit-logging.md: unknown measure id "events-loging" (not in
  the shipped default catalog)`.
- `pnpm lint`, `pnpm typecheck`, `validate:example` and `validate:catalog` pass.
