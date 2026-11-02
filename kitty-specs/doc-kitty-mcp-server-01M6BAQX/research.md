# Research: Generic Doc-Kitty MCP Server

**Mission**: doc-kitty-mcp-server-01M6BAQX
**Date**: 2026-11-01
**Sources**: pre-spec adversarial squad (4 profile-loaded lenses, verdicts of 2026-11-01), npm registry fetches of 2026-11-01, doc-kitty repo inspection (src/lib/routes/agent-*.ts, example/dist fixtures).

## R1. MCP SDK line: v2, not v1

- **Decision**: build on `@modelcontextprotocol/server` (v2 line), pinned.
- **Evidence**: `registry.npmjs.org/@modelcontextprotocol%2Fserver` -> latest `2.4.0`, published 2026-10-23T18:20Z. `@modelcontextprotocol%2Fsdk` -> latest `1.32.2`, published the same day (maintenance line). v2.4.0: `engines: node >=20`, dependencies `{ zod: ^4.2.0, @modelcontextprotocol/core: 2.4.0 }`, exports include `.` and `./stdio` (fetch archived at /tmp/opencode/mcp-server-2.4.0.json).
- **Rationale**: the maintenance line is guaranteed only until approx. Jan 2027; a new artifact bootstrapped now on v1 would be born deprecated. The squad's one divergence (ivan: pin v1; robbie: v2 is current stable) was adjudicated from the registry, not averaged.
- **Residual risk**: hosts/clients pinned to the 2025-11-25 spec revision exist during the transition window. Recorded as Assumption in spec.md; interop matrix is deferred follow-up, not this mission.

## R2. Corpus access: snapshot-at-start, two input adapters

- **Decision**: load the full corpus once at server start and serve the snapshot from memory for the process lifetime; two adapters: `HttpCorpusSource` (HTTPS base URL) and `FsCorpusSource` (local build directory).
- **Evidence**: `example/dist/api/index.json` is metadata-only (75 KB / 68 pages); page markdown lives in `/api/pages/*.json` (few KB to 19KB per page here). Full-corpus serving is N+1 over HTTP by contract. GitHub Pages serves `max-age=600` -> a running lazy-fetching server can present a torn corpus (index of build N, page of build N+1) with no detection mechanism.
- **Alternatives rejected**: lazy per-request fetch (latency + torn-corpus trap); on-demand revalidation per request (ETag support is host-dependent and not guaranteed by the published artifact contract - GitHub Pages happens to emit ETags today, verified 2026-11-01, but a doc-kitty artifact must not depend on a host behaviour).

## R3. Torn-corpus detection: buildId in every machine artifact (amended by post-plan squad)

- **Decision**: emit `buildId` in the index AND in every per-page and scenarios artifact (the index alone cannot detect tears in the N+1 page fetches). The value is a sha256 over a canonical source-input serialization (entry id + body bytes + serialized frontmatter + generator config + toolkit version) - NOT over emitted bytes: hashing output bytes is self-referential (the index cannot contain a hash over itself) and would force the generator to re-derive sibling route outputs (split-brain inside the generator). The snapshot loader compares every loaded artifact's buildId against the index's and refuses with BUILD_IDENTITY_MISMATCH on divergence.
- **Reproducibility check**: no emitted artifact carries a build clock (`updated` is frontmatter-derived, `as_of` is content-derived), so identical sources hash identically; an explicit determinism assertion (rebuild -> identical buildId) is committed in the IC-04 verification set, not hedged.
- **Rationale**: closes the defect class structurally (DIRECTIVE_043) instead of documenting "restart your server".
- **Migration allowance**: corpora predating FR-008 (no buildId anywhere) load with a warning instead of a refusal.
- **Amendment provenance**: post-plan review (architect lens) found the emitted-bytes hash unimplementable and the index-only scope insufficient; both corrected here.

## R4. Base-URL identity for local input: rewrite at serve time (fork recorded)

- **Decision**: FsCorpusSource rewrites absolute URLs embedded in artifacts from the baked build-time origin to the caller's declared local base (`--link-base`, default: the site's declared deploy origin from the index), so clients never receive links that dereference to a stale/origin-wrong location. Rewritten field set: `links`, `source`, `url`, `_links` (enumerated in the contract carve-out; `markdown` is never rewritten - C-001 classifies re-origining as projection of link fields only, recorded in the C-004 ADR).
- **Fork recorded (reducer lens)**: emitting root-relative links from the JSON routes instead is possible (`absolute()` in src/lib/routes/shared.ts is the single chokepoint) and would delete this module, but it changes the published artifact shape for every consumer (major-sensitive) and crosses the "additive, config-gated" plan boundary. The C-004 ADR records this fork explicitly; runtime rewrite stays the v1 choice.
- **Evidence**: every `source`/`url`/`_links` value in `example/dist/api/index.json` is baked from Astro `site`+`base`; a local dist still advertises `https://spec-kitty.github.io/...` (verified by squad delegate).
- **Page identifier rule**: page identity comes from index records (`_links.self` / artifact paths), never from slug arithmetic; the home page has slug `""` mapping to `api/pages/home.json` - naive joining provably 404s (squad-verified).

## R5. MCP surface mapping: hybrid, size-gated (PENDING OPERATOR RATIFICATION)

- **Decision (recommended, Q-P1)**: hybrid - corpus pages exposed as MCP **resources** (`docs://<site>/page/<id>`) when the corpus is small enough; discovery (`list_pages`, `search_pages`, `list_scenarios`) exposed as **tools** always. Size gate: resources are listed only when the page count is <= 1000; above that the server serves tools plus template-driven resource read without listing.
- **Rationale**: tools-only (A) matches mcpdoc/Context7 prior art but loses attach ergonomics; resources-primary (B) breaks down on large corpora and variance in client resource support; C keeps best UX where affordable with one conformance harness covering both shapes.
- **Threshold rationale**: 1000 resource listings is beyond what current clients present usefully; it equals roughly 20x the example corpus, so the example exercises the resources path.
- **Status**: RULED hybrid (C) by the operator, 2026-11-01. FR-011 and the WP04 work package stand.

## R6. Distribution posture (deferred per operator ruling, C-002)

- **Decision (recorded, not executed)**: no registry publishing in this mission. Facts verified 2026-11-01: GitHub Packages npm registry requires a token even to install PUBLIC packages (GitHub Docs "Working with the npm registry": "You need an access token to publish, install, and delete private, internal, and public packages"), so it is a viable beta/org-internal channel but not frictionless public `npx`. Recommendation for the later ruling: npmjs public `@spec-kitty/` scope + provenance for public release; GitHub Packages acceptable as staging.
- **This mission delivers**: workspace package + `pnpm pack` tarball; consumption harness installing the tarball into a clean-room fixture and smoke-driving tools over stdio.

## R7. Wiring pointer emission (FR-009)

- **Decision**: the toolkit emits a machine-readable MCP wiring pointer in `/api/index.json` `_links.mcp` (`{"href": "npm:@spec-kitty/doc-kitty-mcp", "title": "...", "usage": "npx -y @spec-kitty/doc-kitty-mcp --site <self base URL>"}`), config-gated (`links.mcp`, default off until the package exists), plus a human-facing one-line mention in `llms.txt` when enabled. No server is ever generated per site.
- **Rationale**: answers the ecosystem's "per-site MCP" expectation (Mintlify/GitBook) within a static host's means; zero codegen.

## R8. Repo placement and gates

- **Decision**: new pnpm workspace member (e.g. `mcp/`) publishing package name to be confirmed at tasks time (`@spec-kitty/doc-kitty-mcp` working name); joins existing lanes: Vitest (fast unit over fixture JSON) + one serialized build-suite entry in `src/vitest.workspace.ts` BUILD_SUITES (build example once, serve dist, drive SDK client over stdio) + the `tests/consumption/` clean-room pattern for the packed tarball.
- **Constraint checks**: C-003 entry-point boundary test asserting no HTTP listener imports (fail-closed, DIRECTIVE_043); C-006 type-only coupling to the artifact contract.
- **Repo process**: one changelog fragment (`docs/changelog/unreleased/`), one ADR (next free number on `main`; .github/workflows/adr-index.yml regenerates the index after merge - do not edit docs/adr/README.md).
