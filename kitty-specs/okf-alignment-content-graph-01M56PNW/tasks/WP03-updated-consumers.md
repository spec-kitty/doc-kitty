---
work_package_id: WP03
title: updated consumers and agent-index version (#177)
dependencies:
- WP01
requirement_refs:
- FR-009
- FR-024
- NFR-001
- C-007
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: fea01a66ab82d4ca997c75bf49b6de60e1c63c4f
created_at: '2026-10-18T05:50:16.969400+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
phase: Phase 1 - Metadata alignment (#177)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/metadata.ts
create_intent: []
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/lib/metadata.ts
- src/lib/routes/rss.ts
- src/lib/routes/agent-index.ts
- src/components/PageTitle.astro
- src/layouts/Persona.astro
- src/scripts/generate-adr-index.mjs
- src/tests/collect-doc-entries-order.test.ts
- src/tests/agent-api.test.ts
- src/tests/adr-index-generator.test.ts
- src/tests/metadata.test.ts
role: implementer
task_type: implement
---

# Work Package Prompt: WP03 – `updated` consumers and agent-index version (#177)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `frontend-freddy` (touches `.astro` display components plus TS libs)
- **Role**: `implementer`
- **Agent/tool**: `claude` (model `sonnet`)

---

## ⚠️ IMPORTANT: Review Feedback

- Check `review_ref` in the event log. Address all feedback before completing.

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the Activity Log below or in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks. Use language identifiers in code blocks.

---

## Objectives & Success Criteria

A page with a full UTC timestamp renders and sorts the same as its date-only twin (FR-009), and the agent index version moves `'2'`→`'3'` because the serialised `updated` format changes (FR-024).

Done when:

- `updatedMillis`, `toAgentRecord` and `rankForFeed` read `updated` through `normaliseInstant` (WP01); `toAgentRecord` serialises `updated` as `YYYY-MM-DDTHH:MM:SSZ`.
- `rankForFeed` keeps the slug tie-break last (determinism-hardening rule: append, never replace).
- RSS `pubDate` uses the full instant.
- `PageTitle.astro` and `Persona.astro` display date-only in UTC (no timezone leak).
- The ADR index keeps `YYYY-MM-DD` display (README does not churn).
- `agentIndexRoute` default `version` is `'3'`; `agent-api.test.ts` asserts it and the record `updated` format.

## Context & Constraints

- Plan IC-03; spec FR-009, FR-024; edge case "date-only and timestamp on the same day keep feed order deterministic".
- WP03 owns `routes/agent-index.ts` and `agent-api.test.ts`. WP05 will later add `_links.contentGraph` as a justified out-of-map edit; do not add it here.
- Runs in parallel with WP02; no shared files.

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T012 – Red-first assertions

- `src/tests/collect-doc-entries-order.test.ts`: add the FR-009 positive control to the existing order case — two entries on the same day, one `2026-10-18`, one `2026-10-18T00:00:00Z`, plus a third `2026-10-18T09:30:00Z`; assert order is by instant then slug, and the date-only twin sorts identically to its `T00:00:00Z` twin.
- `src/tests/agent-api.test.ts`: assert `version === '3'` and record `updated` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/`.
- Confirm red.

### Subtask T013 – `metadata.ts`

- **Seams (verified)**: `src/lib/metadata.ts:285` `updatedMillis`, `:327-338` `toAgentRecord`, `:489-493` `rankForFeed` (`byUpdated = updatedMillis(b) - updatedMillis(a)` then slug). Route through `normaliseInstant`; keep `compareSlug` last.
- Strengthen `src/tests/metadata.test.ts` if it asserts the record `updated` format.

### Subtask T014 – RSS and display [P]

- `src/lib/routes/rss.ts:48` (`const millis = updatedMillis(entry.data)`): pubDate from the instant; RFC-822 output via UTC.
- `src/components/PageTitle.astro:61,105` and `src/layouts/Persona.astro:65,108-109` (`asDate(data.updated)`): format with UTC getters (`toISOString().slice(0,10)` or `Intl` with `timeZone: 'UTC'`).

### Subtask T015 – ADR index keeps its date [P]

- `src/scripts/generate-adr-index.mjs:76-114`: when `updated`/date is a full instant, display `YYYY-MM-DD`. Strengthen `src/tests/adr-index-generator.test.ts` with one timestamp input row. `pnpm validate:adr-index` must stay green (no README churn).

### Subtask T016 – Agent version bump and ripple

- `src/lib/routes/agent-index.ts:109` `version: options.version ?? '2'` → `'3'`.
- Ripple (C-007): RSS bytes and agent records change; refresh any pinned example baselines that pin them in this WP. Never regenerate a timing census. If a pinned baseline lives outside `owned_files`, note a justified out-of-map update in the Activity Log.

## Test Strategy

- `pnpm --filter @spec-kitty/doc-toolkit test -- collect-doc-entries-order agent-api adr-index-generator metadata`
- Toolkit typecheck plus `pnpm --filter example typecheck` (astro check covers the `.astro` files).

## Risks & Mitigations

- Timezone leak in display: use UTC getters only; test in a non-UTC `TZ` once (`TZ=Pacific/Auckland`).

## Review Guidance

- Reviewer runs on `opus`. Check the tie-break order, the UTC display, version bump, and that no file parses dates locally instead of calling `normaliseInstant`.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- Display correction: `PageTitle.astro:61/105` only passes `updated` through. The formatting happens in `src/components/slots/MetadataBand.astro:35` (`toISOString().slice(0,10)`), which this prompt does not list. Persona.astro:94 already formats in UTC, so T014 is mostly a test, not a code change.
- `metadata.ts:329-330` (toAgentRecord) already slices to the date. FR says the agent record should carry the instant, so change it here; `agent-api.test.ts:62` and the pinned `example/dist/api/index.json` / consumer-fixture `dist*/api/index.json` outputs will move.
- The `version` bump touches only agent-index.ts:109. `scenario-index.ts:455` has its own `'1'`; leave it. No test pins `'2'` literally (grep), so the ripple shows up in built-output diffs, not unit tests.
- Order tests to rerun: `collect-doc-entries-order`, `route-feeds`, `sitemap-feeds`, `sitemap-order`, `llms-section-order`.
