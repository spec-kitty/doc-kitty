---
title: "ADR-0079: Kitty packs as generated pages, read through a charter-contract reader"
description: doc-kitty renders packs as generated pages through one adapter pinned to a snapshot of the charter contract, and leaves the verdict to the charter.
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - architecture/research/packs
  - plans/features/packs
  - adr/0042-native-documentation-charter
  - adr/0046-gherkin-feature-pages
  - adr/0067-schematic-pages-reference-a-schema
---

# ADR-0079: Kitty packs as generated pages, read through a charter-contract reader

## Status

**Proposed** — 2026-11-13. Epic #328; it is the record #329 asks for. The research
is [Kitty packs in doc-kitty](../architecture/research/packs.md).

## Context

Spec Kitty packs are directories of doctrine: `pack.yaml`, a `README.md` that is
the pack document (since open-packs #248), a derived `pack-manifest.yaml`,
presets, `policy.yaml`, graph files and one folder per artefact kind. Three
repositories already handle them, each in its own way:

- **spec-kitty-charter** owns the format. `contracts/packs/file-kinds.yaml`
  classifies every file, JSON Schemas define each shape, a Markdown codec reads
  the README (`pack-document`: optional frontmatter, optional H1, preamble, H2
  sections), and the charter service gives the verdict on a pack.
- **spec-kitty-open-packs** holds the content, proves it in CI against the charter
  service, and renders a docsite with doc-kitty. Its Python
  `gen_pack_reference.py` writes one reference page per pack, from a layout that
  is still being aligned with the charter's contract.
- **spec-kitty** core resolves and activates packs at runtime. It never reads the
  README and emits no whole-pack export.

Core and the charter now build their docs with doc-kitty too (core epic #6100
replaced DocFX). Pack rendering written once in doc-kitty therefore serves every
site in the product line. Writing it means choosing which model of a pack
doc-kitty reads, who validates a pack, and how doc-kitty keeps up with a format
that is still changing.

The earlier draft of this feature (PR #336) predates #248: it read a `pack.md`,
an `org-charter.yaml` and a per-pack stub page. This ADR supersedes that draft.

## Decision

### D1. doc-kitty reads packs through one adapter, pinned to the charter's contract

A **pack reader** (`src/lib/packs/`) is the only code that knows the pack format.
It is an anti-corruption layer: it turns a pack directory into doc-kitty's own
`PackModel`, and nothing downstream reads pack files.

The reader classifies files with the charter's `file-kinds.yaml`, never with a
hard-coded layout. It does not follow open-packs' current tree: where a pack and
the contract disagree (for example, an org pack with no `pack-manifest.yaml`), the
contract wins and the reader reports the gap.

doc-kitty **vendors a snapshot** of the contract files it reads:
`src/lib/packs/contract/` holds `file-kinds.yaml` and the schemas it uses, with a
`contract.lock.json` recording the charter commit and each file's sha256. A unit
test fails when the bytes and the lock disagree. A maintainer script
(`pnpm packs:sync-contract --commit <sha>`) refreshes the snapshot. A pinned
charter **release** replaces the commit once the charter publishes contract
releases (charter #45).

The reader reads files only. It imports no Spec Kitty code and calls no service at
build time (ADR-0042).

### D2. doc-kitty renders; the charter judges

doc-kitty does **not** validate a pack or its README against the codec. The
verdict stays with the charter service and the CI that runs it.

The reader is tolerant. It parses the README into the codec's shape
(frontmatter, title, preamble, sections) with doc-kitty's own Markdown pipeline.
It reports, as warnings, only what rendering needs to know:

- a file the contract classifies as `retired`, or does not classify at all;
- a constituent the manifest lists but the directory lacks, or the reverse;
- a README link that does not resolve after relocation (D5).

A pack the charter would refuse still renders. A refused pack fails open-packs CI
before it is ever published, so doc-kitty does not repeat that gate.

### D3. `PackModel`, doc-kitty's view of a pack

```ts
interface PackModel {
  dir: string;                       // the pack directory, project-relative
  identity: {                        // pack.yaml (pack-descriptor)
    packId: string;                  // ULID, the runtime identity
    name: string;
    version?: string;
    level?: 'built-in' | 'org' | 'project' | string;
    parent?: string | null;          // pack_id
    dependsOn: { packId: string; range?: string }[];
    schemaVersion?: string;
  };
  document?: {                       // README.md (pack-document)
    title?: string; preamble: string;
    sections: { title: string; content: string }[];
  };
  manifest?: {                       // pack-manifest.yaml
    hash: string;                    // manifest_hash
    constituents: { kind: string; id: string; path: string; contentHash: string }[];
  };
  presets: { name: string; path: string }[];
  policy?: Record<string, string>;   // policy.yaml artifacts, e.g. locked
  inventory: { kind: string; ids: string[] }[];  // from the manifest, else a file-kinds walk
  problems: { severity: 'warning'; code: string; file?: string; message: string }[];
  contract: { charterCommit: string };          // the snapshot it was read with
}
```

Artefact titles and summaries, DRG edges and the active charter extend this
model in later slices. The per-kind field map (a directive's `title` and
`intent`, a tactic's `name` and `purpose`, an agent profile's kebab-case keys)
lives in the reader beside the contract snapshot, not in page templates.

### D4. Packs are declared in site config and discovered by the contract's glob

```ts
defineDocKittyIntegrations({
  packs: {
    sources: ['../packs'],          // roots that hold */pack.yaml, project-relative
    section: 'packs',               // where the pages go in docsDir
    include: ['*'], exclude: [],    // pack names
    sourceUrlPrefix: 'https://github.com/spec-kitty/spec-kitty-open-packs/blob/main/packs/',
    contract: undefined,            // optional path to a newer contract snapshot
  },
});
```

A pack is a directory under a source root that holds a `pack.yaml`: the
contract's `*/pack.yaml` glob, relative to the root. Paths resolve inside the
project after `realpath`, and an escape is refused. The config is validated
eagerly, and an error is build-fatal with a `[dk-packs]` prefix, as the Gherkin
option is.

The per-pack stub page of the earlier draft is dropped. The README is now the
pack's introduction, so a stub would duplicate it, and a packs repository with 19
packs would keep 19 stubs in step by hand.

### D5. A generated page per pack, owned per pack directory

The generator writes `<docsDir>/<section>/<name>/README.md` for each pack. The URL
is `/<section>/<name>/`. That is the same slug open-packs' `docs/packs/<name>.md`
has today, so its URLs do not change.

- **Frontmatter is synthesised**: `title` from the README H1, else the name;
  `description` from the first sentence of the preamble; `kind: Pack`;
  `doc_status: active`; `sources:` naming the pack directory; and a
  `generated: {by: doc-kitty-packs/<version>, at, content_hash}` stamp. Front
  matter in the README itself is not copied.
- **The body is the whole README**, preamble and every section, not the preamble
  only. Above it sits a facts block: `pack_id`, version, level, parent,
  depends-on (each named by a pack of the same build when one holds that
  `pack_id`, else the bare ULID with its range), presets, locked artefacts from
  `policy.yaml`, the `manifest_hash`, and the inventory per kind.
- **README links are relocated.** A link into the pack becomes a link to the
  rendered artefact page, if there is one, else to `sourceUrlPrefix`. A link that
  resolves into `docsDir` becomes a site link. Anything else becomes plain text
  with a warning, never a broken link.
- **Ownership is per pack directory, not per section.** The generator owns
  `<section>/<name>/**` for every pack it renders, prunes only pages it stamped,
  and fails if an authored file sits inside a pack directory it owns. The section
  landing (`<section>/README.md`) and other authored pages in the section stay
  authored. This differs from the Gherkin section on purpose: open-packs keeps
  hand-written pages beside its pack pages. A pack name that collides with an
  authored page is fatal.
- **Integrity is the charter's.** The page shows the `manifest_hash`. doc-kitty
  computes no digest of its own, and open-packs' bespoke checksum and its
  `*.source.yaml` sidecars are not part of the contract.
- `dockitty-generate-pack-pages --check` fails on drift. The generator also runs
  at `astro:config:setup` (the Gherkin and glossary seam) and watches the pack
  files in dev.

The generated pages are ordinary entries. The sitemap, search, `llms.txt`, the
agent API, the OKF export, the frontmatter gate and the links gate cover them
with no extra code.

### D6. Later slices extend the same reader and section

Kind hubs and artefact pages (`/<section>/<name>/<kind>/<id>/`, with the raw YAML
published beside each, as ADR-0067 does), DRG cross-links and backlinks, the
active-charter hub from `.kittify/`, git and bundle sources with a publication
allow, the remaining kinds, and several versions of a pack. Each adds to
`PackModel` and to the generator. None of them adds a second reader. URLs use the
artefact id, never the title.

### D7. New kinds

`Pack` now, then `Directive`, `Tactic`, `Procedure`, `AgentProfile`,
`GlossaryPack` and `PackKind` (a kind hub) with the artefact pages. They are
appended to the open `KINDS` vocabulary (ADR-0031, ADR-0065), so a consumer can
still override them.

## Versioning and pinning

| What | Pinned by | Moves when |
|---|---|---|
| The charter's packs contract | doc-kitty's vendored snapshot and `contract.lock.json` (a charter commit, later a contract release) | A doc-kitty release refreshes it. A site may point `packs.contract` at a newer snapshot without waiting |
| doc-kitty | The consumer's exact `@spec-kitty/doc-toolkit` version | The consumer upgrades |
| The packs themselves | The consumer's checkout (same repository), later a git tag or commit (never a branch) | The consumer bumps it |
| Descriptor and manifest shapes | Their own `schema_version` | An unknown major is a warning plus a facts-only page |

Each generated page records the contract commit it was read with, so a reader
can tell which version of the format a page reflects.

## Consequences

### Positive

- One implementation of pack rendering for open-packs, the charter and core,
  which all build with doc-kitty already.
- The format lives in one place. doc-kitty adapts at one seam, and a contract
  change is a snapshot refresh plus reader changes, never a sweep of templates.
- open-packs can retire `gen_pack_reference.py` and its two `--check` CI steps
  without changing a URL.
- No third implementation of the Markdown codec to keep in step.

### Negative

- doc-kitty must track charter contract changes and cut a release for each one a
  consumer needs, or the consumer overrides the snapshot.
- A pack the charter would refuse can render on a site that does not run the
  charter's gate.
- The README is parsed twice, by the charter's codec and by doc-kitty's pipeline,
  and the two could disagree on an edge case. The codec refuses those edge cases
  (ambiguous headings), so a valid README parses the same way in both.

### Risks

- **Contract churn** while the pack format settles. Mitigated by D1's snapshot,
  D2's warnings in place of failures, and the override.
- **open-packs' layout lags the contract** (no manifest in org packs). The reader
  falls back to a file-kinds walk for the inventory and reports the missing
  manifest. The page shows no hash until open-packs generates one.
- **Relocated links** can lose meaning. Unresolved targets become plain text and
  are counted in the build log.

## Alternatives considered

### Read open-packs' tree as it is

The fastest path to parity, but it bakes in a layout the charter is moving away
from. Rejected at the operator's direction: read the charter's schema files.

### Validate READMEs in doc-kitty

A `dockitty-validate-packs` gate porting the codec would give every doc-kitty
site the check without Java or Python. Rejected: it would be the third
implementation (after the charter's Java and open-packs' Python mirror), and the
verdict belongs to the charter.

### Read through the charter service or an export command

Authoritative, but a build would need a running JVM service or the network.
Built-in packs have no `/doc` read, and no whole-pack export exists (charter #543
proposes one). Kept as a later adapter behind the same `PackModel`.

### A `kind: Pack` stub page per pack (PR #336)

It let a pack appear anywhere in a docs tree with its own introduction. Since
open-packs #248 the README is the introduction, so the stub duplicates it. Site
config with discovery replaces it, and per-pack options can live in config if a
need appears.

### Injected routes instead of generated files

Every agent surface would need synthetic records, and the docs loader rejects
routes that desync its walk. Generated files keep packs ordinary (ADR-0046).

## References

- Epic #328; ADR record #329; superseded draft PR #336
- spec-kitty-charter: `contracts/packs/file-kinds.yaml`,
  `contracts/packs/schemas/pack-document.schema.json`, ADR-0042 (amended
  2026-11-11 and 2026-11-12), ADR-0073, ADR-0015, ADR-0022
- spec-kitty-open-packs: `scripts/docs/gen_pack_reference.py`, ADR 2026-07-18-2,
  ADR 2026-07-18-3, ADR 2026-10-17-1, ADR 2026-11-11-2, #19, #24
- spec-kitty core: `src/charter/offering/artifact_kinds.py`, epic #6100
