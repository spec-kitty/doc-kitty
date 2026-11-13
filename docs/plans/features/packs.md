---
title: Kitty packs
description: "First-class Spec Kitty pack support: generated pack pages read through a charter-contract reader, then artefact pages, DRG links and a repository's active charter."
doc_status: draft
updated: 2026-11-13T00:00:00Z
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: open-packs, the charter and core all build their docs with doc-kitty, and open-packs keeps its own pack-page generator until doc-kitty replaces it.
tags: [packs, doctrine, generated, charter, open-packs]
related:
  - architecture/research/packs
  - adr/0079-kitty-packs-through-a-charter-contract-reader
---

# Kitty packs

A site lists its pack directories in config. doc-kitty reads each pack through one
adapter pinned to the charter's packs contract, and generates a page per pack:
the whole README, the pack's identity and dependencies, its manifest hash and its
inventory. Later slices add a hub per kind, a page per artefact, DRG links, and a
kittified repository's active charter.

Scope: Extended.

Design: [Kitty packs in doc-kitty](../../architecture/research/packs.md) and
[ADR-0079](../../adr/0079-kitty-packs-through-a-charter-contract-reader.md).

## Goals

- open-packs retires `scripts/docs/gen_pack_reference.py` with no URL change.
- Any doc-kitty site (open-packs, the charter, core, a kittified repository) can
  show packs with the same pages.
- The pack format is read in one place, against the charter's contract, not
  against one repository's layout.

## Non-goals

- Validating a pack or its README. The charter service is the verdict.
- Authoring or editing pack content, or writing back to a pack.
- Resolving activation the way core does at runtime. The active-charter hub shows
  what `.kittify/charter/charter.yaml` already compiled.
- A retrieval or embedding index of doctrine.

## Slices

Each slice is one child issue of #328.

1. **ADR: kitty packs through a charter-contract reader** (#329). Accept
   ADR-0079. *Done when* it is merged as Accepted.
2. **Pack reader and contract snapshot** (#330). `src/lib/packs/`: the vendored
   `file-kinds.yaml` and schemas with `contract.lock.json`, a digest test,
   `pnpm packs:sync-contract`, and `readPack(dir) → PackModel` with its warnings.
   Fixtures: one pack with a manifest, one without, one with a retired file.
   *Done when* the fixtures read into the documented model, unknown and retired
   files are warnings, and a changed snapshot byte fails the test.
3. **Pack pages** (new). The `packs` option, the `doc-kitty-packs` producer,
   generation at `astro:config:setup`, `dockitty-generate-pack-pages --check`,
   the facts block, the whole README with relocated links, and per-pack-directory
   ownership with an authored section landing. The example site renders a fixture
   pack. *Done when* a page per pack builds with the same slug open-packs uses
   today; `--check` fails on drift; an authored file inside an owned pack
   directory fails; and the pages appear in the sitemap, search, `llms.txt`, the
   agent API and the OKF export.
4. **Kind hubs and artefact pages** (new). `/<section>/<pack>/<kind>/<id>/` for
   directives, tactics, procedures, agent profiles and glossary packs, a card per
   artefact with its title and summary, and the raw YAML published beside each
   page. *Done when* those kinds render from the fixtures, an unknown kind gets a
   generic page and a warning, and in-pack README links resolve to artefact pages.
5. **DRG cross-links and backlinks** (#331). Related artefacts and "Used by" from
   graph shards and org fragments, resolved by pack, kind and id, and pack
   dependants on the pack page. *Done when* every edge between rendered artefacts
   is a link both ways, and an edge to an unrendered target is plain text that
   passes the links gate.
6. **Active charter hub** (#332). Read `.kittify/charter/charter.yaml`
   (`schema_version: 2.0.0`) and `.kittify/config.yaml`: selected packs, presets,
   overrides, and `catalog.references[]` with the tier of each, linked to
   artefact pages where they are rendered. *Done when* doc-kitty's own site
   renders its active charter. Can run in parallel with slices 4 and 5.
7. **Git and bundle sources, publication policy** (#333). A git source pinned to a
   tag or commit, a host allowlist, offline mode, a cache, a `bundle` input, and a
   site-level allow before a private pack is published. A charter-service adapter
   behind the same `PackModel` is an option here. *Done when* a branch ref is
   refused, a tag builds, and offline mode builds from cache.
8. **Remaining kinds, scale and aliases** (#334). Styleguides, toolguides with
   their `.guide.md` prose, paradigms, missions, skills, assets; search weighting;
   artefact pages out of RSS; `llms.txt` grouping; rename aliases into the
   redirect gate. *Done when* `foundation` renders in full within the build
   budget and a renamed artefact redirects.
9. **Several versions of a pack** (#335). A version switcher in the OpenAPI
   pattern. *Done when* two versions render with stable URLs.

Order: 1, then 2, then 3. Slices 4 and 6 can run in parallel after 3; 5 builds on
4; 7 to 9 follow. Slice 3 is the point where open-packs can switch.

## Migration of open-packs' generator

A strangler in four steps. Steps 2 to 4 are open-packs work.

1. doc-kitty releases slices 2 and 3.
2. open-packs upgrades `@spec-kitty/doc-toolkit` from 0.3.0 to that release,
   which also brings four minor releases of other changes.
3. In one pull request, open-packs sets `packs: { sources: ['../packs'] }`,
   deletes the generated `docs/packs/<name>.md` files (they become
   `docs/packs/<name>/README.md`, with the same URL), replaces the two
   `gen_pack_reference.py --check` CI steps with `dockitty-generate-pack-pages
   --check`, and deletes the script. `docs/packs/index.md` and
   `catalog-proposal.md` stay authored.
4. open-packs amends its ADR 2026-07-18-2 (pack reference generated from source)
   and ADR 2026-07-18-3 (build-time checksum tagging): the page now shows the
   charter's `manifest_hash`, not open-packs' own checksum.

The README preamble-only "Purpose" becomes the whole README. Pages for org packs
show no hash until open-packs generates their manifests.

## Cross-repository items

These need the operator's approval before anyone files them.

| Repository | Item | Needed by |
|---|---|---|
| open-packs | Upgrade `@spec-kitty/doc-toolkit` 0.3.0 to the packs release, and adopt the `packs` option (migration steps 2 and 3) | Retiring the generator |
| open-packs | Retire `gen_pack_reference.py` and amend ADR 2026-07-18-2 and 2026-07-18-3 (migration step 4) | Retiring the generator |
| open-packs | Generate `pack-manifest.yaml` for every pack, org packs included, as charter ADR-0042 (amended 2026-11-12) requires | A hash and an exact inventory on every page |
| spec-kitty-charter | Publish the packs contract (`file-kinds.yaml` and schemas) as a versioned release, so doc-kitty pins a release, not a commit (extends charter #45) | Slice 2 pinning, later |
| spec-kitty-charter | Annotate each artefact schema with its display fields (title, summary), so renderers stop hard-coding the per-kind field map | Slice 4, optional |
| spec-kitty-charter / core | A whole-pack read for built-in packs too (comment on charter #543 rather than file anew) | Slice 7, optional |
| spec-kitty (core) | Render the vendored built-in packs on core's doc-kitty site, once slice 3 ships | Adoption |

## Risks

See the [research](../../architecture/research/packs.md#risks) and
[ADR-0079](../../adr/0079-kitty-packs-through-a-charter-contract-reader.md#risks).
The main ones are contract churn, open-packs lagging the contract, and links
that lose meaning when a README is rendered away from its pack.
