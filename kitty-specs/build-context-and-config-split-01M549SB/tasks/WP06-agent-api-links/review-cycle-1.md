---
affected_files: []
cycle_number: 1
mission_slug: build-context-and-config-split-01M549SB
reproduction_command:
reviewed_at: '2026-10-17T07:19:07Z'
reviewer_agent: claude
wp_id: WP06
---

# WP06 review feedback (round 1) — REJECT

## Blocker 1: `_links.source` duplicates `self` and dangles when pages are off
`toAgentRecord` (src/lib/metadata.ts:348) sets `record.source = /api/pages/<id>.json`, so in both
agent-index.ts and agent-page.ts `_links.source.href === _links.self.href`. Worse, in agent-index.ts
`self` is gated on `declared.pages` but `source` is NOT: with `links: { pages: false }` the record still
links `source` to the unmounted per-page JSON, a dangling link that violates FR-004c ("a link is emitted
only for a surface that exists").

Required change:
- Drop the `source` relation from `_links` in BOTH routes (the record has no page-source-document field;
  per FR-004 "source where the record has one" — it does not have a distinct one). `self` already carries
  the per-page JSON href.
- Add/adjust an assertion in src/tests/agent-links.test.ts: no record's `_links` has a relation whose href
  equals `self` other than `self` (or simply: `source` absent), replacing the `r._links.source` check at line 70.
- Note the decision in the ADR/docs (FR-004 "source" deferred until a real source-document URL exists).

## Non-blocking
- Defaults all-true: accepted, matches FR-004c wording ("defaults matching the example"). Ensure the
  adopter docs for `agentIndexRoute`/`agentPageRoute` state that unmounted surfaces must be set `false`.
- No top-level `pages` link: acceptable; mention in docs that /api/pages/ has no index.
- Version stays '2', toAgentRecord untouched: confirmed.
