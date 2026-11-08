# Mission Specification: OpenAPI pages, second slice

**Mission Branch**: `feat/openapi-second-slice`
**Created**: 2026-11-08
**Status**: Draft
**Input**: Epic #285 with sub-issues #257, #258, #259 and #260. Follow-up to #244 and ADR-0049. Pre-spec research: the #285 research debrief (surface matrix, bugs, related issues). Scope, the #257 entry shape and the five resolved decisions were set by the maintainer on 2026-11-08.

## Purpose

The first slice (#244) renders a supplied OpenAPI definition as reference pages. Those pages are the only HTML DocKitty makes outside the docs collection, so the agent API, content graph, OKF export and MCP corpus don't see them. Links in spec descriptions are never checked. Unreleased versions leak into the sitemap and search. In `astro dev`, the raw documents that `llms.txt` links to return 404.

This mission makes each spec version visible to agents as one entry, finishes the polish items (operation summary, version switcher, archive), widens the accepted inputs, and fixes those bugs. A site that doesn't set `openapi` must not change.

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| Spec version | One entry in the `openapi.specs` list: a definition plus a label and a released flag | "API version" when the definition's own `info.version` is meant |
| Synthetic entry | The one machine-surface record per spec version, pointing at the raw document and its sha256 | "API page" (that is the rendered HTML) |
| Raw document | The published definition file for a spec version, with its `.sha256` sidecar | "download", "source" |
| Operation page | A rendered page for one path and method | "endpoint page" |
| Archive | Spec versions discovered from tagged-release files instead of listed by hand | "history" |
| Fail-closed error | A build failure whose message starts with `[dk-openapi]` and names the spec version and cause | "warning" |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An agent finds the API contract (Priority: P1)

An agent reads `/api/index.json` (or the MCP corpus, the content graph or the OKF export) and finds one entry per spec version. The entry gives the label, released state, raw document URL and sha256, so the agent fetches the contract and verifies it.

**Why this priority**: #257 is the design gate of the epic, and agents can't see the API at all today.

**Independent Test**: Build the example with two spec versions and check each surface holds exactly two synthetic entries whose sha256 matches the published sidecar.

**Acceptance Scenarios**:

1. **Given** a site with two spec versions, **When** it builds, **Then** `/api/index.json` lists two synthetic entries and `/api/pages/*` serves one record each, linking the raw document and its sha256.
2. **Given** the same site, **When** the content graph and OKF export are built, **Then** each holds one node or record per spec version and none per operation.
3. **Given** a spec with 200 operations, **When** it builds, **Then** the agent index grows by one entry, not 200.
4. **Given** a site without `openapi`, **When** it builds, **Then** every machine surface is byte-identical to before.

### User Story 2 - A reader searches for an operation (Priority: P2)

A reader types an operation name or path into search and gets that operation's page. An agent reading `llms.txt` sees a sorted list of operations for each version.

**Independent Test**: Search the built index for a fixture operation's summary, and diff `llms.txt` across two builds.

**Acceptance Scenarios**:

1. **Given** a released spec version, **When** a reader searches an operation's summary, method or path, **Then** that operation page is a result.
2. **Given** the site opts in to the operation summary, **When** `llms.txt` is built, **Then** each version's line is followed by its operations sorted by path then method.
3. **Given** an unreleased spec version, **When** search and the sitemap are built, **Then** neither contains its pages.

### User Story 3 - A reader switches versions (Priority: P2)

A reader on an operation page picks another version from a switcher and lands on that version's reference. A site owner keeps an archive of tagged releases without listing each file.

**Independent Test**: Build a site with an archive of three tagged files, use the switcher with and without scripts, and run the accessibility check.

**Acceptance Scenarios**:

1. **Given** three or more spec versions, **When** a reader opens any API page, **Then** a labelled dropdown lists every version, marks unreleased ones in text and marks the current one.
2. **Given** scripts are disabled, **When** the reader uses the switcher, **Then** plain links reach every version.
3. **Given** an archive setting matching three tagged files, **When** the site builds, **Then** three spec versions appear in a stable order, with no hand-written entry per file.

### User Story 4 - A site owner supplies a real-world spec (Priority: P3)

A site owner points the toolkit at a multi-file definition, a Swagger 2 file or a pinned remote URL. The site builds, or fails with a clear `[dk-openapi]` error.

**Independent Test**: Build fixtures for each input type, plus broken variants of each.

**Acceptance Scenarios**:

1. **Given** a definition split across files with relative `$ref`, **When** the site builds, **Then** pages render and the bundled raw document and its sha256 are published (Resolved Decision 1).
2. **Given** a Swagger 2 file, **When** the site builds, **Then** its pages render.
3. **Given** a remote URL with a matching sha256, **When** the site builds, **Then** pages render and the definition is cached. **Given** an offline build with no matching cached copy, **Then** the build fails with a `[dk-openapi]` error. **Given** a mismatched sha256, **Then** the build fails with a `[dk-openapi]` error.
4. **Given** a `$ref` that escapes the definition's folder or can't be resolved, **When** the site builds, **Then** it fails with a `[dk-openapi]` error naming the reference.

### Edge Cases

- A spec description links to a docs page that doesn't exist: the build-time link check fails and names the operation page.
- All spec versions are unreleased: the API pages build, but search and the sitemap gain no API page.
- Archive edge cases (zero matches, bad label pattern, empty or duplicate label): fail-closed errors, see the rejected-input matrix.
- An external `$ref` cycle fails closed with the chain; internal cycles are preserved.
- An operation with no summary: the `llms.txt` line falls back to `operationId`, else `METHOD /path`.
- A spec version with zero operations: its synthetic entry exists, its `llms.txt` summary is empty, and the switcher still lists it.
- The current operation doesn't exist in the target version: the switcher lands on the target version's overview.
- `astro dev` is running: raw document URLs that `llms.txt` lists resolve, with the same bytes a build publishes.
- A based build (`base` set): synthetic entries, switcher links and raw document URLs all carry the base.

## Requirements *(mandatory)*

### Functional Requirements

Traceability: debrief bug ids refer to the "Bugs found" list of the #285 research debrief.

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Synthetic agent entry per spec version | As an agent, I want `/api/index.json` to hold exactly one synthetic entry per spec version (unreleased ones included, marked unreleased), so that I can find every contract. Each entry satisfies the full agent record and page payload shape the MCP corpus asserts: `slug`, `section`, `title`, `description`, `type`, `doc_status`, `kind`, `tags`, `priority`, `source`, `url`, `_links`, `markdown`, `keywords`, `authors`. No per-operation entries. (#257) | High | Open | [build] | no |
| FR-002 | Entry page payload | As an agent, I want `/api/pages/<section>/<label>.json` to serve the version's record, where `markdown` is a generated summary (title, label, released state, raw document link, sha256, operation list) and two explicit fields `rawDocumentUrl` and `sha256` (64 lowercase hex characters) are added. The label is the unique key. The change is additive: the contract major stays `"3"`. (#257) | High | Open | [build] | no |
| FR-003 | Content graph node | As a tool author, I want the content graph to hold one node per spec version of the existing kind `resource`, with no graph schema change. (#257) | High | Open | [build] | no |
| FR-004 | OKF export file | As a tool author, I want the OKF bundle to carry one generated markdown file per spec version, made from the same summary as FR-002. (#257) | High | Open | [build] | no |
| FR-005 | MCP corpus follows | As an agent using the MCP server, I want the spec versions to appear in its corpus because it reads the agent API, with no MCP-specific code; the MCP corpus shape assertions pass on the new entries. (#257) | Medium | Open | [folded] | no |
| FR-006 | One materialised spec list | As a maintainer, I want every surface (agent API, graph, OKF, `llms.txt`, publisher, switcher) to read one ordered list of materialised spec versions, so they can't disagree. (#285) | High | Open | [build] | no |
| FR-007 | Bytes and checksum computed once | As a site owner, I want each spec version's raw bytes (after bundling or remote fetch) and sha256 computed once at config time, and the publisher to write those exact bytes without re-reading the source, so the published file always matches its stated checksum. | High | Open | [build] | no |
| FR-008 | Served-surfaces flag | As a maintainer, I want the internal served-surfaces result to carry an `openapi` flag, false when `openapi` is unset, and not exposed in any output of a site without `openapi`. (#285) | Medium | Open | [build] | no |
| FR-009 | API page link check | As a site owner, I want a new build-time check over rendered API page HTML: relative `.md` links, root-relative links and fragment links are checked against the built site; external links are skipped. A broken link fails the build with a `[dk-openapi]` message naming the page route and the target. Links are not rewritten. (#257, debrief bug 5) | High | Open | [build] | no |
| FR-010 | Glossary autolinker excluded | As a maintainer, I want API pages kept out of the glossary autolinker, because the renderer uses its own Markdown pipeline; recorded in the new ADR. (#257) | Low | Open | [ratchet] | yes: paired with FR-001 on the same fixture, which proves API content reaches agents |
| FR-011 | Feeds excluded | As a maintainer, I want API pages and synthetic entries kept out of RSS and Atom feeds, because a spec version has no publication date and the raw document carries its own history; recorded in the new ADR. (#257) | Low | Open | [ratchet] | yes: paired with FR-001 on the same fixture |
| FR-012 | Frontmatter gate excluded | As a maintainer, I want API pages kept out of the frontmatter gate, because they are synthesised and carry no frontmatter; the spec input is validated instead (FR-021); recorded in the new ADR. (#257) | Low | Open | [ratchet] | yes: paired with FR-021 on the same fixture, which proves bad input still fails |
| FR-013 | Per-operation search kept | As a reader, I want each released operation page to be its own search result, findable by summary, method and path. (#258) | Medium | Open | [ratchet] | yes: paired with FR-015 on the same fixture, which proves unreleased pages are removed |
| FR-014 | llms.txt operation summary | As an agent, I want an opt-in key `openapi.llmsOperations` (default `false`). When on, under each version's raw document line, `llms.txt` lists one line per operation in the form `  - METHOD /path: summary`, where summary falls back to `operationId`, else is omitted (`  - METHOD /path`). When off, `llms.txt` is byte-identical to today. (#258) | Medium | Open | [build] | no |
| FR-015 | Unreleased versions unindexed | As a site owner, I want pages of unreleased spec versions absent from the sitemap and from the search index: they carry no `data-pagefind-body` and no search fragment is generated for them. The mechanism is a plan decision. (debrief bug 2) | High | Open | [build] | no |
| FR-016 | Raw documents in dev | As an author, I want raw document URLs to resolve in `astro dev` with the same bytes a build publishes. (debrief bug 1) | Medium | Open | [build] | no |
| FR-017 | Version switcher | As a reader, I want a dropdown on every API page listing all spec versions, marking the current one and unreleased ones in text. It is a native disclosure of plain links (works without scripts), enhanced by the shared disclosure control, adding no inline script and so no new CSP hash. It lands on the same operation in the target version when it exists, mapped by the renderer's slug rules including its duplicate-`operationId` suffix, otherwise on that version's overview. (#259) | Medium | Open | [build] | no |
| FR-018 | Tagged-release archive | As a site owner, I want an archive setting with a glob and a label pattern (a regular expression with one capturing group applied to the file name) to yield one spec version per matched file, `released` defaulting to `true`. (#259) | Medium | Open | [build] | no |
| FR-019 | Multi-file definitions | As a site owner, I want a definition with relative `$ref` across local files accepted and published as one bundled file with its sha256; internal cycles are preserved. The guide says the bundled bytes won't match any single source file. (#260) | Medium | Open | [build] | no |
| FR-020 | Swagger 2 input | As a site owner, I want a Swagger 2.0 file accepted; its original bytes are published and any conversion happens in memory only. (#260) | Low | Open | [build] | no |
| FR-021 | Pinned remote URL | As a site owner, I want an `https` definition URL accepted only with a sha256. Up to 5 redirects are followed; the sha256 is of the final bytes; the fetched bytes are cached under `node_modules/.cache/doc-kitty/openapi/`, keyed by sha256. This works in build, dev, sync and check. Offline mode makes no requests: it uses the cache, or fails with `[dk-openapi]`. A corrupted cache entry is refetched online or fails offline. (#260) | Low | Open | [build] | no |
| FR-022 | Input gate | As a site owner, I want the static option shape validated eagerly, and files, globs, `$ref`s and fetches validated at the config-time materialisation step, before any page renders. Each case in the rejected-input matrix (below) fails with a `[dk-openapi]` error naming the spec version and the cause. | High | Open | [build] | no |
| FR-023 | Stable ordering | As a maintainer, I want explicit specs to keep config order, archive matches sorted by POSIX relative path in code-point order and appended after explicit specs, and operations sorted by path then uppercase method, bytewise. | High | Open | [build] | no |
| FR-024 | Superseding ADR | As a maintainer, I want a new ADR that supersedes ADR-0049's surface matrix and addendum: entry shape, per-surface decisions (FR-010 to FR-012), input contract, and the deviations from the issues (feeds excluded; frontmatter gate excluded). ADR-0049's text and the ADR index table stay unedited. (#285) | High | Open | [build] | no |
| FR-025 | Docs | As an author, I want the OpenAPI guide updated (new options, §4 "What the pages show", bundled-bytes note, offline cache) and a new architecture page `docs/architecture/openapi-pages.md` describing the surface matrix. | Medium | Open | [build] | no |
| FR-026 | Upgrade notes and gate | As a consumer, I want `docs/migrations/0.6-to-0.7.md` (or the then-current migration page) to describe the new agent entries, sitemap and search changes for unreleased versions, and the opt-in keys, and the `assert-openapi-artifacts` gate updated to assert them. | Medium | Open | [build] | no |
| FR-027 | Changelog fragments | As a consumer, I want fragments under `docs/changelog/unreleased/<issue>-<slug>.md`: `257-openapi-agent-entries`, `258-openapi-llms-operations`, `259-openapi-version-switcher`, `260-openapi-inputs`, and `285-openapi-unreleased-unindexed` (section Changed). | Medium | Open | [build] | no |
| FR-028 | Input safety limits | As a site owner, I want spec inputs bounded so a broken or hostile input fails closed: `$ref` targets and archive matches are realpath-contained in their root (definition folder, site root), regular files only, symlinks resolving inside; absolute, `file://` and `http(s)` refs rejected and the parser's network resolver off; archive globs relative with no `..` and at most 200 matches; fetch timeout 30 s; response and file size at most 10 MB; YAML alias count at most 100; bounded `$ref` count and depth; remote URLs with userinfo rejected, query strings redacted in messages, no auth headers; the cache hash verified before any parse, written via a unique temp file in the same folder and renamed, never through a symlink; dev raw-document serving limited to an exact route allowlist after base-aware parsing, GET and HEAD only. Spec-derived text in DocKitty's own outputs (`llms.txt`, agent Markdown, OKF summary, switcher labels) is escaped or flattened to one line, and `javascript:`, `data:` and `vbscript:` links in descriptions fail the link check. (#260, post-tasks security review) | High | Open | [build] | no |

**Rejected-input matrix (FR-022):** unknown `openapi` version field; unparsable file; missing file; `$ref` escaping the definition's folder; `$ref` with a non-file scheme; unresolvable `$ref`; external `$ref` cycle (error lists the chain); `http` URL; remote without sha256; sha256 mismatch; more than 5 redirects; offline with no valid cache; archive glob with zero matches; label pattern invalid or without a capturing group; empty derived label; duplicate label across archive and explicit specs; any FR-028 limit exceeded (ref containment, symlink escape, absolute or `file://`/`http` ref, archive `..` or over 200 matches, timeout, size, alias count, ref depth, URL userinfo).

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Byte-stable output | Two builds of the same input differ by 0 bytes across API pages, raw documents, sidecars, `llms.txt`, the agent API, content graph and OKF export, including bundled output. | Reliability | High | Open |
| NFR-002 | Default-off | A site without `openapi` differs by 0 files and 0 bytes from its build at the merge-base, by a recursive all-files compare as consumption arm A does. | Compatibility | High | Open |
| NFR-003 | Fail-closed errors | 100% of rejected-input matrix cases fail with a message starting `[dk-openapi]` naming the spec version and cause; 0 reach a renderer stack trace. | Reliability | High | Open |
| NFR-004 | Agent index growth | Agent index entries added by OpenAPI equal the number of spec versions, for a 1-operation and a 200-operation fixture. | Scalability | High | Open |
| NFR-005 | Accessibility | 0 axe-core WCAG 2.2 AA violations in the existing `tests/a11y` suite on an overview page, an operation page and a switcher fallback (target operation missing), in light and dark. | Accessibility | High | Open |
| NFR-006 | Link integrity | The link gate reports 0 broken links on a root and a based build of the example, API pages included. | Reliability | High | Open |
| NFR-007 | Checksum truth | For 100% of synthetic entries, `sha256` equals the sha256 of the bytes served at `rawDocumentUrl`, in build and dev. | Integrity | High | Open |
| NFR-008 | Offline determinism | An offline build with a warm cache makes 0 network requests and produces output byte-identical to the online build. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Entry shape fixed | One synthetic entry per spec version on agent surfaces; per-operation agent entries are out (keeps #281 O(versions)). | Business | High | Open |
| C-002 | ADR conventions | New ADR takes the next free number; never edit ADR-0049 or the index table. | Governance | High | Open |
| C-003 | Changelog convention | Fragments only; never edit `CHANGELOG.md`. | Governance | High | Open |
| C-004 | Out of scope | #280, #281, #265, #150, #289, #299 and #300 are adjacent and not done here. | Business | High | Open |
| C-005 | Static output | No browser-side fetch of the spec and no request console, as in #244. | Technical | High | Open |
| C-006 | Bundler dependency | Bundling uses a new direct dependency on `@readme/openapi-parser` (the renderer's parser), pinned, with deterministic serialisation. | Technical | High | Open |
| C-007 | Renderer coupling | Same-operation mapping (FR-017) depends on `starlight-openapi` 0.27.0 slug rules; a renderer bump must re-run the mapping tests. | Technical | Medium | Open |
| C-008 | Owner-trusted inputs | Spec inputs are trusted like the site's Markdown: renderer HTML is not sanitised and private or intranet hosts are allowed for remote URLs; integrity comes from the sha256 pin and FR-028 bounds failures. Recorded in the new ADR. | Security | High | Open |

### Key Entities

- **Spec version**: label (unique key), released flag, input (local file, local tree, archive match or remote URL), raw bytes, sha256, raw document URL.
- **Synthetic entry**: the agent record, graph node and OKF file for one spec version.
- **Operation**: path, method, summary, operationId; feeds search, the switcher and the `llms.txt` summary.

## Resolved Decisions

The maintainer chose these on 2026-11-08; each is recorded as resolved in the mission's decision log.

1. **Raw document for multi-file specs (#260).** The bundled single file is published with its sha256. The guide states that the bundled bytes won't match any single source file.
2. **Remote URLs (#260).** A sha256 is required. The fetched definition is cached on disk. An offline build uses the cache, or fails closed with a `[dk-openapi]` error when there is no matching cached copy.
3. **Archive input (#259).** A glob pattern, with each spec version's label taken from the file name by a label pattern.
4. **Unreleased versions on agent surfaces.** They get synthetic entries, marked unreleased. They stay out of the sitemap and search (FR-015).
5. **Version switch target (#259).** The same operation when it exists in the target version, otherwise that version's overview.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of spec versions, an agent obtains and verifies the contract in at most 2 GETs including the agent index (index, then raw document). — [build] · no-op passable: no
- **SC-002**: Across agent API, MCP corpus, content graph and OKF bundle, 100% of spec versions appear exactly once on every surface, with the same label and sha256. — [build] · no-op passable: no
- **SC-003**: A reader switching versions from an operation page lands on the same operation in 100% of cases where it exists in the target version, with and without scripts. — [build] · no-op passable: no
- **SC-004**: An existing site that sets no `openapi` upgrades with 0 changed output files. — [ratchet] · no-op passable: yes: paired with SC-002 on the example, which proves the feature changed output there

## Assumptions

- The renderer already parses multi-file `$ref`, Swagger 2 and URLs; the work is DocKitty's gate and contracts.
- Raw documents in dev may be served by middleware rather than written to disk, as long as bytes match.
- The `llms.txt` operation summary is off by default to keep existing `llms.txt` output stable.
- The `resource` node kind already exists in the content graph, so FR-003 needs no schema change (verified in `src/lib/docs-index.ts`).

## Dependencies and sequencing

- FR-006 and FR-007 (materialised list, bytes once) come before FR-001 to FR-004 and FR-016.
- #265 (llms preamble) should land before FR-014 touches `llms.txt`.
- See #280 (same agent-page and OKF code) and #281 (sharding).
