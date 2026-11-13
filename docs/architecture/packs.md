---
title: Kitty packs
description: "The target design for kitty-packs support: bounded contexts, the pack reader and its contract snapshot, generation, ownership, gates and the slices."
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: Architecture
kind: Explanation
tags: [packs, doctrine, generated-pages, charter, open-packs]
related:
  - adr/0079-kitty-packs-through-a-charter-contract-reader
  - architecture/research/packs
  - plans/features/packs
  - adr/0046-gherkin-feature-pages
  - adr/0042-native-documentation-charter
  - architecture/gherkin-pages
---

# Kitty packs

> **Target design.** This page describes the envisioned shape of kitty-packs
> support, as decided in
> [ADR-0079](../adr/0079-kitty-packs-through-a-charter-contract-reader.md).
> Nothing on it is implemented yet. Where this page and the ADR differ, the ADR
> is authoritative. The findings behind it are in the
> [research](./research/packs.md), and the delivery order is in the
> [feature plan](../plans/features/packs.md).

A site lists its pack directories in config. doc-kitty reads each pack through one
adapter pinned to a snapshot of the charter's packs contract. It then writes one
generated page per pack into the docs tree. From there the pages are ordinary
collection files, as Gherkin feature pages are.

Audience: contributors who will build `src/lib/packs/`, and maintainers of a packs
repository who want to know what the option will do to their tree.

## Bounded contexts

Four repositories touch packs. Each is its own bounded context with its own
vocabulary. doc-kitty meets the others at one seam: the pack reader.

```mermaid
flowchart LR
  subgraph charter["spec-kitty-charter (format and verdict)"]
    FK["contracts/packs/file-kinds.yaml<br/>schemas, classifier conformance cases"]
    SVC["charter service<br/>verdict on a pack"]
  end
  subgraph openpacks["spec-kitty-open-packs (content)"]
    PK["packs/DIR/<br/>pack.yaml, README.md, manifest, artefacts"]
    LOCK["charter.lock.yaml"]
    CI["open-packs CI"]
  end
  subgraph core["spec-kitty core (runtime)"]
    RT["tier resolution and activation"]
  end
  subgraph dk["doc-kitty (rendering)"]
    ACL["pack reader<br/>(anti-corruption layer)"]
    SITE["generated pages and surfaces"]
  end
  FK -- "vendored snapshot" --> ACL
  PK -- "files on disk" --> ACL
  LOCK -- "packs.charterLock" --> ACL
  CI -- "asks" --> SVC
  CI -- "proves" --> PK
  RT -- "reads" --> PK
  ACL --> SITE
```

| Context | Owns | Relation to doc-kitty |
|---|---|---|
| spec-kitty-charter | The pack format and the verdict on a pack | Upstream. doc-kitty conforms to its contract through a vendored snapshot |
| spec-kitty-open-packs | Pack content, its CI gates and its digest sidecars | A consumer site, and the source of pack directories |
| spec-kitty core | Runtime resolution and activation | A future consumer site. It shares no code with doc-kitty |
| doc-kitty | Rendering a docs tree, its gates and agent surfaces | Downstream. It renders and never judges a pack |

The anti-corruption seam is deliberate (DIRECTIVE_031). Only the reader knows the
pack format. Everything after it works on `PackModel`, doc-kitty's own view of a
pack. The reader imports no Spec Kitty code and calls no service at build time
(ADR-0042). It reads files only.

## Components

```mermaid
flowchart TB
  subgraph packs["src/lib/packs/"]
    SNAP["contract/<br/>file-kinds.yaml, schemas,<br/>conformance cases"]
    CLOCK["contract.lock.json<br/>charter commit, sha256 per file"]
    READ["readPack(dir)<br/>classify, parse README,<br/>verify hashes"]
    FIELDS["per-kind field map"]
    MODEL["PackModel"]
    GEN["pack generator<br/>plan, write, prune, --check"]
  end
  CFG["packs option<br/>(defineDocKittyIntegrations)"]
  INT["packs integration<br/>astro:config:setup"]
  REG["producer registry<br/>(generator-stamp.mjs)"]
  GATES["gates<br/>frontmatter, links, Gherkin output scan"]
  SURF["agent surfaces<br/>sitemap, search, llms.txt, agent API, OKF export"]
  SNAP --> READ
  CLOCK -.->|"unit tests"| SNAP
  FIELDS --> READ
  CFG --> INT
  INT --> READ
  READ --> MODEL
  MODEL --> GEN
  GEN --> REG
  REG --> GATES
  GEN --> SURF
```

| Component | Role |
|---|---|
| Contract snapshot | `src/lib/packs/contract/` holds `file-kinds.yaml`, the schemas the reader uses, and the charter's classifier conformance cases, transcribed from its Java tests until spec-kitty-charter#559 publishes them. `pnpm packs:sync-contract --commit <sha>` refreshes `file-kinds.yaml` and the schemas. |
| Contract lock | `contract.lock.json` records the charter commit and each snapshot file's sha256. A unit test fails when the bytes and the lock disagree. |
| Pack reader | `readPack(dir)` turns a pack directory into a `PackModel`. It reimplements classification only and is held to the charter's conformance cases. It parses the README into the codec's shape with doc-kitty's own Markdown pipeline. It recomputes each manifest constituent's `content_hash`. |
| Per-kind field map | Which fields give an artefact its title and summary, such as a directive's `title` and `intent`. It lives beside the snapshot, not in page templates. |
| `PackModel` | Identity, document, manifest, presets, policy, inventory, problems and the two contract commits. The shape is in ADR-0079 D4. |
| Packs integration | Validates the `packs` option eagerly, runs the generator at `astro:config:setup` and watches pack files in dev. Errors carry a `[dk-packs]` prefix. |
| Pack generator | Plans the page tree, writes changed pages, prunes only its own stale pages, and backs `dockitty-generate-pack-pages --check`. |
| Producer registry | One list of producers, each with an ownership scope. It replaces `PRODUCERS` and `GHERKIN_PRODUCER` special cases in `src/lib/generator-stamp.mjs`, `isGeneratedPage` in `src/scripts/validate-frontmatter.mjs`, and the Gherkin output scan in `src/lib/gherkin/generate.mjs`. |
| Gates | The frontmatter gate and the links gate run on pack pages as on any page, through the registry. |
| Agent surfaces | The sitemap, search, `llms.txt`, the agent API and the OKF export list pack pages as ordinary entries. None of them gets packs-specific code. |

Slice 2 also adds a `dockitty-read-pack <dir> --json` CLI that prints the model.
It is a debugging aid and the first consumer of the reader.

## Build-time data flow

```mermaid
sequenceDiagram
  participant C as site config
  participant I as packs integration
  participant R as pack reader
  participant G as pack generator
  participant D as docsDir
  participant L as docs loader and gates
  participant S as surfaces
  C->>I: packs option (sources, section, charterLock, ...)
  I->>I: validate eagerly, resolve sources inside the repository root
  I->>R: each directory matching */pack.yaml
  R->>R: classify with the snapshot, parse README, recompute hashes
  R->>R: compare charterLock commit with the snapshot commit
  R-->>I: PackModel per pack, with warnings
  I->>G: models, section, indexBasename, extraFacts
  G->>G: synthesise frontmatter, facts block, relocate README links
  G->>G: stamp doc-kitty-packs with version and content_hash
  G->>D: write changed pages, prune own stale pages
  D->>L: glob loader reads pack pages with authored pages
  L->>S: sitemap, search, llms.txt, agent API, OKF export
```

The generator runs in `astro:config:setup`, the seam the Gherkin and glossary
generators use (ADR-0026). Astro's content-layer glob runs after every config
hook, so the pages are on disk before the collection is read. The bare-Node gates
walk files on disk, so they see the pages too.

Discovery is the contract's `*/pack.yaml` glob, relative to each source root.
Source roots resolve against the site root and must stay inside the repository
root after `realpath`. An escape is refused. A source with no pack fails unless
`allowEmpty` is set, so a checkout without its packs cannot prune every page.

The reader warns and never fails the build on pack content. It reports a file the
contract classifies as `retired` or does not classify, a manifest and directory
that disagree, an unknown key or `content_form`, and a README link that does not
resolve after relocation. An unknown key or descriptor major gets a facts-only
page. Configuration errors are the only fatal class, apart from the ownership
collisions below.

## Generated page tree and ownership

With `section: 'packs'` and the default index basename, a packs repository
renders like this:

```text
<docsDir>/packs/
  README.md                 authored section landing (or index.md)
  catalog-proposal.md       authored page, untouched
  built-in/README.md        generated, stamped doc-kitty-packs/<version>
  qa/README.md              generated; pack.yaml name is quality-assurance
  go/README.md              generated; no manifest, inventory from file-kinds
```

The file name is the site's first `indexBasename`, so each pack page collapses to
`/<section>/<dir>/`. The slug is the pack's directory name, never its `pack.yaml`
`name`. That keeps open-packs' current URLs, such as `/packs/qa/`.

Each page has synthesised frontmatter: `title` from the README H1 or the name,
`description` from the preamble's first sentence, `kind: Pack`,
`doc_status: active`, `updated` from the stamp, `sources:` naming the pack
directory, and the `generated` stamp. Frontmatter in the README is not copied.

The body is a facts block followed by the whole README. The facts block holds the
`pack_id`, version, level, parent, dependencies with their ranges, presets, locked
artefacts, the `manifest_hash` with its verified state, the inventory per kind
with its source, and the two contract commits. A dependency links to a pack of
the same build that holds its `pack_id`, else it shows the bare ULID.

README links are relocated. A link into the pack goes under `sourceUrlPrefix`
until artefact pages exist (slice 4), then to the artefact page. A link that
resolves into `docsDir` becomes a site link. Anything else becomes plain text with
a warning.

Ownership is per pack directory. This amends ADR-0046 decision 4, which assumed a
producer owns a whole section.

- The generator owns `<section>/<dir>/**` for every pack it renders.
- It prunes only pages that carry its stamp.
- An authored file inside an owned pack directory is fatal.
- A pack directory whose slug collides with an authored page is fatal.
- The section landing and other authored pages stay authored. The landing is a
  hub, and `selectHubChildren` in `src/lib/hub-children.mjs` lists the pack pages
  under it as one-level-down children.

Ownership is decided by stamp and scope together: a page is generated only when it
carries a producer's stamp and sits inside that producer's scope, so an authored
page cannot opt out of validation by claiming a stamp. The producer registry
records each producer's scope: a whole section for Gherkin, a set of directories
for packs, and the glossary's existing path rule (it already stamps its pages).
The `packs` section joins the build-generated section ids, so a first build
without pack pages does not warn.

## Contract pinning

Two commits matter, and each page shows both.

```mermaid
flowchart LR
  CH["charter repository<br/>at commit A"] -- "pnpm packs:sync-contract --commit A" --> SN["src/lib/packs/contract/<br/>+ contract.lock.json (A)"]
  SN -- "default" --> RD["pack reader<br/>readWith = A"]
  OV["packs.contract<br/>(consumer snapshot, commit C)"] -. "overrides" .-> RD
  CL["consumer charter.lock.yaml<br/>(commit B)"] -- "packs.charterLock" --> RD
  RD -- "B differs from A: warning" --> PG["pack page<br/>proven against B, read with A"]
```

- **Read with.** The commit of the snapshot the reader used. By default that is
  doc-kitty's vendored snapshot, moved only by a doc-kitty release.
- **Proven against.** The commit in the consumer's own pin file, named by
  `packs.charterLock`. open-packs proves its packs against that commit in CI.
- A mismatch is a warning. The page records both, so it never claims a contract
  silently.
- `packs.contract` points at another snapshot directory in the vendored layout,
  with its own `contract.lock.json`. The build checks that lock too. A consumer
  can render with the contract it pins without waiting for a doc-kitty release.
- `packs.charterLock` reads the `commit` key of the consumer's pin file.
- doc-kitty never fetches a contract at build time.

A pinned charter contract release replaces the commit once the charter publishes
releases (charter #45).

## Extension points

- **`extraFacts`.** An optional list of `{ label, file, key }` rows in the
  `packs` option. Each row reads one YAML key from a file beside the pack, such
  as `{dir}.source.yaml`, so open-packs can show its own tree digest. The rows are
  plain data, so the bare-Node `--check` CLI reads the same option as the build. A
  missing file or key is a warning and an empty cell. doc-kitty computes no digest
  of its own.
- **`PackModel` growth.** Later slices add artefact titles and summaries, DRG
  edges and the active charter to the model. None adds a second reader.
- **A charter-service adapter.** A later adapter could fill the same `PackModel`
  from the charter service or a whole-pack export (charter #543). It is an option
  in slice 7, not part of the design today.
- **Git and bundle sources.** Slice 7 adds sources pinned to a tag or commit, and
  a `bundle` input. They feed the same reader.
- **Vocabulary.** `Pack` and the later artefact kinds are appended to the open
  `KINDS` vocabulary, so a consumer can override them (ADR-0031, ADR-0065).

## Slices

Each slice is a child issue of epic #328. Slice 1, the ADR itself (#329), was
accepted on 2026-11-13 and is done when PR #337 merges.

| Slice | Issue | Builds |
|---|---|---|
| 2 | #330 | The reader, the contract snapshot and lock, `pnpm packs:sync-contract`, `packs.charterLock` and `packs.contract`, the producer registry, and `dockitty-read-pack` |
| 3 | #338 | The `packs` option, the `doc-kitty-packs` producer, the integration, the generator and its `--check` CLI, ownership per pack directory, the facts block, the whole README and relocated links. Parity with open-packs' `gen_pack_reference.py` |
| 4 | #339 | Kind hubs and artefact pages at `/<section>/<dir>/<kind>/<id>/`, the raw YAML beside each page, and README links resolved to artefact pages |
| 5 | #331 | DRG cross-links and backlinks, and pack dependants on the pack page |
| 6 | #332 | The active charter hub from `.kittify/charter/charter.yaml` and `.kittify/config.yaml` |
| 7 | #333 | Git and bundle sources, offline mode, a cache, and a site-level publication allow |
| 8 | #334 | The remaining kinds, search weighting, `llms.txt` grouping and rename aliases |
| 9 | #335 | Several versions of a pack with a version switcher |

Slice 3 is the point where open-packs can switch. Slices 4 and 6 can run in
parallel after 3. Slice 5 builds on 4, and slices 7 to 9 follow.

## Not yet built

All of it. Today doc-kitty has no `src/lib/packs/`, no `packs` option, no
`doc-kitty-packs` producer and no producer registry. `PRODUCERS` in
`src/lib/generator-stamp.mjs` still lists only the Gherkin and glossary
producers. `isGeneratedPage` still recognises Gherkin by stamp and the glossary
by path. The seams this design reuses do exist: the stamp, the
`astro:config:setup` generation seam, hub child selection, and the open kind
vocabulary.

Outside doc-kitty, open-packs still runs `gen_pack_reference.py`. Its org packs
have no `pack-manifest.yaml`, and `built-in`'s manifest is stale. Until those are
regenerated, their pages will show no hash or an unverified one.
