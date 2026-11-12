---
title: Spec Kitty packs as generated pages
description: "Research on rendering Spec Kitty charter packs and a repository's active charter as generated hub pages, from one authored stub entry."
doc_status: draft
updated: 2026-11-12T00:00:00Z
type: Architecture
kind: Explanation
tags: [packs, doctrine, generated, hubs, kittified]
related:
  - plans/features/packs
  - architecture/research/page-feedback
---

# Spec Kitty packs as generated pages

An idea for native support of Spec Kitty **packs** (bundles of directives,
tactics, procedures, agent profiles, glossary and more) and of a repository's
**active charter**. An author writes one markdown entry that names a pack
source, and the toolkit generates a nested set of hub pages for the pack and
everything in it. This page is a proposal, not a decision. The plan is the
[packs feature](../../plans/features/packs.md).

The use cases are the kitty ecosystem's own repositories: a packs repository
such as `spec-kitty-open-packs`, which should publish one browsable page per
artefact, and any kittified repository, which should show the charter it runs
under.

> **Naming.** In doc-kitty, "charter" already means the documentation-governance
> charter (`docs/_meta/charter.yaml`, `src/lib/effective-charter.mjs`,
> ADR-0042). This feature therefore uses **packs**: the section is `packs`, the
> stub kind is `Pack`, and the repository view is the "active charter" hub
> inside it. `Persona` is also taken (audience profiles), so agent profiles
> become `AgentProfile`.

## What a pack is

A pack is a directory, for example `spec-kitty-open-packs/packs/foundation/`:

| File | Authored? | Role |
|---|---|---|
| `pack.yaml` | Authored | Identity and lineage: `pack_id` (ULID, the only runtime identity), `name`, `pack_version`, `pack_level`, `depends_on`, `parent_pack` |
| `pack-manifest.yaml` | Generated | Every constituent with kind, id, path and content hash, plus per-kind counts |
| `<pack>.source.yaml` | Generated | Pin lockfile: upstream repository, commit, subtree and tree digest |
| `org-charter.yaml`, `policy.yaml`, `presets/` | Authored | The pack's own selection, its mutability policy, and activation presets |
| `pack.md`, `README.md` | Authored | Prose |

Artefacts are YAML files in one directory per kind. The kinds are listed in
`spec-kitty/src/charter/offering/artifact_kinds.py`: directive, tactic,
styleguide, toolguide, paradigm, procedure, agent profile, mission step
contract, template, asset, glossary pack, anti-pattern and skill. The ids,
titles and summaries sit in different fields per kind:

| Kind | Id | Title | Summary |
|---|---|---|---|
| Directive | `id` (`DIRECTIVE_041`) | `title` | `intent` |
| Tactic | `id` (slug) | `name` | `purpose` |
| Procedure | `id` (slug) | `title` | `description` |
| Agent profile | `profile-id` (kebab-case keys throughout) | `name` | `description` |
| Glossary pack | `id` | — | per-term `definition` |

The canonical JSON Schemas (25 files) live in
`spec-kitty-charter/contracts/packs/schemas/`. A packs repository pins them
through `charter.lock.yaml`.

**Relationships** come from the DRG graph files: `<kind>.graph.yaml` shards in
built-in packs, or one `drg/fragment.yaml` in org packs. Each node has a
`urn: <kind>:<id>`, and each edge has a source, target, relation and condition.
Packs depend on each other through `depends_on: [{pack_id, range}]`.

**The active charter** of a repository is `.kittify/charter/charter.yaml`
(schema 2.0.0). It holds the selected packs and artefacts, plus a compiled
`catalog.references[]` with id, kind, title, summary and source path for every
artefact in force. Org packs are declared in `.kittify/config.yaml`
(`charter_packs.org.packs`), and project packs live in `.kittify/charter-packs/`.

The CLI has JSON output (`charter pack list --json`, `charter context --json`,
`charter status --json`), but none of it emits a whole pack tree. Parsing the
YAML directly is the only complete source today.

**The format is still moving.** Core is at 4.0.0rc8, the October 2026
`charter_pack_cutover` migration renamed layouts, and most recent charter ADRs
are pack rulings. A Java charter service is planned to take over reads.

## What doc-kitty already has

- **A generated-section precedent.** The Gherkin feature pages
  (`src/scripts/generate-feature-pages.mjs`, `src/lib/gherkin/generate.mjs`)
  load sources, plan pages, stamp them with `generated: { by, at }`
  (`src/lib/generator-stamp.mjs`) and write them. A `--check` mode fails on
  drift, and an authored file inside the generated section is an error.
  Generated pages get no edit link (`sourceLink()`), and they already carry a
  `sources:` frontmatter list.
- **Hubs.** A hub is a slug parent in the content collection
  (`src/lib/hub-children.mjs`) rendered by `src/layouts/Hub.astro`. Gherkin hubs
  pair `kind: Hub` with a committed list in the body.
- **A page-scoped source pointer.** Schematic pages take a `schematic_path` with
  a containment check and publish the raw YAML next to the page.
- **An open `kind` vocabulary.** Any string passes the schema, and the gate only
  warns. New kinds are appended to `KINDS` (ADR-0046, ADR-0067).
- **No Spec Kitty dependency.** ADR-0042 keeps doc-kitty free of a Spec Kitty
  runtime dependency, so a generator must read files, not import the CLI.

What does not exist is the combination: a page-scoped stub that owns a
generated subtree.

## Generation strategy

| | Generated files (recommended) | Injected routes |
|---|---|---|
| How | Write stamped markdown into the docs tree, during `astro:config:setup` or from a pre-build script | An integration injects routes or virtual entries from the stub |
| Agent payloads, OKF, sitemap, search, links gate | Automatic: the pages are ordinary entries | Each needs synthetic records, as OpenAPI does today |
| Docs loader | Fits the walk-based route table | `docKittyDocsLoader` rejects patterns that desync its walk |
| Cost | Generated files in the tree, and the merge-conflict profile of ADR-0072 | Much more surface code |

Generating files at `astro:config:setup`, as the glossary and Gherkin
integrations do, gives the real-file benefits without a separate step.

## Page hierarchy

One `packs` section, with packs as directories (not one registry section per
pack, which would make `sections.yaml` drift with every new pack):

```text
/packs/                         section hub
/packs/<pack>/                  pack hub (the authored stub)
/packs/<pack>/<kind>/           kind hub, e.g. /packs/foundation/tactics/
/packs/<pack>/<kind>/<id>/      artefact page
/packs/active/                  the repository's active charter
```

- **Pack hub**: name, version, level, depends-on and used-by packs, the
  manifest digest, and one card per kind with its count.
- **Kind hub**: what the kind is, then one card per artefact with its title and
  a one-sentence summary. Without the summary a hub of 138 tactics is a wall of
  names.
- **Artefact page**: a layout per kind (a directive's intent and enforcement, a
  tactic's steps and failure modes, a procedure's entry and exit conditions),
  related artefacts from the DRG, and "Used by" backlinks. The verbatim YAML is
  published next to the page and linked, so both the rendered and the raw form
  are available and labelled.
- **Active charter hub**: the selected packs, activations, overrides, the
  resolved artefact set, and for each artefact the tier it comes from
  (built-in, org, project).

URLs use the artefact id, never the title. Cross-links resolve by (pack, kind,
id), and an unresolved target renders as plain text, not a broken link.
Backlinks are written into the generated markdown, so agents that read the raw
pages see them too. An artefact has one canonical URL even when several packs
re-export it.

## Authoring contract (sketch)

The stub's location is the pack hub's URL, and its body is the hub's
introduction:

```yaml
# docs/packs/foundation.md
---
title: Foundation doctrine
description: The built-in doctrine every Spec Kitty project starts from.
kind: Pack
pack:
  source:
    local: ../spec-kitty-open-packs/packs/foundation
    # git: { repo: spec-kitty/spec-kitty-open-packs, ref: v3.0.0, path: packs/foundation }
    # project: true            # this repository's .kittify: the active charter hub
  include: { kinds: [directive, tactic, procedure, agent_profile, glossary_pack] }
  exclude: { ids: [] }
  titles: { kinds: { tactic: Tactics } }
---
```

The site config decides what is allowed; the stub only declares what it wants:

```ts
defineDocKittyIntegrations({
  packs: {
    section: 'packs',
    network: { allowHosts: ['github.com'], offline: false },
    maxArtefacts: 2000,
  },
});
```

Rules to pin down:

- A `local` path resolves inside the project root after `realpath`. A `..`
  escape is refused, not clamped.
- A `git.ref` must be a full commit or a tag, never a branch. The resolved
  commit goes into provenance.
- An unknown kind is a warning plus a generic page, never a build failure. The
  source syntax is ours; the kind vocabulary belongs to Spec Kitty.
- Generated children carry a `generated:` stamp from a new producer; the stub
  does not. The generator deletes only its own stale files, and fails if an
  authored file sits in its subtree (ADR-0046).
- A `generate-pack-pages --check` gate in the Gherkin shape catches drift.

## Prior art

- **open-packs' own reference pages** (`spec-kitty-open-packs/docs/packs/*.md`)
  are generated from the packs already: the closest precedent.
- **Backstage catalog**: relations declared once and shown in both directions,
  and one URL per entity from kind and name.
- **docusaurus-openapi-docs**: owned generated files, a generated sidebar slice,
  group landing pages and a version switcher.
- **starlight-openapi, starlight-typedoc**: one page per item from one
  declaration.
- **MkDocs gen-files with literate-nav**: navigation built from the same
  enumeration as the pages.

## Risks

- **Format churn.** Validate against the published schemas, record the schema
  version, and warn rather than fail on unknown fields. Longer term, ask
  spec-kitty for a `pack export --json` command, so doc-kitty reads one
  versioned contract instead of the directory layout.
- **Private packs.** Fetching a pack and publishing it are separate decisions. A
  public site must not publish private doctrine because a stub asked for it, so
  publication needs a site-level allow, and a `bundle` source (a pre-resolved
  JSON file) lets CI build offline.
- **Renames.** An artefact id that changes breaks its URL. A committed alias file
  can feed the existing redirect gate.
- **Several versions of a pack.** Follow the OpenAPI versions pattern later; the
  first slices render one version.
- **Search noise.** Hundreds of artefact pages can drown the authored docs. Weight
  hubs higher, keep one summary per card, leave artefact pages out of RSS, and
  group them in `llms.txt`.

## Open questions

1. Should the active-charter hub read `.kittify/charter/charter.yaml` directly,
   or the output of `charter status --json` committed as a bundle?
2. Which kinds belong in the first slice? Directives, tactics, procedures, agent
   profiles and glossary cover most readers; missions, step contracts and
   templates can follow.
3. Is a packs repository's own site the main consumer, or a kittified
   repository showing the packs it uses? The answer orders slices 2 and 4.
