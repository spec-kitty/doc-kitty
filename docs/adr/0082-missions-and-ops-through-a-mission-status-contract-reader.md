---
title: "ADR-0082: Missions and Ops as generated pages, read through a mission-status contract reader"
description: doc-kitty renders missions and Ops as generated pages, read as a consumer of core's mission-status contract, published by allow-list and guarded by a leak gate.
doc_status: active
updated: 2026-11-23T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - architecture/research/missions-and-ops
  - architecture/research/mission-status-portal
  - plans/features/mission-status-portal
  - plans/features/large-hubs
  - adr/0006-direct-render-default-projection-deferred
  - adr/0042-native-documentation-charter
  - adr/0046-gherkin-feature-pages
  - adr/0079-kitty-packs-through-a-charter-contract-reader
  - adr/0083-producer-registry-and-ownership-scopes
---

# ADR-0082: Missions and Ops as generated pages, read through a mission-status contract reader

## Status

**Accepted** — 2026-11-23, by the operator, with the decisions as proposed (proposed 2026-11-22). It is the record that #346 asks for, under epic #345. The
research is [Missions and Ops as generated pages](../architecture/research/missions-and-ops.md),
and the plan is [Missions and Ops pages](../plans/features/mission-status-portal.md),
slice 1. It follows the shape of
[ADR-0079](0079-kitty-packs-through-a-charter-contract-reader.md) and reuses the
producer registry that #330 built and
[ADR-0083](0083-producer-registry-and-ownership-scopes.md) records. It completes
[ADR-0006](0006-direct-render-default-projection-deferred.md) for generated
surfaces (D7). #347, #348 and #349 implement it, in that order.

## Context

A kittified repository keeps its Spec Kitty **missions** in `kitty-specs/` and
its **Ops** in `kitty-ops/`. Core moved its docs to doc-kitty and dropped the
DocFX mission dashboards (spec-kitty/spec-kitty#6941), so nothing renders that
status any more. Core's scale shapes the design: 835 missions (271 MB) and about
3,900 Ops, with about 1,000 new Ops a week.

Core owns the status. `status.events.jsonl` is the authority, and `status.json`
is a snapshot that core's reducer derives from it. Some missions use a
coordination topology, and their live status can sit on another branch, so a
read of the checkout misreports them while they are in flight. Core's ADR
2026-10-01-2 defines a **Mission Status Read API**, with an overview of many
missions, a detail view of one mission, and canonical conformance fixtures. It
is core's public contract for mission status. No command lists or exports every
mission yet.

An Op record holds the verbatim operator prompt (`request_text`). That prompt
must never be published. Only 7 Ops carry a structured `mission_id`. Mission
bodies (`research.md`, `decisions/`, `reviews/`) can hold operator names,
internal links and working chatter. `DK_PUBLISH_DRAFTS` is on by default, so
`doc_status: draft` keeps nothing private.

ADR-0079 solved the same problem for packs: one reader over a vendored snapshot
of a producer's contract, a domain model, generated pages owned through a
producer registry, and a `--check` drift gate. This ADR applies that pattern to
missions and Ops, and adds what packs do not need: a source that core does not
fully publish yet, and content that must not leak.

## Decision

### D1. Core is the producer and doc-kitty is a consumer of its public contract

The Mission Status Read API is the producer. doc-kitty consumes it across its
public contract boundary, the way it consumes the charter's packs contract.

- doc-kitty reads the contract's **published shapes**: the overview and detail
  records, their schemas, and the conformance fixtures. It does not read,
  import, run or mirror core's CLI internals: no `specify_cli` module, no reducer
  logic, and no undocumented file layout taken as a contract.
- doc-kitty runs no Spec Kitty code at build time (ADR-0042). The consumer's CI
  produces any export (D3) **before** the build, and the build reads files only.
- Where the contract does not cover something doc-kitty needs, doc-kitty asks
  core to publish it (see [Consumer asks](#consumer-asks-for-core)). It does not
  derive the data from core's private state.

### D2. One reader in `src/lib/missions/`, pinned to a vendored contract snapshot

A **mission reader** (`src/lib/missions/`) is the only code that knows how core
shapes mission status. It is an anti-corruption layer: it turns the source into
`MissionModel` and `OpModel` (D4), and nothing downstream reads core's files or
records.

It is built as the pack reader is (ADR-0079 D1):

- `src/lib/missions/contract/` holds a vendored snapshot of core's
  `contracts/mission-status/`: the schemas the reader uses and the canonical
  conformance fixtures. `contract.lock.json` records the source and a sha256 for
  each file. Unit tests fail when the bytes and the lock disagree, and they run
  every conformance fixture through the reader.
- A maintainer script (`pnpm missions:sync-contract`) refreshes the snapshot.
  The snapshot is pinned to a core commit until core publishes versioned
  contract releases (spec-kitty/spec-kitty#7627). After that it is pinned to a
  release tag, as #330 pins the packs contract to `contract-packs-v0.1.0-rc.1`.
- `missions.contract` points at another snapshot directory in the same layout,
  so a consumer can render with the contract it pins without waiting for a
  doc-kitty release. The build checks that snapshot's lock as it checks the
  vendored one.
- The reader is tolerant. An unknown `schema_version` major, an unknown key or an
  unknown WP state is a warning, and the mission gets a facts-only model. It
  never fails the build. The build never fetches a contract. One exception
  fails closed: when core ships the not-for-publication declaration (D7) and the
  reader cannot read it (an unknown major, or a missing field), the mission
  emits nothing and gets a `[dk-missions]` warning.
- doc-kitty renders and core judges. The reader does not validate a mission
  against core's rules (ADR-0079 D3).

### D3. Two adapters behind the reader: an authoritative export, and a labelled file fallback

The reader has two adapters behind the same model. `MissionModel.source` records
which one produced it, and every page shows the source.

1. **Export adapter (authoritative).** It reads a JSON file of overview and
   detail records, in the contract's shapes, that core's batch export verb on
   the Mission Status Read API writes (spec-kitty/spec-kitty#7627). The
   consumer's CI runs the export, and the site config names the file. The export
   is the only adapter that is correct for coordination-topology missions. Its
   cursor (`last_event_id`) is recorded as `asOf`, so a build can skip missions
   that have not changed.
2. **File adapter (fallback, "snapshot, unverified").** Until core ships the
   export, the adapter reads each mission's committed `meta.json` and
   `status.json` and the Op records in `kitty-ops/`. It takes the fields **as
   written** and maps them by the field names in the contract's schemas. It does
   not replay `status.events.jsonl` and does not reimplement core's reducer:
   rederiving status would make doc-kitty a second implementation of a core
   internal. Every page it produces is labelled "snapshot, unverified". A
   coordination-topology mission also gets a warning that the checkout may lag
   its live status. A `status.json` with no `schema_version` is read as the
   oldest shape the snapshot covers, with a warning.

When both are configured, the export wins and the file adapter does not run.
Removing the file adapter after the export lands is a later decision. This ADR
does not deprecate it.

### D4. `MissionModel` and `OpModel`, doc-kitty's view

```ts
interface MissionModel {
  missionId: string;                 // ULID
  slug: string;                      // the mission directory name; the URL slug (D5)
  mid8?: string; number?: number;
  name: string; type: string; purposeTldr?: string;
  createdAt: string; mergedAt?: string; acceptedAt?: string;
  topology?: string; targetBranch?: string;
  phase: string;                     // core's status phase, as published
  progress: { byWpState: Record<string, number> };
  wps: {
    id: string; title: string;
    wpState: string;                 // planned | claimed | in_progress | for_review | in_review |
                                     // approved | done | blocked | canceled, or a newer value (warned)
    lastTransitionAt?: string;
    dependsOn: string[];
  }[];
  executionLanes?: { id: string; wps: string[] }[];  // worktree parallelism; never merged into wpState
  docs: { spec?: string; plan?: string; tasks?: string };  // paths, read only if published (D7)
  issues: { ref: string; verdict?: string }[];
  prs: string[];
  ops: string[];                     // opIds linked by a structured mission_id (D6)
  publication: { declaredPrivate?: boolean };  // core's declared field (spec-kitty/spec-kitty#7629)
  source: 'export' | 'files';
  asOf: { commit: string; eventId?: string };
  contract: { readWith: string };    // the snapshot's pin (D2)
  problems: { severity: 'warning'; code: string; message: string }[];
}

interface OpModel {                  // request_text is absent by construction
  opId: string; profileId: string; action: string; actor: string;
  outcome?: 'done' | 'failed' | 'abandoned' | string;
  startedAt: string; completedAt?: string;
  missionId?: string; wpId?: string; // structured links only (spec-kitty/spec-kitty#7628)
  artifacts: { kind: string; ref: string }[];
}
```

Two rules hold by construction:

- **WP state is not an execution lane.** Core calls both a "lane". The model
  names the work package's state `wpState` and keeps `lanes.json` as
  `executionLanes`. Pages and the agent API use "WP state" for the first.
- **`request_text` is absent.** The Op adapter reads each record through an
  allow-list of the `OpModel` fields. `request_text`, `governance_context_hash`
  and `model_id` are never copied into the model, so no template can render
  them. Free-text inference of mission links from the prompt is ruled out for
  the same reason.

### D5. The page tree

- `/missions/` is the status hub. It lists every published mission through the
  paged listing and sidebar child cap of [Large hubs](../plans/features/large-hubs.md)
  (#340: #341 and #342). This ADR does not decide the listing.
- `/missions/<slug>/` is one page per mission. The slug is the mission directory
  name, as packs use theirs (ADR-0079 D6). The page has a facts block (type,
  phase, progress by WP state, topology, branch, source and "as of"), the WP
  table with one anchored row per work package, linked issues and PRs, and a
  panel of linked Ops.
- `/missions/<slug>/spec/` and `/missions/<slug>/plan/` are sub-pages, emitted
  only when publication allows the body (D7).
- `/missions/id/<ULID>/` redirects to the slug page through a flat stub, as
  [ADR-0071](0071-legacy-html-redirects-as-flat-stubs.md) does, so the ULID is a
  stable address when a slug changes.
- Work packages get no page of their own.
- `/ops/<YYYY-MM>/` is one Op ledger page per month, with a JSON file per month
  for agents. **Ops get no page each** by default: about 30 ledger pages in place
  of about 3,900. `ops.pages: true` turns per-Op pages on later. `ops.include:
  linked | recent | all` and `ops.recent` (default `90d`) bound the ledger.
- Missions feed the sitemap, the agent API and `llms.txt` in summary mode. Ops
  feed the agent API only. Neither feeds RSS.

### D6. Owned through the producer registry from #330

This ADR adds two entries to the producer registry that #330 builds
(ADR-0083). It adds no registry and no ownership mechanism of its own:

| Producer | Stamp `by` | Ownership scope |
|---|---|---|
| Missions | `doc-kitty-missions/<version>` | the whole `missions` section |
| Op ledger | `doc-kitty-ops/<version>` | the whole `ops` section |

Both are ownership producers with a `section` scope that names its section
(`missions` or `ops`). A page is recognised as generated by its stamp **and** its
scope, never by its stamp alone (ADR-0079 D6, ADR-0083 decision 4). The
generator prunes only pages it stamped and fails when an authored file sits
inside a section it owns. Pages carry the generated-page
stamp that the registry recognises. If #359 settles a wider generated-section
contract (`source_digest`, masked `at`), these producers adopt it with the
others.

`dockitty-generate-mission-pages --check` fails on drift and on a leak (D8).
`dockitty-read-mission <slug> --json` prints one `MissionModel` for debugging.
The `missions` and `ops` sections join the build-generated section ids, so a
first build without generated pages does not warn about them.

### D7. Publication by allow-list, decided in the generator, never by `doc_status`

What reaches the site is decided when the pages are generated, from an explicit
allow-list. `doc_status` decides nothing.

```ts
defineDocKittyIntegrations({
  missions: {
    export: 'build/mission-status.json',  // export adapter (D3); omit to use the file adapter
    specsDir: '../kitty-specs',           // file adapter
    opsDir: '../kitty-ops',
    contract: undefined,                  // optional snapshot directory (D2)
    publish: {
      include: ['*'], exclude: [],        // mission slugs
      states: ['*'],                      // status phases to emit; others emit nothing
      bodies: ['spec', 'plan'],           // file classes whose body may be published
    },
  },
  ops: { include: 'linked', recent: '90d', pages: false },
});
```

The block above is an example, not the defaults. The defaults are
`include: []`, `exclude: []`, `states: ['*']` and `bodies: []`, so a site that
configures `missions` but no `publish` publishes nothing until it names
missions.

- A mission outside the allow-list emits **nothing**: no page, no hub row, no
  redirect, no agent-API entry and no Op link.
- A mission that core declares not for publication (spec-kitty/spec-kitty#7629)
  emits nothing, **even when the allow-list includes it**. A denial always wins.
- Only the file classes in `bodies` are ever read into a page. `research.md`,
  `decisions/`, `reviews/`, WP notes, analysis reports, checklists and traces
  are denied unless a site allows them by name. The default `bodies` is empty:
  facts and the WP table only.
- Config is validated eagerly. An error is build-fatal with a `[dk-missions]`
  prefix.

**This completes ADR-0006 for generated surfaces.** ADR-0006 deferred the
projection pipeline that would publish a filtered subset of a private tree.
Generated sections do not need that pipeline: the generator is already a
projection, so it filters as it writes. Authored pages stay direct render, as
ADR-0006 decided. A generated section that reads private sources applies this
rule: an allow-list in the generator, never `doc_status`, and a leak gate.

### D8. A leak gate in `--check`

`dockitty-generate-mission-pages --check` fails when:

- a generated page or JSON file holds content from a denied file class (D7). The
  generator records on each page the file classes it drew from, and the gate
  compares them with the allow-list. That field extends the generated-page
  stamp and is settled with #359's generated-section contract;
- a page or record exists for a mission that the allow-list or core's private
  declaration excludes;
- any output contains an Op's `request_text`. The gate reads the source records
  to compare, and it is the only code that reads that field. Nothing it reads
  reaches the model or a page.

The gate runs in CI before deploy. Fixture tests also prove that no fixture
prompt string appears in any built output (#349).

## Versioning and pinning

| What | Pinned by | Moves when |
|---|---|---|
| Core's mission-status contract | doc-kitty's vendored snapshot and `contract.lock.json`: a core commit, then a contract release tag (spec-kitty/spec-kitty#7627). `missions.contract` overrides it | A doc-kitty release refreshes it, or a site points at a newer snapshot |
| The export | Its own `schema_version` and cursor, written by the consumer's pinned core | The consumer upgrades core. An unknown major is a warning and facts-only pages |
| The file-adapter sources | The consumer's checkout | Each build. Pages are labelled "snapshot, unverified" |
| doc-kitty | The consumer's exact `@spec-kitty/doc-toolkit` version, or a git commit | The consumer upgrades |

## Consumer asks for core

These were filed in spec-kitty core on 2026-11-13 with the operator's approval.
There is no fourth ask for an Op-record shape: the operator ruled it out on
2026-11-23, and the gap stays a recorded risk.
They are asks from a consumer to the producer of the contract, not
dependencies on core internals. The reader works without each one through the
fallback named here.

| Ask | Needed by | Until it lands |
|---|---|---|
| spec-kitty/spec-kitty#7627: a batch export verb on the Mission Status Read API (every mission's overview and detail, with a cursor) and a versioned release of the contract and its fixtures. Under core epic #5528 | #347: the export adapter (D3) and the release pin (D2) | The file adapter, labelled "snapshot, unverified". The snapshot is pinned to a core commit |
| spec-kitty/spec-kitty#7628: a structured `mission_id` and `wp_id` on every Op that belongs to a mission | #349: per-mission Op panels (D5) | Only Ops that already carry a structured `mission_id` are linked. Others appear in the monthly ledger only. Links are never inferred from prompt text |
| spec-kitty/spec-kitty#7629: a declared field that marks a mission not for publication | #348: the publication rules (D7) | The site's `missions.publish` allow-list alone decides |

## Consequences

### Positive

- Core gets back its mission dashboards, without DocFX, and every kittified
  repository gets them too.
- One seam adapts to core's format. A contract change means a snapshot refresh
  and reader changes, not a sweep of templates.
- The boundary is explicit. doc-kitty depends on core's published contract, so
  changes inside core's CLI cannot break a docsite.
- Op prompts cannot leak through the model, and the leak gate checks the output
  as well.
- The producer registry gains two more ownership producers without any change
  to how ownership works.

### Negative

- Until #7627 lands, pages come from committed snapshots that can be stale, and
  coordination-topology missions can be wrong. The label says so, but the data
  stays wrong.
- doc-kitty must track core's contract and cut a release when a consumer needs a
  newer one, or the consumer supplies a snapshot.
- 835 mission pages with sub-pages roughly double core's page count. The
  large-hubs work must measure the build time.
- A site has to set its allow-list with care. The default publishes facts only.

### Risks

- **Op records are not covered by a contract yet.** The Mission Status Read API
  covers missions. The file adapter reads Op records through a field allow-list
  and labels them unverified. Core gets no further consumer ask for an Op-record
  shape (operator ruling, 2026-11-23). Until core publishes one, the Op ledger
  (#349) is a file-adapter feature only.
- **Format churn.** 569 of core's `status.json` snapshots carry no
  `schema_version`. Warnings, facts-only models and the conformance fixtures
  limit the impact.
- **Privacy.** Allowed bodies can still carry names or internal links. The
  allow-list and the gate are the defence. Reviewing the allow-list stays a
  human job.

## Alternatives considered

### Run the CLI at build time

`spec-kitty agent tasks status --json` and `orchestrator-api mission-state` are
authoritative. Rejected: they break ADR-0042, need a Spec Kitty runtime in every
docs build, and read one mission per call.

### Read core's files and replay the event log

Replaying `status.events.jsonl` gives fresher state than `status.json`.
Rejected: it reimplements core's reducer, which is an internal and not a
contract. That is the coupling D1 rules out. The file adapter reads snapshots as
written and labels them.

### Read files only, with no export adapter

It needs nothing from core. Rejected: it is wrong for coordination-topology
missions, and it binds doc-kitty to a layout that core does not publish as a
contract.

### Gate publication on `doc_status` or a frontmatter flag

Rejected: drafts ship by default (`DK_PUBLISH_DRAFTS`), and mission files are
not doc-kitty pages with frontmatter it controls. An allow-list in the generator
fails closed.

### A page per Op

Rejected as the default: about 3,900 thin, mostly unlinked pages that grow by
about 1,000 a week. It stays available behind `ops.pages: true`.

### A page per work package

Rejected: work packages are short, and anchored rows on the mission page keep
the page count bounded.

### Slug from the ULID

A stable identifier, but not readable. Rejected for the directory slug, with
the ULID redirect giving a stable address.

## References

- doc-kitty: epic #345; #346 (this record), #347, #348, #349; packs epic #328
  and #330 (reader and producer registry, ADR-0083); large hubs #340, #341, #342; #359
  (generated-section contract)
- spec-kitty core: ADR 2026-10-01-2 (Mission Status Read API),
  `contracts/mission-status/`, #5528, #6941, #7627, #7628, #7629
- doc-kitty code: `src/lib/generator-stamp.mjs`,
  `src/scripts/validate-frontmatter.mjs`, `src/lib/hub-children.mjs`,
  `src/lib/route-shaping.ts`
