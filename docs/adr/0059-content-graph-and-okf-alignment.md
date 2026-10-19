---
title: "ADR-0059: A published content graph, and alignment with OKF v0.2"
description: Every build publishes api/content-graph.json of frontmatter relations; metadata adopts OKF UTC timestamps, actors and per-index okf_version; export converts.
doc_status: active
updated: 2026-10-18T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0009-finalize-metadata-contract
  - adr/0018-citation-catalog-collections
  - adr/0046-gherkin-feature-pages
  - adr/0049-openapi-reference-via-existing-integration
  - adr/0058-build-state-owner-and-config-split
  - architecture/metadata-model
external_references:
  - url: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
    title: Open Knowledge Format (OKF) specification, v0.2
---

# ADR-0059: A published content graph, and alignment with OKF v0.2

## Status

Accepted. This ADR records the decisions behind
[#176](https://github.com/spec-kitty/doc-kitty/issues/176) (the content graph),
[#177](https://github.com/spec-kitty/doc-kitty/issues/177) (metadata alignment)
and [#178](https://github.com/spec-kitty/doc-kitty/issues/178) (the OKF export).
It decides the direction. The implementation lands with those issues.

## Context

DocKitty bundles claim OKF v0.2 conformance (`okf_version: "0.2"`). Pages
declare their relations in frontmatter (`related`, `audience`,
`external_references`, `sources`), and the build shows them per page and in the
per-page agent JSON. Nothing publishes them together, so:

- **A consumer pays for one file per page.** An agent, an exporter or a
  visualizer that wants the site's structure fetches `api/index.json` and then
  one JSON file for every page.
- **There are no backlinks.** A page cannot show who links to it, because
  nothing holds the reverse edges.
- **OKF readers see no relations.** OKF's graph is the untyped Markdown links in
  page bodies (spec §6.1), and it defines no graph or manifest file (§3.1). The
  OKF reference viewer builds its graph from body links alone, so a DocKitty
  bundle looks to it like a set of unconnected pages.

Our metadata also differs from OKF where we claim to follow it:

- `updated` is a date. OKF writes timestamps as UTC datetimes and records the
  last content change in `generated.at` (§5, §5.2).
- `okf_version` sits only in the root `README.md`.
- `authors` are email addresses, and generated pages say `doc-kitty/gherkin`
  with no version. OKF names actors as `human:<id>`, `<tool>/<version>` or
  `process:<id>` (§7), and its trust tiers depend on the `human:` prefix (§5.3).

## Decision

1. **Every build publishes `api/content-graph.json` (#176).**
   - **Always on.** It is a core part of the DocKitty ecosystem, not an option.
   - **A static route** next to `api/index.json`, built by the same resolvers
     as the Related, Audience and External references blocks, so it cannot
     disagree with the pages. `api/index.json` links it in `_links`, so the
     artifact gate checks every edge target.
   - **Shaped for OKF tools.** A page node's `id` is its bundle path without
     `.md`, as in the OKF reference viewer. Node fields use OKF names where OKF
     has them (`type`, `title`, `description`, `resource`, `tags`, `status`,
     `generated`, `verified`, `stale_after`, `sources`), plus DocKitty fields.
   - **Edges** are `{ id, source, target, rel, note? }`. `rel` is one of
     `related`, `audience`, `cites`, `in-section` or `derived-from`. A reader
     that ignores `rel` still gets OKF's untyped directed edge.
   - **Frontmatter edges only.** Glossary auto-links and body links stay out
     for now; they may be added later.
   - **Same build guarantees as the sitemap.** Drafts and the edges into them
     are left out by the sitemap's rule, and the output is sorted so two
     builds produce the same bytes. The file is plain JSON with a `schema`
     version field.
2. **`updated` becomes a UTC timestamp (#177).** The format is
   `YYYY-MM-DDTHH:MM:SSZ`. Generated pages write the full timestamp. The
   implementation decides how existing date-only values are read.
3. **Every index file carries `okf_version` (#177).** Each section index, not
   only the root, carries it, so a section that is moved or published on its
   own still declares its version. This goes beyond OKF, which allows
   frontmatter in `index.md` only at the bundle root (§8, §12). The authoring
   format keeps its richer index frontmatter. Converting it is the export's job
   (decision 5).
4. **Authorship follows OKF's actor convention (#177).** `authors`,
   `generated.by` and `verified[].by` use `human:<id>`, `<tool>/<version>` or
   `process:<id>`. DocKitty pages are often written by agents and deterministic
   tools, such as the Gherkin sync and the coming OpenAPI sync
   ([ADR-0049](./0049-openapi-reference-via-existing-integration.md)). Those
   tools record themselves with their version. A page a human reviewed carries
   a `human:` entry in `verified`, so OKF's trust tiers read it correctly.
5. **The OKF export produces a plain OKF bundle (#178).** It is a conversion
   step, not the authoring format:
   - it writes each page's frontmatter relations into the body as Markdown
     links, taking them from the content graph;
   - it converts index frontmatter into OKF-form `index.md`, keeping
     `okf_version` only at the root;
   - it maps `doc_status` to OKF `status`, and `updated` to `generated.at`.

## Consequences

### Positive

- One request gives an agent or exporter the whole site's structure, and
  backlinks become a reverse lookup.
- OKF tools can read the graph file, and the export makes our relations visible
  to any OKF reader.
- Generated pages say which tool and version wrote them, which helps trust and
  debugging.

### Negative

- Every adopter's build gains a file, and the pinned example baselines and
  agent-API `_links` tests change with it.
- Moving `updated` to a timestamp and authors to actors touches every existing
  page. The schema, the validator, the scaffold and the generators all change.
- Per-index `okf_version` departs from the letter of OKF §8, so a raw DocKitty
  tree is not a strict OKF bundle. The export is what is strictly conformant.

### Risks

- **The graph drifting from the pages.** Building it with the shared resolvers,
  and checking it with the artifact gate, keeps it in step.
- **Link form.** OKF recommends `/`-prefixed bundle links (§6.1), but the
  reference viewer skips them. #178 decides which form the export writes.

## Alternatives considered

### A JSON-LD graph

Nothing in OKF calls for JSON-LD, and no consumer of ours needs it. A plain,
versioned JSON file matches the other `api/*.json` files.

### Include glossary and body links now

Body links are only known after rendering, which would turn the route into a
post-build step. Deferred until a consumer needs them.

### Make the graph optional

The graph is part of what DocKitty is for, and it costs little. An option would
also leave some sites without the export's input.

### Keep frontmatter relations only, and no export conversion

OKF readers would keep seeing unconnected pages, which defeats the purpose of
claiming OKF conformance.

## References

- [OKF v0.2 specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md):
  §3.1, §5, §6.1, §7, §8, §11 and §12.
- [Metadata model](../architecture/metadata-model.md).

## Implementation notes (2026-10-18)

These notes record what the implementation settled. The decisions above are
unchanged. ADR-0059 had not reached `main` when they were written, so this
completes the ADR rather than amending an accepted one.

### Plan decisions

1. **Export location.** The bundle is a directory, `dist/okf/`, written in
   `astro:build:done` from `dist/api/content-graph.json` and the source tree.
   There is no archive. The sitemap does not list the bundle. The CLI
   (`dockitty-export-okf`) writes the same layout to `--out`.
2. **Catalog and persona links.** Personas are pages and link as bundle paths.
   A catalog citation links to the entry's `url` as an external link. An entry
   with no URL is kept as a `sources` entry and not linked. Catalog entries are
   never invented as bundle files.
3. **Sidecar.** The original frontmatter of each non-root index is saved
   verbatim in `_index.meta.yaml` next to the exported `index.md`.
4. **Sources of `in-section` and `derived-from`.** `in-section` points from a
   page to its nearest published ancestor index. `derived-from` comes from
   `sources[].resource`: the target is a page when the resource is one, else a
   `resource:` node.
5. **Index basenames.** An index file is one whose basename is in the site's
   configured `indexBasename` (default `README`), the same rule that drives
   routing.
6. **`log.md`.** The name is reserved. A source `log.md` is copied unchanged and
   none is generated.

### Index entry form

The exported index lists entries as `- [Title](/path.md) - description`.

### Generated stamps

- **The glossary generator is now stamped.** Glossary pages carry a `generated`
  block like the Gherkin pages. This overrides the glossary generator's earlier
  rule that its output carries no stamp.
- **`generated.at` changed meaning.** It was a content hash (`sha256:…`). It is
  now the UTC instant of the last content change, and the hash moved to the
  DocKitty extension `generated.content_hash`. `at` only moves when the hash
  moves, so regeneration over unchanged input is byte-stable, including across
  a toolkit version bump, which re-stamps `generated.by` once. A legacy
  `sha256:` value in `at` is still read.
- **`generated.by`** is `<producer>/<toolkit version>`. The legacy
  `doc-kitty/gherkin` value is still recognised.
- **The scenarios API keeps `generated_from`.** `api/scenarios.json` keeps
  `generated_from: doc-kitty/gherkin`, so adopters that read it see no change.
- **The scenarios API adds `generated_by`** (#182): `doc-kitty-gherkin/<version>`, an OKF tool actor; `generated_from` stays byte-identical but is deprecated and goes in the next breaking release.

### Agent API

`api/index.json` reports `version: "3"` (it was `2`). The bump covers the
`_links.contentGraph` entry and the UTC `updated` instants and actor `authors`
in the page records. See the [content graph reference](../architecture/content-graph.md)
and the [export guide](../guides/export-okf-bundle.md).

**Implementation note (0.4.0, #183, #210):** the legacy `sha256:` `at` reading and the unversioned `doc-kitty/gherkin` / `doc-kitty/glossary` stamps above are retired (a retired stamp now fails the frontmatter gate with a regenerate message), and `api/scenarios.json` dropped `generated_from` and moved to `version: "2"`.
