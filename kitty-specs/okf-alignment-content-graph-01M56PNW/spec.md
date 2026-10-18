# Mission Specification: OKF alignment and content graph

**Mission Branch**: `feat/okf-alignment-content-graph`
**Created**: 2026-10-18
**Status**: Draft
**Input**: Issues #177, #176, #178 (in that order). Binding design: ADR-0059 (`docs/adr/0059-content-graph-and-okf-alignment.md`). Reference: OKF v0.2 specification (GoogleCloudPlatform/knowledge-catalog `okf/SPEC.md`).

## Intent Summary

DocKitty claims OKF v0.2 conformance, but three gaps break that claim:

- its metadata uses dates, email addresses and a root-only version where OKF expects UTC timestamps, actors and a declared version;
- its page relations are never published together;
- OKF readers see a DocKitty bundle as a set of unconnected pages.

This mission does three things in order:

1. It aligns the authoring metadata with OKF (#177).
2. It publishes a site-wide content graph on every build (#176).
3. It ships a conversion that turns a DocKitty tree into a plain, conformant OKF bundle (#178).

- **Primary actors:** the DocKitty adopter who authors and builds a docs site; an agent or tool that consumes the built site; an OKF consumer (Knowledge Catalog, the OKF reference viewer).
- **Trigger:** an adopter builds their site, or runs the export.
- **Outcome:**
  - the build publishes one graph file with every published page relation;
  - generated pages name the tool and version that wrote them;
  - an export produces an OKF bundle whose body links carry the same relations.
- **Invariant:** the graph, the rendered relation blocks and the export never disagree, because all three come from the same resolvers. Two builds of the same input produce identical bytes.

All operator decisions are made; they are recorded as resolved Decision Moments (see Decisions).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Metadata an OKF consumer reads without guesswork (Priority: P1)

An adopter writes or generates pages. Timestamps are UTC datetimes. Every index file declares `okf_version`. Authors and generators are named with OKF actors. Old forms keep working with a warning, so no adopter build breaks.

**Why this priority**: The graph and the export both depend on normalised fields. It is also the base of the conformance claim.

**Independent Test**: Validate the example and docs trees. Then regenerate the Gherkin and glossary pages twice and check that no bytes change. Finally, scaffold a new site and inspect the frontmatter it writes.

**Acceptance Scenarios**:

1. **Given** a page with `updated: 2026-10-18T09:30:00Z`, **When** it is validated, **Then** it passes with no warning.
2. **Given** a page with `updated: 2026-10-18`, **When** it is validated, **Then** it passes, it is read as `2026-10-18T00:00:00Z`, and the doc-sanity gate reports a warning naming the file.
3. **Given** a page whose `authors` entry is an email address, **When** it is validated, **Then** it passes with a warning suggesting `human:<id>`.
4. **Given** a feature file synced by the Gherkin generator, **When** the generator runs, **Then** the page carries `generated.by: doc-kitty-gherkin/<toolkit version>`, a UTC `generated.at` and `generated.content_hash`. **When** it runs again with unchanged input, **Then** the page bytes are identical.
5. **Given** the source content of a generated page changes, **When** the generator runs, **Then** `generated.at` and `generated.content_hash` are updated.
6. **Given** a section index without `okf_version`, **When** validated, **Then** the doc-sanity gate reports it; a newly scaffolded site carries `okf_version` on every index.

---

### User Story 2 - One request returns the whole site structure (Priority: P1)

An agent, exporter or visualizer fetches `api/content-graph.json` and gets every published page, catalog entry and persona, plus every frontmatter relation between them. It does not have to walk one JSON file per page.

**Why this priority**: It is a core ecosystem output (always on), and it is the input for the export.

**Independent Test**: Build the example site twice. Check that both builds produce identical graph bytes, that the artifact gate walks the graph from `api/index.json`, and that the edges for a sample page match its rendered Related, Audience and External references blocks.

**Acceptance Scenarios**:

1. **Given** any build, **When** it completes, **Then** `api/content-graph.json` exists and `api/index.json` links it in `_links`.
2. **Given** page A lists page B in `related`, **When** the graph is built, **Then** there is exactly one edge `{source: A-id, target: B-id, rel: "related"}`, where ids are bundle paths without `.md`.
3. **Given** page A is a draft, **When** the graph is built, **Then** A and every edge touching it are left out by the shared draft predicate, and the artifact gate does not report edges into drafts as dangling.
4. **Given** an edge target that does not exist, **When** the artifact gate runs, **Then** it fails and names the edge.

---

### User Story 3 - Export a plain OKF bundle (Priority: P2)

An adopter runs `dockitty-export-okf` and gets a plain OKF v0.2 bundle that any OKF consumer reads. Every build also emits the same bundle. In the bundle, frontmatter relations appear as body Markdown links and index files take OKF form.

**Why this priority**: It completes the conformance claim. It depends on stories 1 and 2.

**Independent Test**: Export the example site. Check that every non-reserved `.md` has frontmatter with a non-empty `type`, that every non-root `index.md` has no frontmatter, and that the root `index.md` frontmatter is exactly `okf_version: "0.2"` (every `index.md` body is a §8 entry list), using the in-repo conformance checker (FR-026). Check that the body-link edges equal the content-graph edges between pages, and that two exports are byte-identical.

**Acceptance Scenarios**:

1. **Given** page A `related` to B, **When** exported, **Then** A's body contains a generated relations section with a link `/B-path.md`.
2. **Given** a page with `doc_status: active` and `updated: …Z`, **When** exported, **Then** it carries `status: stable` and `generated.at` equal to that timestamp, following the documented mapping.
3. **Given** a section index with rich frontmatter, **When** exported, **Then** the output `index.md` is an OKF entry list with descriptions, and the original metadata survives at a documented place.
4. **Given** a draft page, **When** exported, **Then** it is absent, as are links to it.
5. **Given** a leftover email author, **When** exported, **Then** it is written as `human:<local-part>`.

### Edge Cases

- A page with no relations gets no generated relations section. No empty heading is written.
- Catalog and persona edge targets that are not pages are exported as links only where the target exists in the bundle. Otherwise they become external URLs or are omitted, and the plan decides which.
- A date-only `updated` that sorts the same as a full timestamp on the same day must keep the feed order deterministic (the slug tie-break stays last).
- `generated.at` on regeneration with unchanged content keeps its earlier value, even across a toolkit version bump. A version bump alone does re-stamp `generated.by`, once.
- The ADR index keeps its `YYYY-MM-DD` display, so the README does not churn.
- An `okf_version` value other than the string `"0.2"` is warned on, consistently in both validators (FR-023).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | UTC `updated` accepted and emitted | As an adopter, I want `updated` written as `YYYY-MM-DDTHH:MM:SSZ` and accepted by the schema and the standalone validator alike, so that OKF consumers read our timestamps. (#177) | High | Open | [build] | no |
| FR-002 | Date-only `updated` tolerated with a warning | As an adopter, I want existing date-only values read as midnight UTC with a doc-sanity warning, so that my build does not break. (#177) | High | Open | [build] | no |
| FR-003 | `okf_version` on every index | As an adopter, I want every section index to declare `okf_version` (schema, scaffold, sanity warning when missing), so that a section published on its own still declares its version. (#177) | High | Open | [build] | no |
| FR-004 | Actor convention | As a consumer, I want `authors`, `generated.by` and `verified[].by` to accept `human:<id>`, `<tool>/<version>` and `process:<id>`, with email authors still accepted but warned, so that trust tiers read correctly. (#177) | High | Open | [build] | no |
| FR-005 | Versioned, stable generator stamps | As a maintainer, I want the Gherkin, glossary and scaffold generators to write `<producer>/<toolkit version>` actors, a UTC `generated.at` that stays stable unless content changes, and the hash in `generated.content_hash`, so that generated pages are attributed and regeneration stays byte-idempotent. (#177) | High | Open | [build] | no |
| FR-006 | Generated-page detection survives versioned stamps | As a maintainer, I want every check that identifies generated pages to recognise the versioned stamp (prefix match), so that authored and generated pages keep being told apart. (#177) | High | Open | [ratchet] | no — positive control: a generated page with a versioned stamp is still exempt and an authored page is not |
| FR-007 | Tree migration | As a maintainer, I want the `docs/` and `example/` trees migrated to UTC `updated`, `human:` authors and per-index `okf_version`, so that our own sites pass with zero new warnings. (#177) | High | Open | [build] | no |
| FR-008 | `doc_status` → `status` mapping documented | As an exporter author, I want the metadata model to document how each `doc_status` maps to OKF `status`, so that the graph and the export agree. (#177) | Medium | Open | [build] | no |
| FR-009 | `updated` consumers keep working | As a reader, I want feeds, page titles, persona pages, the agent records and the ADR index to handle full timestamps, so that nothing renders or sorts wrongly. (#177) | High | Open | [ratchet] | no — positive control: a page with a full timestamp renders and sorts the same as its date-only twin |
| FR-010 | Always-on content graph | As an agent, I want every build to publish `api/content-graph.json`, linked from `api/index.json` `_links`, so that one request gives me the site structure. (#176) | High | Open | [build] | no |
| FR-011 | Graph nodes | As a consumer, I want nodes for pages (id = bundle path without `.md`), catalog entries, personas and external `resource` nodes, using OKF field names where OKF has them plus DocKitty fields, so that OKF tools can read them. (#176) | High | Open | [build] | no |
| FR-012 | Graph edges from the shared resolvers | As a consumer, I want edges `{id, source, target, rel, note?}` with `rel` in related, audience, cites, in-section and derived-from, built by the same resolvers as the rendered blocks, frontmatter only, so that the graph cannot disagree with the pages. (#176) | High | Open | [build] | no |
| FR-013 | Graph draft exclusion and determinism | As a maintainer, I want drafts and edges into them left out by the shared draft predicate (C-009), whatever the draft-publishing setting is, and the output sorted with the shared code-unit comparator and carrying a `schema` version, so that two builds are byte-identical. (#176) | High | Open | [build] | no |
| FR-014 | Artifact gate walks the graph | As a maintainer, I want the build-artifact gate to follow the graph from `_links` and fail on any edge target that does not exist, so that broken edges cannot ship. (#176) | High | Open | [build] | no |
| FR-015 | Export: relations as body links | As an OKF consumer, I want each exported page to carry its relations as `/`-prefixed Markdown links taken from the content graph, so that OKF readers see the edges. (#178) | High | Open | [build] | no |
| FR-016 | Export: OKF-form indexes | As an OKF consumer, I want exported `index.md` files to be OKF entry lists, with `okf_version` only at the root and the other index metadata preserved at a documented place, so that the bundle conforms to §8. (#178) | High | Open | [build] | no |
| FR-017 | Export: metadata mapping | As an OKF consumer, I want `doc_status`→`status`, `updated`→`generated.at` and authors→actors, plus `sources` ids where the body cites them, so that OKF trust and lifecycle fields are populated. (#178) | High | Open | [build] | no |
| FR-018 | Export: CLI and build output | As an adopter, I want both a `dockitty-export-okf` command and an always-emitted build output, with drafts excluded, so that I can export on demand and every build ships a bundle. (#178) | High | Open | [build] | no |
| FR-019 | Export conformance | As an OKF consumer, I want the export to be OKF v0.2 §11-conformant and deterministic, so that any consumer accepts it. (#178) | High | Open | [build] | no |
| FR-020 | Reference-viewer gap recorded | As a maintainer, I want the export docs to note that the OKF reference viewer skips `/`-prefixed links, with an upstream report filed (issue URL recorded), so that adopters know why the viewer may show fewer edges. (#178) | Low | Open | [build] (doc + manual evidence) | no |
| FR-021 | `verified` shape | As a consumer, I want `verified` accepted as a list or a bare `{by, at}` mapping (actor `by`, UTC `at`), normalised to a list by the graph and the export (§5.2, §11). (#177) | Medium | Open | [build] | no |
| FR-022 | `stale_after` | As a consumer, I want `stale_after` accepted as a UTC instant, validated like `updated`, and passed through to graph nodes and the export. (#177) | Low | Open | [build] | no |
| FR-023 | `okf_version` value | As a consumer, I want both validators to expect the string `"0.2"`; any other value, or an unquoted number, raises a doc-sanity warning (not a failure, per §12 best-effort), covered by the parity fixtures. (#177) | Medium | Open | [build] | no |
| FR-024 | Agent API version bump | As an agent, I want the agent-index version bumped when the serialised `updated` format changes, with the `_links` tests updated and the bump recorded in the changelog. (#177) | Medium | Open | [build] | no |
| FR-025 | Export `generated` is complete | As an OKF consumer, I want every exported concept that has `generated` to carry `generated.by` (REQUIRED, §5.2). `by` is the existing `generated.by`, or else the first `authors` actor, or else `process:dockitty-export`. `at` is the existing `generated.at`, or else `updated`. Remaining authors are kept as the DocKitty `authors` key, and `generated.content_hash` is kept as a producer extension. (#178) | High | Open | [build] | no |
| FR-026 | In-repo OKF conformance checker | As a maintainer, I want an in-repo checker asserting §11 rules 1–3 (parseable frontmatter with non-empty `type` on every non-reserved `.md`; no frontmatter in non-root `index.md`; root `index.md` frontmatter exactly `okf_version: "0.2"`; §8 entry-list bodies). Positive control: a fixture missing `type` fails. (#178) | High | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Byte determinism | Two consecutive builds of the example site produce byte-identical `api/content-graph.json` and export output (0 differing bytes); a Gherkin and glossary regeneration with no input change modifies 0 files. | Reliability | High | Open |
| NFR-002 | Validator parity | The schema and the standalone validator accept and reject the same set of `updated`, actor and `okf_version` fixtures: 100% agreement in the parity test. | Correctness | High | Open |
| NFR-003 | Zero new warnings on our trees | After migration, the doc-sanity gate reports 0 date-only, email-author or missing-`okf_version` warnings on `docs/` and `example/docs`. | Quality | High | Open |
| NFR-004 | No adopter breakage | A tree with only old forms (date-only `updated`, email authors, root-only `okf_version`) still builds and validates with exit code 0. | Compatibility | High | Open |
| NFR-005 | Consumption proof | The clean-room consumption test sees `api/content-graph.json` and one export bundle in a packed-tarball adopter build. | Reliability | High | Open |
| NFR-006 | Build cost | The graph and the always-on export add no more than 10% to the example site build wall time (measured once, not a census). | Performance | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | ADR-0059 is binding | Implementation follows ADR-0059's decisions; any departure needs an ADR amendment. | Governance | High | Open |
| C-002 | Frontmatter edges only | No glossary auto-link or body-link edges in the graph. | Scope | High | Open |
| C-003 | Shared code, no parallel authority | Draft exclusion shares the sitemap's code; ordering uses the shared code-unit comparator; edges come from the existing resolvers; the export reads the graph rather than re-resolving. | Technical | High | Open |
| C-004 | Toolkit version source | Generator versions come from the published toolkit package manifest, never from the repository root manifest. | Technical | High | Open |
| C-005 | Test economy | Per DIRECTIVE_041: strengthen existing tests first; add at most one focused test per change; never regenerate a timing census. | Process | High | Open |
| C-006 | Content gates | Page descriptions stay within 50–180 characters; the changelog entry stays within 1,200 characters. | Quality | Medium | Open |
| C-007 | Same-change baseline updates | Pinned example baselines, agent-API `_links` tests and the consumption test are updated in the same change that shifts them. | Process | High | Open |
| C-009 | Single owners for shared rules | The rules below each have exactly one owner module, and every caller imports it:<br>• the actor parse/validate rule, `updated`/instant normalisation (date plus a date-only flag) and the `doc_status`→`status` mapping are pure functions in the shared vocabulary core that both validator twins already import, so NFR-002 parity holds by construction;<br>• the generator stamp (toolkit version, stamp construction that reuses the previous `at` when the hash is unchanged, and stamp detection) has one module;<br>• the draft predicate is the publication-aware draft-route set, shared by the sitemap filter, the graph and the export.<br>Drafts are excluded from the graph and the export whatever the draft-publishing setting is. | Technical | High | Open |
| C-010 | One graph builder; export reads the built graph | One pure graph builder (next to the docs-index owner) is serialised by the route. The always-on export runs after the build, reads the built `api/content-graph.json`, and never re-resolves relations. The CLI uses the same file or the same builder. The artifact gate checks edge targets against the graph's own node set and the built paths, not a separate existence rule. | Technical | High | Open |
| C-011 | Deterministic graph keys | Nodes are sorted by `id`; edges are sorted by `(source, rel, target)` with the shared code-unit comparator; an edge `id` is derived from `source\|rel\|target`, never a counter. | Technical | High | Open |
| C-008 | Out of scope | Backlinks UI, graph visualisation, OKF import, merging the schema twins, and the rendered bibliography page. | Scope | High | Open |

### Key Entities

- **Content graph:** a versioned document listing nodes and edges for one build.
- **Node:** a page, catalog entry or persona. Its id is the bundle path without `.md`, for pages. It carries OKF-named fields plus DocKitty fields.
- **Edge:** a directed, typed relation `{id, source, target, rel, note?}`.
- **Actor:** an identity string, `human:<id>`, `<tool>/<version>` or `process:<id>`.
- **Generated stamp:** `generated: {by, at, content_hash}` on generated pages.
- **OKF bundle:** the export output, a directory tree of OKF concept documents and OKF-form index files.

## Decisions (resolved Decision Moments)

- **Generator actor:** `doc-kitty-gherkin/<toolkit version>`. `generated.at` stays stable on regeneration unless the content changes, and the hash moves to `generated.content_hash`. (01M56PPPPDNWYZKTNYAQYWWWXN)
- **Date-only `updated`:** read as midnight UTC with a warning. `docs/` and `example/` are migrated. (01M56PPSV0616KQ36E8VVK6XDG)
- **Email authors:** migrated to `human:<local-part>`. They are still accepted with a warning, and the export maps any leftovers. (01M56PPX06MDWYMBGNBYB4TAVK)
- **Export link form:** `/`-prefixed, with the viewer gap documented and reported upstream. (01M56PQ01YWH1DBQ2PGEPKV7QN)
- **Export invocation:** a CLI bin plus an always-emitted build output. (01M56PQ34KMD8F7CSHB0QP717C)
- **Drafts in the export:** excluded. (01M56PQ67AJX89DHDQ0KFYFZK5)

## Rules settled from the post-spec squad

- **`doc_status` mapping:** every `doc_status` vocabulary value maps to exactly one of `draft`, `stable` or `deprecated`, and an absent value means `stable`. A test enumerates the vocabulary.
- **Rendering each `rel` in the export:**
  - `related`, `cites` (where the target is in the bundle) and `audience` (persona pages) become body links under labelled headings.
  - `in-section` is already expressed by the index entry lists.
  - `derived-from` becomes a link under a "Derived from" heading.
  - SC-003 compares body links with the graph edges for the `rel` kinds that render as links.
- **Re-stamp on release:** a toolkit release re-stamps `generated.by` on generated pages once. This is expected, and it is outside NFR-001's "no input change" condition.
- **The root index:** the bundle-root index (DocKitty's root `README.md`) becomes the export's root `index.md`.

## Plan must decide

_Resolved in plan.md (decisions 1–6)._

- Where the export bundle lives in the build output, and whether it is a directory or an archive.
- How catalog and persona targets are linked when they are not bundle pages.
- Where preserved index metadata goes. It must not be `index.md` frontmatter, so the choice is a sidecar or a concept page.
- The source field and resolver for `in-section` and `derived-from`. The candidates are the section registry and `generated.source`/`sources`.
- Which files count as "index files" for FR-003, given the index-basename option.
- Whether `log.md` exists in the tree, and how the export handles it.

## Assumptions

- "Midnight UTC" for date-only values is applied at read time; migration rewrites the source to the explicit `T00:00:00Z`.
- `human:<id>` for migrated email authors uses the email local part.
- The build-output bundle's location and form (directory or archive) is settled at plan time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One request returns 100% of the published frontmatter relations of the example site, matching its rendered relation blocks with 0 mismatches. — [build] · no-op passable: no
- **SC-002**: An exported example bundle passes an OKF v0.2 conformance check with 0 violations. — [build] · no-op passable: no
- **SC-003**: The export's page-to-page body-link edges equal the content graph's page-to-page edges (0 missing, 0 extra). — [build] · no-op passable: no
- **SC-004**: 100% of generated pages name their tool and version. — [build] · no-op passable: no
- **SC-005**: Repeated builds and regenerations change 0 bytes. — [ratchet] · no-op passable: no
