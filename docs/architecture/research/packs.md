---
title: Kitty packs in doc-kitty
description: "Research on first-class support for Spec Kitty packs: what a pack is under the charter's contract, what open-packs and core do today, and which pack behaviour doc-kitty should own."
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: Architecture
kind: Explanation
tags: [packs, doctrine, generated, charter, open-packs]
related:
  - plans/features/packs
  - adr/0079-kitty-packs-through-a-charter-contract-reader
  - adr/0046-gherkin-feature-pages
  - adr/0042-native-documentation-charter
---

# Kitty packs in doc-kitty

Spec Kitty **packs** are bundles of doctrine: directives, tactics, procedures,
agent profiles, glossary packs and more, with a README that describes the pack.
This page records how packs look today across the Spec Kitty repositories, and
which pack behaviour doc-kitty should own. The decision is
[ADR-0079](../../adr/0079-kitty-packs-through-a-charter-contract-reader.md); the
slices are in the [packs feature plan](../../plans/features/packs.md).

It replaces an earlier draft of this page, written before open-packs #248
(issues #241 and #242, charter #451) made each pack's `README.md` its pack
document. That draft assumed `pack.md`,
`PROVENANCE.md` and `org-charter.yaml`, which are now retired.

> **Naming.** In doc-kitty, "charter" already means the documentation-governance
> charter (`docs/_meta/charter.yaml`, `src/lib/effective-charter.mjs`,
> ADR-0042). This feature therefore says **packs**: the section is `packs`, the
> page kind is `Pack`, and the repository's doctrine view is the "active charter"
> hub. `Persona` is also taken (audience profiles), so agent profiles become
> `AgentProfile`.

## Who owns what today

Four repositories touch packs. Each is its own bounded context, with its own
vocabulary and its own verdicts:

| Context | Owns | Reads packs how |
|---|---|---|
| **spec-kitty-charter** | The pack **format**: `contracts/packs/file-kinds.yaml`, 27 JSON Schemas, the Markdown codec, and the verdict on composition and registration | Java service: `PUT /packs/{packId}` registers a whole pack; `GET /packs/{packId}/doc` serves its README |
| **spec-kitty-open-packs** | Pack **content**: `packs/<name>/`, its CI gates, per-pack digest sidecars, and a docsite built with doc-kitty | Python: `validate_pack_schemas.py` mirrors the charter contract; `charter_service_check.py` asks the service; `gen_pack_reference.py` writes `docs/packs/*.md` |
| **spec-kitty (core)** | The **runtime**: resolving the built-in, org and project tiers, and activation | Python: `pack.yaml`, `pack-manifest.yaml`, graph files, presets and artefact folders. It never reads `README.md` |
| **doc-kitty** | **Rendering** a docs tree as a site, with agent surfaces and drift gates | Nothing yet |

The charter is the authority. ADR-0015 in the charter makes its schemas
canonical and asks consumers to adapt. open-packs pins the charter commit it is
proven against in `charter.lock.yaml`. The operator's direction for this design
is the same: read packs through the **charter's contract**, not through
open-packs' current layout, which is still being aligned with that contract.

## The pack under the charter's contract

`contracts/packs/file-kinds.yaml` classifies every file of a pack checkout
(globs relative to `<checkout>/packs/`). It tries its sections in order:
`files` (a glob to a schema), `exclusions`, `retired`, `payloads` and
`ignored`. It also lists the `node_kinds`, `artifact_kinds` and
`fragment_kinds`.

| File | Rule | Role |
|---|---|---|
| `*/pack.yaml` | `pack-descriptor` | Identity and lineage: `pack_id` (ULID, the only runtime identity), `name`, `pack_version`, `pack_level`, `parent_pack`, `depends_on: [{pack_id, range}]`, `pack_drg`. Closed schema; `schema_version: "1.0"` is optional |
| `*/README.md` | `pack-document`, Markdown | The pack's description. Only the root README counts |
| `*/pack-manifest.yaml` | `pack-manifest` | Derived: every constituent with `kind`, `id`, `path`, `content_hash`, plus `manifest_hash`. Charter ADR-0042 (amended 2026-11-12) says it is always generated and restamped on every write |
| `*/presets/*.yaml` | `preset` | Activation presets |
| `*/policy.yaml` | `policy` | Mutability per artefact, e.g. `agent_profile:generic-agent: locked` |
| `**/*.graph.yaml`, `*/drg/fragment.yaml` | `graph-shard`, `org-fragment` | DRG nodes (`urn: <kind>:<id>`) and edges |
| `**/*.<kind>.yaml` | one schema per kind | Artefacts: directive, tactic, styleguide, toolguide, paradigm, procedure, agent, step-contract, asset, glossary-pack, skill, mission-type, guard, lifecycle, and `step-enhancement` under `missions/` |
| `**/charter.yaml` | `charter` | A charter file |
| `**/toolguides/*.guide.md`, mission step prompts, guidelines, prompt fragments | Markdown schemas | Prose bodies |
| `*/pack.md`, `*/PROVENANCE.md`, `*/org-charter.yaml` | `retired` | Refused by name (422, `retired`), and so are root-level case variants such as `Readme.md` |
| `**/*.md` | `ignored` | Not held, not served, not refused |

### The pack document

The `pack-document` schema works over the codec's Markdown model:

```json
{ "required": ["preamble", "sections"], "additionalProperties": false,
  "properties": { "frontmatter": { "type": "object" }, "title": { "minLength": 1 },
                  "preamble": { "type": "string" },
                  "sections": [{ "title": "…", "content": "…" }] } }
```

So a README is optional frontmatter, an optional H1 (the pack's title), a
preamble, then H2 sections. Every part is free text. The schema has no required
heading, no link rule and no size limit. The `## Provenance` section is a
convention from the open-packs migration, not a schema rule.

The codec refuses, and never warns about: input that is not UTF-8, a byte order
mark, any carriage return, unterminated, invalid or non-mapping frontmatter, a second H1 or an H1 that is not
the first block, an H1 or H2 indented by 1 to 3 spaces, an empty heading, a tab
after the `#` run, a closing `#` sequence, a setext underline, and an unclosed
fence. A refused README makes the pack unreadable: 500 `pack_unreadable` on read,
422 on registration.

`GET /packs/{packId}/doc` returns the README byte for byte with
`Accept: text/markdown`. With JSON (the default) it returns `{title, body,
_links}`, where `body` is the canonical re-serialisation below the H1, without
frontmatter. A built-in pack answers `404 pack_not_found` (charter ADR-0073
decision 9).

### Versioning in the contract

- Schema `$id`s carry no version (`https://schemas.spec-kitty.ai/charter/packs/<kind>.schema.json`)
  and are identifiers only. There is no published schema package.
- Some files carry a `schema_version` (descriptor `"1.0"`, manifest `"1.0"`,
  policy `1`). `pack-document` has none.
- The service contract is `0.2.0-SNAPSHOT`, where a minor may break (charter
  ADR-0022). Consumers pin an exact charter commit, as open-packs does.
- Contract release publishing is open (charter #45).

## What open-packs does today

open-packs already renders its docs with doc-kitty: `site/` depends on
`@spec-kitty/doc-toolkit` **0.3.0** (doc-kitty is at 0.7.1), with
`docsDir: '../docs'` and `indexBasename: ['index', 'README']`. Its ADR
2026-10-17-1 chose doc-kitty to share one toolchain with the charter's site.

`scripts/docs/gen_pack_reference.py` (636 lines) writes one
`docs/packs/<pack>.md` per pack directory:

- doc-kitty-valid frontmatter with `kind: Reference` and a
  `generated: {by, at}` stamp. `at` is a fixed constant, because a git date made
  the drift gate fail spuriously;
- a "do not edit" banner;
- version, `pack_level` and `depends_on`, with each dependency named by the
  local pack that holds its `pack_id`;
- the README **preamble only**, as "Purpose";
- an artefact inventory: a recursive file count per top-level subdirectory, a
  total, and a full file listing in `<details>`. Root files such as `pack.yaml`
  are in no kind;
- a bespoke content checksum (sha256 over sorted path, NUL, bytes, LF).

It records no validation verdict, on purpose: the CI gates are the verdict
(open-packs #249). Two CI jobs run `gen_pack_reference.py --check`. The
hand-authored `docs/packs/index.md` and `catalog-proposal.md` sit beside the
generated pages, protected by a reserved-slug list.

Gaps against the charter's contract, which the operator calls "alignment
ongoing":

- The 12 org packs, such as `go`, have no `pack-manifest.yaml`, though the
  charter now says one is always generated. Only the 7 built-in-level packs have
  one, and charter ADR-0042 (amended 2026-11-12) records that `built-in`'s is
  stale: it lists 53 files the load does not hold and leaves out 54 it does. A
  manifest hash read from disk is therefore not trustworthy on its own. The
  generator counts directories instead of reading constituents.
- Two packs have a `pack.yaml` `name` that differs from their directory: `qa` is
  `quality-assurance` and `internal` is `spec-kitty-internal`. Today's URLs come
  from the directory.
- The checksum is open-packs' own recipe. A second digest, `spec-kitty-snapshot-sha256`,
  sits in per-pack sidecars `packs/<name>.source.yaml` (open-packs ADR
  2026-11-11-2), outside the pack and outside `file-kinds.yaml`. Neither is the
  charter's `manifest_hash`, and readers use the bespoke recipe today to verify a
  download.
- open-packs proves its packs against the charter commit in its own
  `charter.lock.yaml`. A renderer pinned to a different commit can disagree with
  that verdict.
- READMEs link relatively into the repository (`../../docs/guides/compose-packs.md`).
  That only resolves from the pack directory, so a page rendered elsewhere has to
  rewrite those links.

open-packs #19 (content-from-code docsite) and #24 (validator and schema
reference pages) are the epics behind this generator.

## What core does today

- Core resolves three tiers: `built-in` (`packs/built-in/` beside the source,
  fetched from a pinned open-packs commit by `charter pack vendor` and
  `scripts/sync_packs.py`, or `SPEC_KITTY_PACKS_ROOT`), `org` (`.kittify/config.yaml`
  `charter_packs.org.packs[]`, with `local_path`, `source_type`, `url`, `ref`,
  `subdir`), and the project pack at `.kittify/charter-packs/`.
- It reads `pack.yaml`, `pack-manifest.yaml`, graph files, presets and the
  per-kind folders (`src/charter/offering/artifact_kinds.py`). It never reads a
  pack's `README.md` as a document: it only filters it out, and `charter org
  init` writes a stub. It has no `policy.yaml` reader. It still names
  `org-charter.yaml` and `PROVENANCE.md` in places, so it is not yet caught up
  with #248 either.
- JSON surfaces: `charter pack list --json`, `charter pack validate --json`
  (`{ok, errors[], advisories[]}`), `charter status --json`, and
  `charter context --json`. `charter pack assemble` writes a merged pack
  directory from input packs, but **no command exports an installed or
  registered pack as JSON or an archive, and none emits its README.** The charter
  service reads a pack's artefacts, relationships and document one by one, with
  no whole-pack export; charter #543 proposes an archive download.
- The active charter is `.kittify/charter/charter.yaml` (`schema_version: 2.0.0`),
  with a compiled `catalog.references[]` of `{id, kind, title, summary,
  source_path, local_path}`.
- Core's own docs site is moving from DocFX to doc-kitty (core epic #6100; core
  ADR 2026-10-31-1, still marked Proposed). Its `site/` pins doc-kitty by git
  commit, not by an npm version. That is the "DocFX to doc-kitty overhaul": the product line
  standardises on doc-kitty, so pack rendering written once in doc-kitty serves
  open-packs, the charter site and core alike. No core docs page renders packs
  yet.

## What the charter site does today

The charter's site also runs doc-kitty (0.7.0). It documents each schema with a
hand-authored `kind: Schematic` page (`docs/architecture/pack-schemas/`) and
renders the OpenAPI contract. It renders no pack content.

## Where pack behaviour belongs

| Behaviour | Owner | Why |
|---|---|---|
| The pack format, schemas and codec | Charter | It is the published language. A copy elsewhere is a fork |
| The verdict on a pack (valid, composable, registrable) | Charter service, run by open-packs CI | Already in place. A third implementation would drift |
| Pack content and its provenance prose | open-packs | Authored there |
| Pack digests in sidecars, and any checksum shown for download verification | open-packs | An open-packs release concern, outside the pack. doc-kitty offers an extension point, not a policy |
| Reading a pack for display | **doc-kitty**, through one adapter | Every doc-kitty site that shows packs needs it |
| Pack pages, kind hubs, artefact pages | **doc-kitty** | Replaces `gen_pack_reference.py` and serves core and the charter too |
| Rewriting README links for the rendered location | **doc-kitty** | Only the renderer knows where the page lands |
| Drift gate for generated pages | **doc-kitty** | The generated-section pattern of ADR-0046 |
| Frontmatter and link checks on generated pages | **doc-kitty** | Generated pages are ordinary entries for the existing gates |
| Frontmatter in pack READMEs | Neither yet | The schema allows any; doc-kitty synthesises page frontmatter instead of requiring it |

doc-kitty should **not** validate pack READMEs against the codec. It reads them
tolerantly and reports only what rendering needs: a link that does not resolve
after relocation, or a file the contract snapshot does not classify. It should,
however, check what it displays as fact. Recomputing each constituent's
`content_hash` (SHA-256 of the bytes after CRLF to LF) is cheap, is not a
verdict on the pack, and stops a stale manifest from being shown as current.

## doc-kitty's existing machinery

- **Generated sections.** The Gherkin generator (`src/lib/gherkin/generate.mjs`)
  runs at `astro:config:setup`, writes stamped Markdown, prunes only its own stale
  pages, fails on an authored file in its section, and has a `--check` CLI. Stamps
  are `generated: {by: <producer>/<version>, at, content_hash}`
  (`src/lib/generator-stamp.mjs`), with `at` bumped only when the hash changes, so
  output is deterministic without a frozen date.
- **Hubs.** A slug parent is a hub (`src/lib/hub-children.mjs`, `Hub.astro`).
- **Raw sources next to pages.** Schematic pages publish their YAML beside the
  page (ADR-0067).
- **Open `kind` vocabulary.** New kinds are appended to `KINDS`
  (`src/lib/vocabulary-core.mjs`).
- **No Spec Kitty runtime dependency** (ADR-0042). A reader must parse files.

## Prior art

- **open-packs' `gen_pack_reference.py`**: the direct predecessor. Deterministic,
  drift-gated, no verdict.
- **Backstage catalog**: one URL per entity from kind and name; relations shown in
  both directions.
- **docusaurus-openapi-docs**, **starlight-openapi**, **starlight-typedoc**: one page
  per item from one declaration, a generated sidebar slice, and a version switcher.
- **MkDocs gen-files with literate-nav**: navigation from the same enumeration as
  the pages.

## Risks

- **Contract churn.** Most recent charter ADRs are pack rulings. Mitigation: a
  vendored, digest-checked contract snapshot, unknown files reported and never
  fatal, and a site-level override to a newer snapshot.
- **Two parsers of one README.** doc-kitty renders Markdown the codec might
  refuse. Accepted: the verdict is the charter's, and a refused pack fails
  open-packs CI before it is published.
- **Link relocation.** README links are written for the pack directory.
  Unresolvable links become plain text with a warning, never a broken link.
- **Scale and search noise.** `foundation` alone is about 240 files.
- **Private packs.** Fetching a pack and publishing it are separate decisions.
- **Lagging consumers.** open-packs is four minor releases behind; core is behind
  #248. Neither blocks doc-kitty, but both gate the migration.
- **A second classifier.** `file-kinds.yaml` is data, but its precedence, the
  case-variant refusal and its strict keys are Java behaviour. A reader that
  vendors only the YAML reimplements the classification.
- **Unverified integrity.** A stale manifest hash shown as fact misleads more
  than no hash.
