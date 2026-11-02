# Mission Specification: Generic Doc-Kitty MCP Server

**Mission Branch**: `feat/doc-kitty-mcp-server` (topic branch off `main`)
**Created**: 2026-11-01
**Status**: Draft
**Input**: User description: "Start a mission to create an MCP service based on the doc-kitty contents. It should be generic, and able to take a doc-kitty endpoint as input. Shape decided by a pre-spec research/architecture squad: one generic runtime MCP service (Shape A), not a per-consumer template factory (Shape B)."

## Design basis: pre-spec adversarial squad (2026-11-01)

A bounded pre-spec squad (adversarial-squad-deployment procedure; lenses: researcher-robbie, architect-alphonso, planner-priti, implementer-ivan) investigated the shape question. Verdict summary, all four lenses unanimous:

- **Shape A wins**: one generic runtime MCP server, configured at runtime with a doc-kitty endpoint; not a build-time template factory. B was rejected as a guaranteed second interpretation of the corpus (stamp-at-template-version vs the moving published contract) and an untestable-by-construction N-fork maintenance tail. A configure-only wrap of A is deferred until at least 3 real consumers demand it.
- **Stack**: TypeScript on Node 22, ESM, inside this pnpm workspace; MCP SDK v2 (`@modelcontextprotocol/server`, verified current on 2026-11-01; v1 line `@modelcontextprotocol/sdk` is maintenance-only through approx. Jan 2027).
- **Fencing preconditions** the spec must honor: pass-through-only semantics (projection of published fields is legal; derivation/ranking/summarization is not), fail-closed on unknown contract major via the index `version` field, snapshot-at-start loading, no HTTP listener code in v1, one pinned runtime dependency with a supply-chain gate.
- Ecosystem check (2026-11-01): generic runtime-configured fetchers are the observed shipping pattern (mcpdoc, GitMCP, Context7 npm package); per-site codegen has no visible prior art.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent reads a deployed doc-kitty site over MCP (Priority: P1)

A developer uses an AI agent client that supports MCP. They paste one config snippet naming the MCP server command and a doc-kitty site's base URL. During a session, their agent lists the site's sections and pages, finds the relevant page, and reads its full markdown content, without the developer hand-fetching files.

**Why this priority**: This is the core value: zero-friction agent interoperability with any deployed doc-kitty site. It is the MVP and the mission's reason to exist.

**Independent Test**: Configure an MCP client (or an in-process SDK client harness) against the server pointed at a statically served build of the `example/` site; ask for the page list and one page's content; the answers byte-derive from the published artifacts.

**Acceptance Scenarios**:

1. **Given** the server is started with a valid doc-kitty site base URL, **When** an MCP client connects and invokes the page-listing tool, **Then** every section and published page appears with its metadata, in section registry order.
2. **Given** a connected client, **When** the client requests a specific page by its identifier, **Then** the response contains that page's raw markdown and frontmatter metadata, matching the published per-page artifact.
3. **Given** a connected client, **When** the client asks to find pages matching a topic term, **Then** results come only from the published title/description/keywords fields, with no invented content.

---

### User Story 2 - Agent reads a local, undeployed build (Priority: P2)

A docs author builds a doc-kitty site locally (`astro build` output directory) and wants their agent to read it before publishing. They start the MCP server with a directory path instead of a URL. Every tool behaves the same as over HTTP, and links embedded in answers resolve relative to the local source, not to the build-time baked origin.

**Why this priority**: The normal authoring loop is "write, build, check locally", and the published artifacts carry absolute build-time URLs that are wrong for local use. Without this story the server only works on deployed sites.

**Independent Test**: Point the server at the `example/` build output directory without any web server running; all P1 scenarios pass identically, and embedded URLs dereference against the local source.

**Acceptance Scenarios**:

1. **Given** a local build directory input, **When** a client lists pages, **Then** results match the directory's index artifact, with no network access required.
2. **Given** a local build directory input, **When** a page response contains absolute links, **Then** those links resolve against the local source rather than the build-time origin.

---

### User Story 3 - Consumer wires the server from a pointer on their own site (Priority: P3)

A doc-kitty consumer publishes their site. Visiting agents (or their humans) find a single, copy-pasteable wiring snippet advertised in the site's `llms.txt` and machine index, telling any MCP client how to launch the generic server against that site. No consumer-specific server is ever generated.

**Why this priority**: Mintlify and GitBook set the ecosystem expectation that "docs sites have MCP". Doc-kitty's static host cannot host a server, so the counter is a discoverable wiring pointer. P3 because the server must exist first.

**Independent Test**: Build the `example/` site and inspect the emitted `llms.txt` and machine index for the MCP pointer block; execute the advertised snippet and confirm the launched server answers a page query. Within this mission the advertised form is the packed-tarball artifact (registry publishing deferred per C-002); the registry form is asserted textually only.

**Acceptance Scenarios**:

1. **Given** a doc-kitty site build with the pointer feature enabled, **When** an agent reads its `llms.txt` or machine index, **Then** a launch snippet for the generic MCP server is present and correct for that site's base URL, and executing it against the in-repo tarball artifact yields a working server.

---

### Edge Cases

- A site whose machine index declares an unknown contract major version: the server must refuse loudly with a named error, not misparse silently.
- The endpoint becomes unreachable mid-session: one documented retry policy, then an explicit refusal; never a hang.
- A site that gated its per-page artifact links off: the server degrades to index-only tools and says so, instead of 404ing per page.
- A redeploy happens between server starts: the corpus snapshot pins one build for the process lifetime; the index gains a build-identity field so a torn read (index from build N, page from build N+1) is detectable.
- A private (non-public) site: covered only by the local-directory input; no hosted auth mechanism exists in v1.
- A very large corpus (thousands of pages): snapshot loading stays inside the memory threshold in NFR-002.
- A site whose home page has an empty slug: page identifiers come from the index records, never from mechanical slug-to-path joining (a naive join provably 404s on the home page).
- A site whose home page record carries an empty section value (true today): sections are emitted into the index from the section registry by this mission's contract addition, and the server tolerates the legacy empty value by mapping it to the site's root section.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Endpoint runtime parameter | As a docs consumer, I want to point one MCP server at any doc-kitty site's base URL at launch time, so that one published artifact serves every site. | High | Open | [build] | no |
| FR-002 | Local directory input | As a docs author, I want to point the server at a local build output directory, so that I can read undeployed docs with the same tools. | High | Open | [build] | no |
| FR-003 | Read-only discovery tools | As an agent client, I want tools to list sections and pages, fetch one page's metadata and raw markdown, and list Gherkin scenarios when present, so that I can navigate any doc-kitty corpus. Sections come from the published machine index; this mission therefore also extends that index with a sections listing emitted from the section registry. | High | Open | [build] | no |
| FR-004 | Topic matching over published fields | As an agent client, I want to find candidate pages by matching my term, case-insensitively, against the published title, description and keyword fields (keywords from the per-page artifacts) and receive matches in published registry order capped at 25, so that I can locate reading material without enumerating the corpus. Output order is registry order, never relevance ranking. | Medium | Open | [build] | no |
| FR-005 | Contract version handshake | As a consumer, I want the server to read the index's contract version first and refuse with a named error on an unknown major, so that a silent misparse never presents wrong data as docs. | High | Open | [build] | no |
| FR-006 | Snapshot consistency | As a consumer, I want one server process to serve exactly one corpus build, loaded at start, so that answers never mix two deployments of the same site. | High | Open | [build] | no |
| FR-007 | Base-URL rewrite for local input | As a docs author, I want links embedded in answers from a local build to resolve against that local build, so that baked build-time origins do not mislead. | Medium | Open | [build] | no |
| FR-008 | Corpus build identity | As a consumer, I want every published machine artifact (index, per-page artifacts, scenarios listing) to carry the same build-identity value computed from source inputs, and the server to compare it across everything it loads, so that a torn corpus read is detected and refused, not invisible. | Medium | Open | [build] | no |
| FR-009 | Wiring pointer emission | As a doc-kitty consumer, I want my built site to advertise the MCP launch wiring in its machine-facing documents; within this mission the advertised form launches the packed tarball artifact, and the registry form is documented but activates only after the deferred publishing ruling. | Low | Open | [build] | no |
| FR-010 | Byte-derivation conformance | As a maintainer, I want an automated check that every output field of every tool (and every resource body, where FR-011 applies) byte-equals the expectation computed in-test by independently re-reading the example build's artifacts through the documented projection - output-generated goldens are excluded - run fresh against the built example, in both input modes; in the local-directory mode the conformance rule is byte-identity for content fields plus assertion of the documented link rewrite for link fields. | High | Open | [build] | yes - paired positive control: the same suite asserts a canonical page body round-trips unchanged, on the same fixture |
| FR-011 | Size-gated resource surface (Q-P1 ruled HYBRID by operator 2026-11-01) | As an agent user, I want corpus pages addressable as MCP resources when the corpus is small, so that I can attach pages directly; above a configurable page-count threshold (default 1000) listing is omitted, tools remain the discovery path, and tool outputs carry resource URIs so read-by-URI stays reachable. | Medium | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Start latency | From launch to ready: at most 5 seconds on the local-directory input and at most 15 seconds against HTTPS on the 68-page example corpus; at most 60 seconds against HTTPS on a 1000-page corpus (the resource-listing threshold) with bounded fetch parallelism of at least 8. | Performance | High | Open |
| NFR-002 | Memory bound | Resident memory stays under 512 MB while serving a 10,000-page corpus snapshot; verified by measuring per-page snapshot cost at example scale, extrapolating in a documented note, and promoting to a real synthetic 10k fixture when a consumer approaches that scale (no fixture machinery built in this mission). | Resource | Medium | Open |
| NFR-003 | Supply-chain surface | Exactly one new declared runtime dependency: `@modelcontextprotocol/server`, pinned to an exact version. Total new lockfile entries introduced (declared plus transitive) at most 5. Zero install scripts in the closure, asserted by a CI check that packs the package and audits its closure. Validator needs are met by hand-rolled presence/shape guards, not an imported schema library. | Security | High | Open |
| NFR-004 | Protocol compatibility | Tools respond successfully to an in-process client built only from the pinned SDK, and an explicit, documented error class exists for clients older than the supported spec revision; the supported revision is named in the README. | Compatibility | Medium | Open |
| NFR-005 | Failure behavior | Every failure mode (unreachable endpoint, malformed artifact, unknown contract major, gated-off page links) produces a named, typed error visible to the client within the retry policy's bounds; no failure manifests as a hang or as fabricated content. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Charter scope: discovery only | The server is a pass-through protocol adapter over already-published artifacts: selection and projection of published fields is legal; derivation, ranking, summarization and any server-side search/embedding index are prohibited (charter: "discovery, not retrieval"). | Governance | High | Open |
| C-002 | No registry publishing in this mission | The mission delivers the workspace package and a pack/install consumption test only. The npm-scope, provenance and registry-listing decision is deferred to a release-engineering ruling. GitHub Packages was evaluated (2026-11-01): its npm registry requires a token even to install public packages, so it is a viable internal/beta channel but not a frictionless public `npx` channel. | Governance | High | Open |
| C-003 | stdio-only transport | v1 ships no HTTP listener code at all; remote hosting is a separate mission requiring its own charter ruling. | Technical | High | Open |
| C-004 | ADR before merge | An ADR records the Shape A decision, the Shape B rejection and its re-trigger condition, and the pass-through invariant, before the mission merges (repo rule: structural decisions are ADRs). | Governance | High | Open |
| C-005 | One toolchain | The implementation lives in the repo's existing Node 22 / TypeScript ESM / pnpm workspace; no second language toolchain or CI lane class. | Technical | High | Open |
| C-006 | Single canonical interpretation | The server must not re-derive corpus meaning from raw docs sources; it consumes only the generated artifacts (and reads types only, at build time, from the toolkit's contract definitions). | Technical | High | Open |

### Key Entities *(include if the mission involves data)*

- **Corpus snapshot**: the full set of site discovery artifacts loaded once at server start; identity carries site title, base URL, contract version and build identity.
- **Page record**: one page's published metadata (section membership, order, title, description, keywords, links) plus its raw markdown body from the per-page artifact.
- **Contract version**: the machine index's version field; the server's compatibility handshake input.

## Assumptions

- The squad-chosen SDK (v2 line) covers the clients doc-kitty consumers realistically use; interop with hosts pinned to the previous spec revision is documented but not measured in this mission (a noted spike, not acceptance).
- The example site build (`example/dist`) is available in CI for fixture-backed verification, consistent with the repo's existing build test lanes.
- Consumers' static hosts serve the artifacts over standard HTTPS; authentication-fronted docs sites are served by the local-directory input path only.

## Out of scope

- Any hosted, remote or multi-client MCP service (HTTP transport), in any form.
- Semantic search, embeddings, or any server-side retrieval index.
- Generation of consumer-specific MCP servers (template/factory; rejected by the squad, re-trigger recorded in the ADR of C-004).
- Registry publishing of the server package (deferred per C-002).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with a conformant MCP client goes from "never heard of a doc-kitty site" to their agent reading that site's pages, using one config snippet of at most 5 lines, in under 15 minutes; within this mission the snippet installs the packed tarball produced by the build. — [build] · no-op passable: no
- **SC-002**: In an automated harness, `search_pages` returns every page whose published fields mention the probe term (recall floor: result set equals the independently computed expectation over the corpus) and returns nothing else (precision: every hit byte-traceable), including the discriminating controls: a term present only in a published keyword produces a hit; a term present only in page bodies produces zero hits. — [build] · no-op passable: no
- **SC-003**: 100% of tool responses and resource bodies in the conformance run against the freshly built example byte-equal the independently computed expectation per the documented projection (FR-010), over the minimum matrix: all 5 tools, a page sample including the empty-slug home page, a terms-known case for matching, both input modes, and a link-set-gated run. — [build] · no-op passable: no
- **SC-004**: Every entry of the failure matrix - UNKNOWN_CONTRACT_MAJOR (also with a non-numeric version fixture), UNREACHABLE_ENDPOINT, MALFORMED_CORPUS, PAGES_LINKS_GATED, BUILD_IDENTITY_MISMATCH (mixed-identity fixture with identity emission enabled), PAGE_NOT_FOUND - surfaces its named error on first reproduction, with zero hangs and zero fabricated answers. — [build] · no-op passable: no
