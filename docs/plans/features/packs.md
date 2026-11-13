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
- Authoring or editing pack content, or writing to a pack or to open-packs'
  `*.source.yaml` sidecars.
- Choosing which digest a packs repository publishes for download verification.
  doc-kitty shows the charter's `manifest_hash` and offers `extraFacts`; the rest
  is the repository's decision.
- Resolving activation the way core does at runtime. The active-charter hub shows
  what `.kittify/charter/charter.yaml` already compiled.
- A retrieval or embedding index of doctrine.

## Definition of done for every slice

Each implementation slice also ships, as AGENTS.md and the charter require:

- Vitest unit tests for the new code, in the shape of the existing generator tests;
- an `example/` fixture that the example build exercises, with assertions on the
  built output in the `assert-build-artifacts` style, not existence checks;
- a configuration or guide page for any new option or command, and a `bin` entry
  in `src/package.json` for any new CLI;
- a changelog fragment in `docs/changelog/unreleased/`.

## Slices

Each slice is one child issue of #328.

1. **ADR: kitty packs through a charter-contract reader** (#329). Delivered by
   PR #337 as Proposed. *Done when* the operator accepts ADR-0079 and its status
   reads Accepted.
2. **Pack reader, contract snapshot and producer registry** (#330).
   - `src/lib/packs/`: the vendored `file-kinds.yaml`, schemas and classifier
     conformance cases with `contract.lock.json`; `pnpm packs:sync-contract`; and
     `readPack(dir) → PackModel` with its warnings and content-hash check.
   - `packs.charterLock` and `packs.contract` (ADR-0079 D2).
   - The producer registry and per-producer ownership scopes replacing the Gherkin
     special cases in `generator-stamp.mjs`, `validate-frontmatter.mjs` and the
     Gherkin output scan (ADR-0079 D6).
   - A `dockitty-read-pack <dir> --json` CLI that prints the model, as the
     slice's consumer and a debugging aid.

   *Done when* the charter's conformance cases pass against the reader; a changed
   snapshot byte fails the lock test; fixtures (a pack with a manifest, one
   without, one with a retired file, one whose manifest is stale) read into the
   documented model with the expected warnings and `verified` flags; a mismatched
   `charterLock` warns; every open-packs pack at a pinned commit reads with no
   error; and the existing Gherkin and glossary ownership tests pass unchanged on
   the registry.
3. **Pack pages, at parity with `gen_pack_reference.py`** (#338).
   - The `packs` option, the `doc-kitty-packs` producer, generation at
     `astro:config:setup`, `dockitty-generate-pack-pages --check`, and ownership
     per pack directory with an authored section landing.
   - The facts block, the whole README, and relocated links. In this slice, links
     into the pack go to `sourceUrlPrefix`, since artefact pages arrive in
     slice 4.

   *Done when*, against a fixture tree that mirrors open-packs' directory names
   (including `qa` and `internal`, whose `pack.yaml` names differ, an org pack
   with no manifest, and a pack with no dependencies):
   - the set of generated URLs equals the set the old generator produces, checked
     against a golden list;
   - two runs are byte-identical, and `--check` reports added, changed and stale
     pages;
   - removing a pack leaves a stale page that `--check` reports, and a pack
     directory colliding with an authored page fails;
   - an empty source fails unless `allowEmpty` is set;
   - a dependency held by the same build renders as a link with its range, and an
     unknown one as the bare ULID with its range;
   - each kind's inventory count and the total match the fixture, and the
     inventory source is shown;
   - a stale manifest shows its hash as unverified;
   - a link to `../../docs/…` becomes a site link, and an unresolvable one becomes
     plain text;
   - the frontmatter and links gates pass on the generated pages;
   - the sitemap, search index, `llms.txt`, agent API and OKF export each contain
     the fixture pack pages, asserted on built output.
4. **Kind hubs and artefact pages** (#339). `/<section>/<dir>/<kind>/<id>/` for
   directives, tactics, procedures, agent profiles and glossary packs; a card per
   artefact with its title and summary; and the raw YAML published beside each
   page. *Done when* those kinds render from fixtures with the title and summary
   from the per-kind field map; an unknown kind gets a generic page and a warning;
   and README links into the pack now resolve to artefact pages.
5. **DRG cross-links and backlinks** (#331). Related artefacts and "Used by" from
   graph shards and org fragments, resolved by pack, kind and id, and pack
   dependants on the pack page. *Done when*, on a fixture with at least one edge
   of every relation in the contract and an edge to an unrendered target, every
   rendered edge is a link both ways and the unrendered target is plain text that
   passes the links gate.
6. **Active charter hub** (#332). Read `.kittify/charter/charter.yaml`
   (`schema_version: 2.0.0`) and `.kittify/config.yaml`: selected packs, presets,
   overrides, and `catalog.references[]` with the tier of each, linked to
   artefact pages where they are rendered. *Done when* the hub built from a
   fixture lists each selected pack and each catalog reference with its tier, and
   doc-kitty's own site renders its active charter. Can run in parallel with
   slices 4 and 5.
7. **Git and bundle sources, publication policy** (#333). A git source pinned to a
   tag or commit, a host allowlist, offline mode, a cache, a `bundle` input, and a
   site-level allow before a private pack is published. A charter-service adapter
   behind the same `PackModel` is an option here. *Done when* a branch ref is
   refused, a tag builds, offline mode builds from the cache, and a pack marked
   private is not published without the allow.
8. **Remaining kinds, scale and aliases** (#334). Styleguides, toolguides with
   their `.guide.md` prose, paradigms, missions, skills, assets; search weighting;
   artefact pages out of RSS; `llms.txt` grouping; rename aliases into the
   redirect gate. *Done when* `foundation` renders in full and adds no more than
   60 seconds to the example build in CI, and a renamed artefact's old URL
   redirects.
9. **Several versions of a pack** (#335). A version switcher in the OpenAPI
   pattern. *Done when* two versions of a fixture pack render side by side at
   `/<section>/<dir>/<version>/` with a switcher, and the unversioned URL points
   at the newest.

Order: 1, then 2, then 3. Slices 4 and 6 can run in parallel after 3; 5 builds on
4; 7 to 9 follow. Slice 3 is the point where open-packs can switch.

## Migration of open-packs' generator

A strangler. Steps 2 and 3 are open-packs work and happen in one pull request
after the upgrade.

1. doc-kitty releases slices 2 and 3.
2. open-packs upgrades `@spec-kitty/doc-toolkit` from 0.3.0 to that release, which
   also brings four minor releases of other changes.
3. The switch:
   - record the built site's URL list (sitemap) before the change;
   - set `packs: { sources: ['../packs'], charterLock: '../charter.lock.yaml' }`;
   - delete the generated `docs/packs/<dir>.md` files before the first
     generation, since they collide with `docs/packs/<dir>/index.md` (open-packs' first `indexBasename`) on route;
   - rewrite the 19 relative links in the authored `docs/packs/index.md` (for
     example `built-in.md`) to the new files;
   - keep `docs/packs/index.md` and `catalog-proposal.md` authored; every other
     page in `docs/packs/` is a pack;
   - replace the `gen_pack_reference.py --check` steps: the one in
     `validate-packs.yml` runs in a Python-only job, so move the drift check to a
     Node job (`docs-site.yml`) and make it run on pushes to `main` as the old
     step did;
   - repoint `docs-site.yml`'s path filters from `scripts/docs/**` to `packs/**`;
   - delete `scripts/docs/gen_pack_reference.py` and
     `tests/docs/test_gen_pack_reference.py`, and update
     `tests/ci/test_workflows.py`;
   - check that the URL list after the change equals the one before.
4. open-packs decides whether to amend its ADR 2026-07-18-2 (pack reference
   generated from source) and ADR 2026-07-18-3 (build-time checksum tagging), and
   whether to keep its download checksum on the page through `extraFacts`.

The preamble-only "Purpose" becomes the whole README. Org pack pages show no hash
until open-packs generates their manifests, and `built-in`'s shows as unverified
until its manifest is regenerated.

## Cross-repository items

None is filed from this plan. On 2026-11-13 the operator approved the three
rows marked **approved** to go forward. The rest are open.

| Repository | Item | Needed by |
|---|---|---|
| open-packs | **approved**: Upgrade `@spec-kitty/doc-toolkit` 0.3.0 to the packs release and make the switch (migration steps 2 and 3, including the CI, test and link changes) | Retiring the generator |
| open-packs | Decide on ADR 2026-07-18-2 and 2026-07-18-3 and the download checksum (migration step 4) | Retiring the generator |
| open-packs | **approved**: Generate `pack-manifest.yaml` for every pack, org packs included, and regenerate `built-in`'s, as charter ADR-0042 (amended 2026-11-12) requires | A verified hash and an exact inventory on every page |
| spec-kitty-charter | **approved**: Publish the packs contract (`file-kinds.yaml`, schemas and classifier conformance cases) as a versioned release, so doc-kitty pins a release, not a commit (extends charter #45) | Slice 2 pinning, later |
| spec-kitty-charter | Annotate each artefact schema with its display fields (title, summary), so renderers stop hard-coding the per-kind field map | Slice 4, optional |
| spec-kitty-charter / core | A whole-pack read for built-in packs too (comment on charter #543 rather than file anew) | Slice 7, optional |
| spec-kitty-charter | Render the packs the charter pins (`packs/open-packs.lock.yaml`) on its doc-kitty site, if wanted | Adoption |
| spec-kitty (core) | Render the vendored built-in packs on core's doc-kitty site, once slice 3 ships | Adoption |

## Risks

See the [research](../../architecture/research/packs.md#risks) and
[ADR-0079](../../adr/0079-kitty-packs-through-a-charter-contract-reader.md#risks).
The main ones are contract churn, open-packs lagging the contract, a second
implementation of the file classification, and links that lose meaning when a
README is rendered away from its pack.
