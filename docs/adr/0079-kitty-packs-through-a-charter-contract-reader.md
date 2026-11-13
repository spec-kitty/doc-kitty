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
is [Kitty packs in doc-kitty](../architecture/research/packs.md). It amends
[ADR-0046](0046-gherkin-feature-pages.md) decision 4 (D6 below).

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
  service at the commit in its `charter.lock.yaml`, and renders a docsite with
  doc-kitty. Its Python `gen_pack_reference.py` writes one reference page per
  pack, from a layout that is still being aligned with the charter's contract.
- **spec-kitty** core resolves and activates packs at runtime. It never reads the
  README as a document and has no whole-pack export.

Core and the charter build their docs with doc-kitty too (core epic #6100 replaces
DocFX). Pack rendering written once in doc-kitty therefore serves every site in
the product line. Writing it means choosing which model of a pack doc-kitty
reads, who validates a pack, and how doc-kitty keeps up with a format that is
still changing.

The earlier draft of this feature (PR #336) predates #248: it read a `pack.md`,
an `org-charter.yaml` and a per-pack stub page. This ADR supersedes that draft.

## Decision

### D1. doc-kitty reads packs through one adapter, pinned to the charter's contract

A **pack reader** (`src/lib/packs/`) is the only code that knows the pack format.
It is an anti-corruption layer: it turns a pack directory into doc-kitty's own
`PackModel` (D3), and nothing downstream reads pack files.

The reader classifies files with the charter's `file-kinds.yaml`, never with a
hard-coded layout. It does not follow open-packs' current tree: where a pack and
the contract disagree (for example, an org pack with no `pack-manifest.yaml`), the
contract wins and the reader reports the gap.

doc-kitty **vendors a snapshot** of the contract: `src/lib/packs/contract/` holds
`file-kinds.yaml`, the schemas the reader uses, and the charter's classifier
conformance cases (the sample paths and expected classes its own tests use). A
`contract.lock.json` records the charter commit and each file's sha256. Unit tests
fail when the bytes and the lock disagree, and run the conformance cases against
the reader. A maintainer script (`pnpm packs:sync-contract --commit <sha>`)
refreshes the snapshot. A pinned charter **release** replaces the commit once the
charter publishes contract releases (charter #45).

The YAML is data, but the precedence of its sections, the root-level case-variant
refusal and its strict keys are behaviour in the charter's Java code. The reader
therefore reimplements **classification only**, and is held to the charter's own
conformance cases rather than to a reading of the YAML. A key or a
`content_form` the reader does not know is a warning, and the pack gets a
facts-only page. It never fails the build.

The reader reads files only. It imports no Spec Kitty code and calls no service at
build time (ADR-0042).

### D2. The consumer's contract pin wins

A packs repository already proves its packs against a charter commit
(`charter.lock.yaml` in open-packs). The page must not claim a different
contract silently.

- `packs.charterLock` names the consumer's pin file. When it is set, the reader
  compares that commit with the vendored snapshot's. A mismatch is a warning, and
  each page records both: the commit the packs were proven against and the commit
  doc-kitty read them with.
- `packs.contract` points at a newer snapshot directory, in the vendored layout,
  so a consumer ahead of doc-kitty's release can render with its own pin.
- doc-kitty never fetches a contract at build time.

### D3. doc-kitty renders; the charter judges

doc-kitty does **not** validate a pack or its README against the codec. The
verdict stays with the charter service and the CI that runs it. A pack the
charter would refuse still renders. A refused pack fails open-packs CI before it
is ever published, so doc-kitty does not repeat that gate.

The reader is tolerant. It parses the README into the codec's shape
(frontmatter, title, preamble, sections) with doc-kitty's own Markdown pipeline,
and reports as warnings only what rendering needs to know:

- a file the contract classifies as `retired`, or does not classify at all;
- a constituent the manifest lists but the directory lacks, or the reverse;
- a README link that does not resolve after relocation (D5).

doc-kitty does check what it **displays as fact**. It recomputes each manifest
constituent's `content_hash` with the schema's recipe (SHA-256 of the bytes after
CRLF to LF). When a hash or the membership disagrees, the page labels the
`manifest_hash` as unverified and the build warns. This is not a verdict on the
pack; it keeps a stale manifest from reading as current.

### D4. `PackModel`, doc-kitty's view of a pack

```ts
interface PackModel {
  dir: string;                       // directory name: the slug and the include/exclude key
  path: string;                      // the pack directory, repository-relative
  identity: {                        // pack.yaml (pack-descriptor)
    packId: string;                  // ULID, the runtime identity
    name: string;                    // display handle; may differ from dir
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
    hash: string;                    // manifest_hash as written
    verified: boolean;               // every content_hash and the membership matched (D3)
    constituents: { kind: string; id: string; path: string; contentHash: string }[];
  };
  presets: { name: string; path: string }[];
  policy?: Record<string, string>;   // the file named by mutability_policy; absent means all open
  inventory: {
    source: 'manifest' | 'file-kinds';  // which enumeration the page used
    kinds: { kind: string; ids: string[] }[];
  };
  problems: { severity: 'warning'; code: string; file?: string; message: string }[];
  contract: { readWith: string; provenAgainst?: string };  // charter commits (D2)
}
```

Artefact titles and summaries, DRG edges and the active charter extend this
model in later slices. The per-kind field map (a directive's `title` and
`intent`, a tactic's `name` and `purpose`, an agent profile's kebab-case keys)
lives in the reader beside the contract snapshot, not in page templates.

### D5. Packs are declared in site config and discovered by the contract's glob

```ts
defineDocKittyIntegrations({
  packs: {
    sources: ['../packs'],          // roots that hold */pack.yaml
    section: 'packs',               // where the pages go in docsDir
    include: ['*'], exclude: [],    // pack directory names
    sourceUrlPrefix: 'https://github.com/spec-kitty/spec-kitty-open-packs/blob/main/packs/',
    charterLock: '../charter.lock.yaml',  // optional (D2)
    contract: undefined,            // optional newer snapshot (D2)
    extraFacts: undefined,          // optional (pack) => [{ label, value }] (D6)
    allowEmpty: false,
  },
});
```

- Source roots resolve against the site root (`process.cwd()`), as Gherkin
  sources do. They must stay inside the **repository root** (the git top level,
  else the parent of `docsDir`) after `realpath`. An escape is refused, not
  clamped. `../packs` from open-packs' `site/` is inside.
- A pack is a directory under a source root that holds a `pack.yaml`: the
  contract's `*/pack.yaml` glob, relative to the root.
- A source that yields no pack fails, unless `allowEmpty` is set, so a checkout
  without its packs cannot prune every page (the Gherkin guard).
- The config is validated eagerly. An error is build-fatal with a `[dk-packs]`
  prefix, as the Gherkin option is.

The per-pack stub page of the earlier draft is dropped. The README is now the
pack's introduction, so a stub would duplicate it, and a packs repository with 19
packs would keep 19 stubs in step by hand.

### D6. A generated page per pack, owned per pack directory

The generator writes `<docsDir>/<section>/<dir>/<index>.md` for each pack, where
`<dir>` is the pack's **directory name** and `<index>` is the site's first
`indexBasename`. The URL is `/<section>/<dir>/`. That is the slug open-packs'
`docs/packs/<dir>.md` has today, so its URLs do not change. The `pack.yaml` `name`
is shown, never used in a URL: `qa` is named `quality-assurance` and keeps
`/packs/qa/`.

- **Frontmatter is synthesised**: `title` from the README H1, else the name;
  `description` from the first sentence of the preamble, else "The `<name>` pack"
  with its level; `kind: Pack`; `doc_status: active`; `updated` from the stamp's
  `at`; `sources:` naming the pack directory; and a
  `generated: {by: doc-kitty-packs/<version>, at, content_hash}` stamp, where `at`
  changes only when the content hash does. Frontmatter in the README is not
  copied.
- **The body is the whole README**, preamble and every section, not the preamble
  only. Above it sits a facts block: `pack_id`, version, level, parent,
  depends-on (each linked to a pack of the same build that holds that `pack_id`,
  else the bare ULID, always with its range), presets, locked artefacts, the
  `manifest_hash` with its verified state, the inventory per kind with counts and
  its source, and the two contract commits. `extraFacts` lets a site add rows,
  such as open-packs' own digest; doc-kitty computes no digest of its own.
- **README links are relocated.** A link into the pack becomes a link to the
  rendered artefact page when there is one, else a link under `sourceUrlPrefix`.
  A link that resolves into `docsDir` becomes a site link. Anything else becomes
  plain text with a warning, never a broken link.
- **Ownership is per pack directory.** The generator owns
  `<section>/<dir>/**` for every pack it renders, prunes only pages it stamped,
  and fails if an authored file sits inside a pack directory it owns. The section
  landing and other authored pages in the section stay authored, and the hub
  lists the pack pages under it. A pack directory whose slug collides with an
  authored page is fatal.
- `dockitty-generate-pack-pages --check` fails on drift. The generator also runs
  at `astro:config:setup` (the Gherkin and glossary seam) and watches the pack
  files in dev.

**This amends ADR-0046 decision 4 ("Single ownership").** A producer may own a
whole section, as Gherkin does, or a set of directories inside a section, as
packs do. Ownership is still decided by stamp only. The gates that today
recognise only the Gherkin and glossary producers (`PRODUCERS` and
`isGeneratedPage` in the frontmatter gate, and the Gherkin output scan) become one
producer registry with an ownership scope per producer. That work is part of the
first implementation slice, not an afterthought.

With the registry in place, the sitemap, search, `llms.txt`, the agent API and the
OKF export cover pack pages as ordinary entries, with no packs-specific code.

### D7. Later slices extend the same reader and section

Kind hubs and artefact pages (`/<section>/<dir>/<kind>/<id>/`, with the raw YAML
published beside each, as ADR-0067 does), DRG cross-links and backlinks, the
active-charter hub from `.kittify/`, git and bundle sources with a publication
allow, the remaining kinds, and several versions of a pack. Each adds to
`PackModel` and to the generator. None of them adds a second reader. URLs use the
artefact id, never the title.

### D8. New kinds

`Pack` now, then `Directive`, `Tactic`, `Procedure`, `AgentProfile`,
`GlossaryPack` and `PackKind` (a kind hub) with the artefact pages. They are
appended to the open `KINDS` vocabulary (ADR-0031, ADR-0065), so a consumer can
still override them.

## Versioning and pinning

| What | Pinned by | Moves when |
|---|---|---|
| The charter's packs contract | doc-kitty's vendored snapshot and `contract.lock.json` (a charter commit, later a contract release); overridable by `packs.contract` | A doc-kitty release refreshes it, or a site points at a newer snapshot |
| The contract the packs were proven against | The consumer's own pin (`charter.lock.yaml`), read through `packs.charterLock` | The consumer bumps it. A mismatch warns, and both commits are on the page |
| doc-kitty | The consumer's exact `@spec-kitty/doc-toolkit` version (or git commit, as core pins it) | The consumer upgrades |
| The packs themselves | The consumer's checkout (same repository), later a git tag or commit (never a branch) | The consumer bumps it |
| Descriptor and manifest shapes | Their own `schema_version` | An unknown major is a warning plus a facts-only page |

## Consequences

### Positive

- One implementation of pack rendering for open-packs, the charter and core,
  which all build with doc-kitty.
- doc-kitty adapts to the format at one seam. A contract change is a snapshot
  refresh, conformance cases and reader changes, never a sweep of templates.
- open-packs can retire `gen_pack_reference.py` without changing a URL.
- No third implementation of the Markdown codec to keep in step.
- The producer registry removes the Gherkin special cases from the gates, which
  any later generator also needs.

### Negative

- doc-kitty reimplements the charter's file classification, held in step by
  vendored conformance cases. A behaviour change the charter makes without a
  conformance case can slip through.
- doc-kitty must track contract changes and cut a release for each one a consumer
  needs, or the consumer supplies its own snapshot.
- A pack the charter would refuse can render on a site that does not run the
  charter's gate.
- The README is parsed twice, by the charter's codec and by doc-kitty's pipeline.
  The codec refuses the ambiguous cases, so a valid README parses the same way in
  both.

### Risks

- **Contract churn** while the pack format settles. Mitigated by the snapshot,
  the conformance cases, warnings in place of failures, and the overrides.
- **open-packs' layout lags the contract.** Org packs have no manifest, and
  `built-in`'s manifest is stale. The reader falls back to a file-kinds walk,
  labels the inventory source, and labels an unverified hash.
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

### Vendor only `file-kinds.yaml`, without conformance cases

Smaller, but it silently reimplements the Java precedence and refusals from a
reading of the YAML. Rejected for D1's conformance cases.

### Show the manifest hash as read

Simplest, but `built-in`'s manifest is already stale, and a hash a reader cannot
trust is worse than none. Rejected for D3's recomputation.

### Read through the charter service or an export command

Authoritative, but a build would need a running JVM service or the network.
Built-in packs answer `404 pack_not_found` on `/doc` (charter ADR-0073 decision 9),
and no whole-pack export exists (charter #543 proposes one). Kept as a later
adapter behind the same `PackModel`.

### A `kind: Pack` stub page per pack (PR #336)

It let a pack appear anywhere in a docs tree with its own introduction. Since
open-packs #248 the README is the introduction, so the stub duplicates it. Site
config with discovery replaces it.

### Slug from the `pack.yaml` name

A cleaner identifier, but two open-packs packs are named differently from their
directories, so their URLs would move. Rejected: the directory is the slug.

### Injected routes instead of generated files

Every agent surface would need synthetic records, and the docs loader rejects
routes that desync its walk. Generated files keep packs ordinary (ADR-0046).

## References

- Epic #328; ADR record #329; superseded draft PR #336
- spec-kitty-charter: `contracts/packs/file-kinds.yaml`,
  `contracts/packs/schemas/pack-document.schema.json`,
  `contracts/packs/schemas/pack-descriptor.schema.json` (`mutability_policy`),
  ADR-0042 (amended 2026-11-11 and 2026-11-12), ADR-0073, ADR-0015, ADR-0022
- spec-kitty-open-packs: `scripts/docs/gen_pack_reference.py`, `charter.lock.yaml`,
  ADR 2026-07-18-2, ADR 2026-07-18-3, ADR 2026-10-17-1, ADR 2026-11-11-2, #19, #24
- spec-kitty core: `src/charter/offering/artifact_kinds.py`, epic #6100
- doc-kitty: `src/lib/generator-stamp.mjs`, `src/scripts/validate-frontmatter.mjs`,
  `src/lib/gherkin/generate.mjs`
