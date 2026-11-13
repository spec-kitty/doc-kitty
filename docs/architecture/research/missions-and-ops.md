---
title: Missions and Ops as generated pages
description: "Research on rendering a kittified repository's Spec Kitty missions and Ops as generated pages at core's scale, with a sidebar child cap and paged hub listings."
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: Architecture
kind: Explanation
tags: [missions, ops, generated, hubs, sidebar, scale, kittified]
related:
  - plans/features/mission-status-portal
  - plans/features/large-hubs
  - architecture/research/mission-status-portal
  - architecture/research/packs
  - adr/0079-kitty-packs-through-a-charter-contract-reader
---

# Missions and Ops as generated pages

How doc-kitty could render a kittified repository's Spec Kitty **missions**
(`kitty-specs/`) and **Ops** (`kitty-ops/`) as pages, the way
[ADR-0079](../../adr/0079-kitty-packs-through-a-charter-contract-reader.md) does
for packs. The constraint that shapes it is scale: core holds 835 missions and
about 3,900 Ops, so a hub cannot list every child in the sidebar. This page is a
proposal, not a decision. The plans are
[Missions and Ops pages](../../plans/features/mission-status-portal.md) and the
generic [Large hubs](../../plans/features/large-hubs.md) feature it depends on.

It updates the earlier [mission status portal](./mission-status-portal.md)
research, which predates core's current mission layout.

## What core holds

Measured on core (`spec-kitty` 4.0.0rc9):

| | Missions (`kitty-specs/`) | Ops (`kitty-ops/`) |
|---|---|---|
| Count | 835 directories: 72 numbered (`056-…`), 759 slug plus ULID suffix (`nightly-drift-reds-01M3M14S`), 4 residue | 3,935 `<ULID>.jsonl` records, plus `lifecycle/` (1,652 files) and `research/` |
| Size | 25,763 files, 271 MB, about 31 files per mission, the largest 165 | About 23 MB |
| Growth | Steady | About 1,000 a week since October 2026 |

### A mission

- `meta.json`: `mission_id` (ULID), `mission_slug`, `mission_number`,
  `mission_type`, `friendly_name`, `created_at`, `target_branch`,
  `status_phase`, and in newer missions `mid8`, `purpose_tldr`, `merged_at`,
  `accepted_at`, `acceptance_history`.
- `spec.md`, `plan.md`, `tasks.md`, `tasks/WP*.md`, and in many missions
  `research.md`, `data-model.md`, `quickstart.md`, `checklists/`, `contracts/`,
  `decisions/`, `reviews/`, `traces/`.
- `status.events.jsonl` is the authority: `MissionCreated`, then work-package
  transitions with `wp_id`, `from_lane`, `to_lane`, `actor` and `at`.
  `status.json` is a materialised snapshot of it (`src/specify_cli/status/reducer.py`).
  569 snapshots carry no `schema_version`, 226 carry version 2.
- Work-package states (`src/specify_cli/status/models.py`): planned, claimed,
  in_progress, for_review, in_review, approved, done, blocked, canceled. WP
  frontmatter carries no authoritative state.
- `lanes.json` (749 missions) records **execution lanes**, worktree parallelism.
  Core calls both this and the WP state a "lane". A doc-kitty model must keep
  the two apart; this page says **WP state** for the first.
- 64 missions use a coordination topology whose live status can sit on another
  branch (`status/read_surface.py`). A read of the checkout misreports them while
  they are in flight.

### An Op

- `started`: `invocation_id`, `profile_id`, `action`, `request_text`,
  `actor`, `mode_of_work`, `governance_context_hash`, `started_at`, `model_id`.
- `completed`: `completed_at`, `outcome` (3,886 done, 31 abandoned, 6 failed),
  `evidence_ref`, `closed_by`, and rarely `mission_id` and `wp_id`.
- `request_text` is the verbatim operator prompt. It must never reach a page.
- Only 7 Ops carry a `mission_id`. Links to missions and issues otherwise live
  in free text.
- `kitty-ops/ops-index.jsonl` is a gitignored local cache, so a build cannot rely
  on it. `.kittify/evidence/<ULID>/` holds closed-Op evidence.

### Read surfaces

- `spec-kitty agent tasks status --json --mission <slug>` and
  `spec-kitty orchestrator-api mission-state --mission <slug>` read **one**
  mission. **No command lists missions**; `spec-kitty mission list` lists mission
  types.
- `spec-kitty invocations list --json` lists Ops from the local index.
- Core's ADR 2026-10-01-2 defines a mission-status read API (an overview of many
  missions and a per-mission detail) with canonical conformance fixtures. It is
  the natural contract to read against, as the charter's packs contract is for
  packs.

## What doc-kitty has today

- **Sidebar.** Each registry section becomes a Starlight `autogenerate` group
  (`src/lib/config.ts`, ADR-0029). The route middleware reshapes the sidebar per
  page (`shapeSidebar` in `src/lib/route-shaping.ts`). Starlight passes the whole
  sidebar into every page, so about 4,800 extra links would add roughly 0.7 MB to
  every page's HTML, and the total output would grow with the square of the page
  count.
- **Hubs.** `selectHubChildren` (`src/lib/hub-children.mjs`) returns every
  published child, and `Hub.astro` renders all of them. There is no cap, no
  paging and no infinite scroll anywhere in `src/`.
- **Client scripts.** The disclosure control (ADR-0077) and the lightbox both
  start from a native element that works without scripts and then upgrade it.
  That is the pattern a hub listing should follow.
- **Drafts.** `DK_PUBLISH_DRAFTS` is on unless turned off, so a `doc_status:
  draft` page still ships, with `noindex`. Draft status cannot keep a mission
  private.
- **Prior asks.** Core's docsite spike drafted a card-grid hub (`hub_layout:
  cards`, core sub-issue #6941) to replace the DocFX mission dashboards. It does
  not mention scale, paging or a sidebar cap.
- **Starlight** 0.42 has per-group `collapsed` and `autogenerate`, and
  prev/next pagination, but no item cap and no listing pagination.

## Design options

### Where the data comes from

| Option | For | Against |
|---|---|---|
| Read the files | No core dependency | Stale snapshots, wrong for coordination topologies, reads core's protected `kitty-specs/` layout |
| Run the CLI at build time | Authoritative | Breaks ADR-0042: no Spec Kitty runtime dependency at build time |
| **Read an export** (recommended) | Authoritative; doc-kitty runs no Spec Kitty code | Needs core to ship `spec-kitty mission export --json`; the consumer's CI runs it before the build |

Recommended: the export, read through one reader in `src/lib/missions/`, built as
the pack reader is: a vendored snapshot of core's mission-status contract and
its conformance fixtures, a lock file, and a facts-only page with a warning for
an unknown `schema_version` major. Until core ships the export, a file adapter
reads `meta.json` and `status.json` and labels every page "snapshot, unverified".

```ts
interface MissionModel {
  missionId: string; slug: string; mid8?: string; number?: number;
  name: string; type: string; purposeTldr?: string; createdAt: string;
  topology?: string; targetBranch?: string; phase: string;
  progress: { byState: Record<string, number> };
  wps: { id: string; title: string; wpState: string; lastTransitionAt?: string; dependsOn: string[] }[];
  docs: { spec?: string; plan?: string; tasks?: string; research?: string; dataModel?: string };
  issues: { ref: string; verdict?: string }[]; prs: string[]; ops: OpRef[];
  source: 'export' | 'files'; asOf: { commit: string; eventId?: string };
  problems: { severity: 'warning'; code: string; message: string }[];
}
interface OpModel {          // request_text is deliberately absent
  opId: string; profileId: string; action: string; actor: string;
  outcome?: string; startedAt: string; completedAt?: string;
  missionId?: string; wpId?: string; artifacts: { kind: string; ref: string }[];
}
```

### Page tree

- `/missions/<mission_slug>/`, one page per mission. The slug is the directory
  name, as packs use theirs. The ULID is shown on the page, and
  `/missions/id/<ULID>/` redirects to the slug.
- Work packages are anchored rows on the mission page (id, title, WP-state
  badge, dependencies), not pages of their own.
- The spec and the plan are long, so they are sub-pages:
  `/missions/<slug>/spec/` and `/missions/<slug>/plan/`.
- The page shows a facts block (type, phase, progress, topology, branch, "as of"),
  the WP table, linked issues and PRs, and a panel of its Ops.
- **Ops get no page each.** Most are thin and unlinked. They appear in the
  mission's panel and in one ledger page per month (`/ops/2026-11/`), about 30
  pages in place of about 3,900, with a JSON file per month for agents. A page
  per Op stays possible behind `ops.pages: true`.
- `/missions/` is the status hub, with the listing below.

### The sidebar child cap

A generic toolkit feature, not specific to missions:

- The cap resolves from most specific to least: hub frontmatter
  `sidebar_child_cap`, then `sidebar.childCap` on the section in `sections.yaml`,
  then `sidebar.childCap` in site config (default 50).
- `shapeSidebar` enforces it, the one seam every page passes through. No new
  carrier is needed (ADR-0063).
- A group over the cap keeps its index link and one entry, "835 missions", that
  links to the hub. On a capped child page that entry is marked current, so the
  reader still sees where they are.
- Generated producers also mark children above the cap `sidebar.hidden`, so
  Starlight drops them before it builds the tree and the build cost stays
  bounded too.
- Prev/next links follow the hub's listing order.

### Listing a large hub

| Option | For | Against |
|---|---|---|
| Static paging only | Accessible, crawlable, works without scripts | Filters multiply pages |
| Infinite scroll only | Smooth | Fails WCAG 2.2 AA in practice (footer trap, lost focus), unreachable without scripts |
| **Hybrid** (recommended) | Works without scripts; filters with them | Most code |

The hybrid:

- The hub server-renders the first 50 children. `/missions/page/2/` onwards are
  static pages in the Starlight frame, linked by a `nav` labelled "Pagination".
- With scripts, a build-time `index.json` (in bounded chunks) upgrades the hub: a
  "Load 50 more" button (never auto-scroll) with an `aria-live` count, sort
  controls, status and type filters and a text filter. Filter and sort state go
  into the query string.
- A static page per WP state or phase (`/missions/status/in-progress/`), since
  there are few.
- Every child stays in the sitemap. Paged hub URLs are self-canonical and stay
  out of it.
- Agents reach every page through the agent API. `llms.txt` lists the hub and its
  `index.json`, not 835 lines: a new `llms: summary` mode for `feeds`.
- Search uses the existing index with filters on section, state and type.
- Core's card grid (`hub_layout: cards`) is a presentation over the same listing
  data.

### Scale and publication

- Missions feed the sitemap, the agent API and `llms.txt` in summary mode. Ops
  feed the agent API only. Neither feeds RSS. The per-section `feeds` filter
  already exists.
- Ops are capped by config: `ops.include: linked | recent | all`, with
  `ops.recent: 90d`.
- The generator stamp's `content_hash` keeps unchanged missions unchanged on
  disk. An export cursor (`last_event_id`) lets a build skip them entirely.
- Publication is decided in the generator, never by `doc_status`.
  `missions.publish: { include, exclude, states, bodies }` chooses what is
  emitted. `research/`, `decisions/`, `reviews/`, WP notes and analysis reports
  stay out unless allowed. A `--check` leak gate fails a page that carries a
  denied file class.
- This is the generated-surface gating that ADR-0006's projection pipeline left
  open, and it needs its own ADR.

## Risks

- **No export yet.** The file adapter is what runs until core ships one. It is
  wrong for in-flight coordination missions; the "unverified" label mitigates it
  but does not fix it.
- **Format churn.** Most snapshots carry no schema version.
- **Build time.** 835 mission pages with sub-pages roughly double core's page
  count. The large-hubs slice must measure it.
- **Paged routes** sit outside the docs collection, so the gates and the agent
  surfaces must account for them.
- **Coupling.** Producers that hide children need the resolved cap.
- **Ops have no stable URL each** in the default configuration.
- **Privacy.** Mission bodies and Op prompts can carry operator names, internal
  links and chatter. The publication allow-list and the leak gate are the
  defence; a reviewer still has to set the allow-list sensibly.

## Asks for core

- `spec-kitty mission export --json`: every mission's overview and detail, with a
  cursor, runnable in CI.
- A published release of the mission-status contract and its conformance
  fixtures.
- A structured `mission_id` and `wp_id` on every Op that belongs to a mission.
- A declared field that marks a mission private.
