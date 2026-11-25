---
work_package_id: WP07
title: Documentation and ADR
dependencies:
- WP04
- WP05
requirement_refs:
- FR-020
- C-004
- C-006
- SC-006
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
- T032
- T033
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: docs/guides/paged-hub-listing.md
create_intent:
- docs/guides/paged-hub-listing.md
- docs/adr/0089-paged-hub-listing.md
- docs/changelog/unreleased/342-paged-hub-listing.md
execution_mode: planning_artifact
owned_files:
- docs/guides/paged-hub-listing.md
- docs/adr/0089-paged-hub-listing.md
- docs/changelog/unreleased/342-paged-hub-listing.md
- docs/guides/sidebar-child-cap.md
- docs/guides/consumer-setup.md
- docs/guides/authoring.md
- docs/architecture/generators.md
role: implementer
tags: []
tracker_refs: []
---
# WP07 — Documentation and ADR

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Site owners can find, configure and understand paged hub listings. The decision is recorded as an ADR, and the change has a changelog fragment.

- Requirements: FR-020 (docs part), C-004, C-006.
- Plan: IC-05, the Charter Check (living documentation). Research: R3, R5, R9.

## Shared context

- **Models to copy**:
  - `docs/guides/sidebar-child-cap.md`, the slice-1 configuration guide;
  - `docs/adr/0084-sidebar-child-cap.md`, the slice-1 ADR (Proposed);
  - `docs/changelog/unreleased/341-sidebar-child-cap.md`, the fragment format; also read `docs/changelog/unreleased/README.md`.
- **AGENTS.md rules**:
  - Every page carries `title`, `description`, `doc_status`, `updated`, `kind`, plus `type` when it is not derived.
  - Add the ADR file but **never** the index row in `docs/adr/README.md`; a bot regenerates the index.
  - Changelog by fragment only; never edit `CHANGELOG.md`.
- **Prose (charter)**: audience-oriented; sentence-case headings; one idea per sentence; landings teach, then link. Avoid AI-writing tells: em-dash overuse, rule-of-three padding, hedging, puffery and filler.
- **Behaviour to document**: WP01–WP05 as delivered. Read the merged code, not just the plan, so the docs match what shipped.
- Before hand-off, run `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:changelog`, `pnpm validate:adr-ids`, markdownlint on the changed files, and the full `pnpm test`.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. The lane worktree comes from `lanes.json`. This WP runs in parallel with WP06. Start with:

```bash
spec-kitty agent action implement WP07 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T030 — `docs/guides/paged-hub-listing.md`

Write a how-to page ("Page large hub listings"; `kind: How-To`, the type taken from the guides section). It covers:

- What a paged hub is, and which hubs are paged: only hubs over their sidebar child cap, and only when their children outnumber the page size. Link to the cap guide.
- Setting the page size at three levels, with a YAML or JS example each:
  - frontmatter `hub_page_size`;
  - `hub.pageSize` in `sections.yaml` (or the charter's `sections.entries`);
  - `hub.pageSize` in `defineDocKittyIntegrations`;
  - precedence, the default (50) and the validation errors.
- The paged URLs (`/<hub>/page/N/`), the canonical, and what the sidebar and prev/next do on them.
- Where paged pages appear, with the operator's reason: the sitemap, the agent API (`kind: "Listing"` records and per-page JSON), `llms.txt` and search.
- The `page` child collision error, with its message and how to fix it.
- Translating the pagination strings (the five `dockitty.hub.pagination.*` keys and their English defaults).
- Limits: locales follow #341 (a locale needs its own hub index; fallback pages are not listed). There is no "load more", sorting or filtering yet (#343), and no `llms: summary` mode yet (#344).
- `related:` entries for the cap guide, ADR-0089 and the large-hubs plan.

### T031 — ADR-0089 and cross-references

1. **The number is 0089**, allocated by the dispatcher across the parallel missions (research R9): 0086 is #403's and 0088 the diagram mission's, both in flight. Before hand-off, run `pnpm validate:adr-ids`, and check `docs/adr/` on `main`, on `kitty/mission-subprocessor-catalog-01M84X07` and on `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5`. If 0089 is taken there, stop and ask the dispatcher rather than picking a number.
2. Write `docs/adr/0089-paged-hub-listing.md` ("Paged hub listings, included in every surface"; Proposed, 2026-11-24). Model it on ADR-0084: Status, Context, Decision, Consequences (positive and negative), Risks, Alternatives considered, References. Its decisions:
   - Which hubs are paged, and the page-size setting at three levels.
   - The injected `StarlightPage` route `/[...hub]/page/[page]/` in the frame.
   - One hub data set for every hub (#429). The `HubCap` widening is backward compatible.
   - Paged pages in every surface, each self-canonical. The R5 duplicate rule.
   - The decision reverses #342's original "no paged URL in the sitemap" criterion, by the operator's ruling.
   - The `page` collision fails the build.
   - Alternatives, from research R1, R2, R3 and R5: a query-string page, consumer page files, reusing the cap for the page size, excluding paged pages from the sitemap and search, and listing children per page in `llms.txt`.
   - Add `related:` entries for ADR-0084, ADR-0063 and the guides.
3. In `docs/guides/sidebar-child-cap.md`, add a short paragraph and a `related:` entry pointing to the paged listing: the capped entry now leads to a paged hub. **Do not edit ADR-0084's decision text.** It is Proposed, not Accepted, but the rule is to add a new ADR rather than rewrite an old one, so put the cross-reference in ADR-0089.

### T032 — Agent API docs (`docs/architecture/generators.md`)

Find where `generators.md` describes `/api/index.json` and the per-page JSON (confirm the right page with `grep -rn "api/index.json" docs`). Document the `kind: "Listing"` record (`listing_of`, `page`, `of`), its position after the docs records and before the OpenAPI records, and the per-page `children`. Add the `llms.txt` listing line format. If another page documents the agent API surfaces more directly, update that one and record the out-of-map edit with its rationale.

### T033 — Changelog fragment and cross-references

1. `docs/changelog/unreleased/342-paged-hub-listing.md`. Its `section:` follows the fragment README, for example `Added`. The body is one entry for site owners:
   - large hubs are now paged;
   - the settings;
   - the surfaces;
   - #429's `HubCap` widening, noted as backward compatible;
   - closes #342 and #429.
2. In `docs/guides/consumer-setup.md` and `docs/guides/authoring.md`, add the `hub.pageSize` option and the `hub_page_size` frontmatter key next to their slice-1 counterparts (`sidebar.childCap` and `sidebar_child_cap`), with a link to the new guide.

## Definition of Done

- The new guide, ADR-0089 and the fragment exist, and the cap guide, consumer setup and authoring cross-reference them.
- All docs validators pass. Vale runs in CI; markdownlint passes locally.
- The docs match the shipped behaviour (spot-check against the WP04 and WP05 tests).
- The full `pnpm test` is green, with counts quoted.

## Risks

- The ADR number can be taken by a PR that opens while this work is in progress. Check again just before hand-off.
- Do not document anything from #343 or #344 as available.

## Reviewer guidance

- Read the guide as a site owner: can you set the page size and predict the URLs?
- Check that the ADR records the reversal of the sitemap criterion and the operator's reason.
