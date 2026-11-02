---
title: "ADR-0073: One generic MCP server over published artifacts"
description: One runtime-configured MCP server consumes any DocKitty site's published artifacts over stdio; per-consumer codegen is rejected with a recorded re-trigger.
doc_status: active
updated: 2026-11-02T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0043-toolkit-package-scope-and-self-reference
  - adr/0058-build-state-owner-and-config-split
  - architecture/generators
  - guides/mcp-server-quickstart
---

# ADR-0073: One generic MCP server over published artifacts

## Status

Accepted

## Context

Agent interoperability is one of the four chartered outcomes of this toolkit,
and the ecosystem now equates it with "the docs site has MCP". The two visible
patterns on 2026-11-01 split on hosting power: Mintlify and GitBook host one
MCP server per site, which a static host (GitHub Pages) cannot do; generic
runtime-configured fetchers are the observed shipping pattern for everyone
else (mcpdoc, GitMCP, the Context7 npm package). A pre-spec adversarial squad
(four profile-loaded lenses, verdicts of 2026-11-01) investigated the shape
question and returned a unanimous verdict for Shape A: one generic runtime
server, configured at launch with a doc-kitty endpoint, rather than Shape B, a
build-time template factory generating one server per consumer.

Mission `doc-kitty-mcp-server-01M6BAQX` (spec of 2026-11-01, implementation
2026-11-01/02) shipped Shape A. Its constraint C-004 makes this record a hard
merge gate. The squad evidence is filed in the mission's
`squad-dispositions.md` and is cited here, not retold.

Two distribution facts shaped the outcome: registry publishing was deferred by
operator ruling (C-002), and GitHub Packages was evaluated as the candidate
channel on 2026-11-01: its npm registry requires an access token even to
install public packages (GitHub Docs, "Working with the npm registry"), so it
works as an internal or beta channel but never as a frictionless public `npx`
form.

## Decision

1. **One generic runtime MCP server ships (Shape A), not a per-consumer
   template factory (Shape B).** The `mcp/` workspace member publishes
   `@spec-kitty/doc-kitty-mcp` (`private: true` in this mission) with bin
   `doc-kitty-mcp`, configured at launch with `--site <url>` or `--dir
   <path>`; one artifact serves every site. Shape B is rejected because a
   generated server freezes an interpretation of the corpus at template stamp
   time while the published artifact contract keeps moving (a guaranteed
   second interpretation; config-as-codegen), and its N-fork maintenance tail
   is untestable by construction. **Re-trigger**: the question reopens only
   when at least 3 real consumer demands for it are on record, and only as a
   thin configure-only wrap over this server - never per-site codegen.
2. **The pass-through invariant holds (C-001).** The server is a
   protocol adapter over already-published artifacts: selection and projection
   of published fields is legal; derivation, ranking, summarization and any
   server-side search or embedding index is prohibited. It is enforced by
   construction, not convention: `search_pages` matches case-insensitively
   over the published title, description and keyword fields only and returns
   registry order capped at 25 (`SEARCH_MATCH_CAP`) with no scoring, and the
   FR-010 conformance suite recomputes every expected byte in-test from a
   freshly built example corpus in both input modes, so any derivation fails
   the suite.
3. **The transport is stdio-only (C-003).** No HTTP listener code ships in
   v1. A boundary test scans the built `dist` graph and fails on any HTTP
   listener import (its red state was demonstrated by seeding one). Remote
   hosting is a separate mission requiring its own charter ruling.
4. **Exactly one pinned runtime dependency (NFR-003).**
   `@modelcontextprotocol/server` is exact-pinned at 2.4.0 (the v2 line; the
   squad's v1/v2 divergence was adjudicated from the npm registry on
   2026-11-01: v1 is maintenance-only through approximately 2027-01). A
   pack-closure audit (`mcp/scripts/audit-closure.mjs`, wired into CI) asserts
   at most 5 new attributable lockfile entries and zero install scripts;
   reality is 2 (server plus core; zod dedupes against the toolkit's existing
   pin). Artifact validation is hand-rolled presence and shape guards; no
   schema library is imported.
5. **One canonical interpretation, coupled by types only (C-006).** The
   toolkit exports a dependency-free contract module
   (`@spec-kitty/doc-toolkit/contract`) and the three artifact routes are
   retyped against it, so a field the contract declares but a route stops
   emitting is a build-time type error. The reverse direction is guarded by a
   test, not by tsc: the page and index routes spread `toAgentRecord()`, whose
   parallel `AgentRecord` type bypasses excess-property checks, so
   `agent-api-build-identity.test.ts` walks the built example's index, pages
   and scenarios and fails on any emitted key the contract does not declare. The server imports those types only and
   never reads documentation sources.
6. **Corpus build identity detects torn reads (FR-008).** Every machine
   artifact (index, per-page payloads, scenarios) carries `buildId`, a sha256
   over a canonical source-input serialization (never over emitted bytes,
   which would be self-referential). The snapshot loader compares every loaded
   artifact's value against the index's and refuses with
   `BUILD_IDENTITY_MISMATCH` on divergence; corpora predating FR-008 load with
   a warning.
7. **Local-input link identity is fixed at serve time, not at emission (the
   R4 fork).** `FsCorpusSource` re-origins exactly the link fields (`links`,
   `source`, `url`, `_links`) from the baked build-time origin to the caller's
   `--link-base` (default: the site's declared deploy origin from the index);
   `markdown` is never rewritten, because re-origining is classified as
   projection of link fields. Emitting root-relative links from the JSON
   routes instead was rejected for v1: it changes the published artifact shape
   for every existing consumer (major-sensitive) to serve a server-side
   convenience, and crosses this mission's additive, config-gated boundary.
8. **The resource surface is hybrid and size-gated (Q-P1, ruled by the
   operator 2026-11-01).** Corpus pages are MCP resources
   (`docs://<site-slug>/pages/<id>`) when the corpus is at or below the
   listing threshold (default 1000, overridable with
   `--resource-threshold`); above it, `resources/list` omits pages, tools
   remain the discovery path, tool outputs carry each page's `uri`, and a
   resource template keeps read-by-URI reachable. The site slug derives by one
   pinned rule, so two servers over the same site mint identical URIs.
9. **Registry publishing is deferred (C-002).** The package ships
   `private: true`; this mission distributes the `pnpm pack` tarball, proven
   by a clean-room install test that drives the installed bin over stdio. The
   opt-in wiring pointer (`_links.mcp` in `/api/index.json` plus one line in
   `llms.txt`, `links: { mcp: true }`, default off) advertises the tarball
   launch form only; no `npx -y @spec-kitty/...` form is advertised anywhere.
   The pointer's `href` (`npm:@spec-kitty/doc-kitty-mcp`) is a reserved
   identifier, not an installable package: the package stays private until
   publishing is decided, so consumers follow `usage`, not `href`. The flag is
   set separately on the two routes, `links.mcp` on `agentIndexRoute` for
   `_links.mcp` and `links.mcp` on `llmsTxtRoute` for the `llms.txt` line,
   because a route cannot see its sibling's options.
   Recorded for the later ruling: the GitHub Packages token wall (see Context)
   disqualifies it as the public channel; the recommendation is a public npmjs
   `@spec-kitty` scope with provenance, with GitHub Packages acceptable as a
   staging channel. The pointer's `usage` line switches form when that ruling
   lands.

## Consequences

- One published artifact serves every consumer site; Shape B's N-fork
  maintenance and stamp-time freeze are avoided, with a written re-trigger
  instead of an unrecorded "maybe later".
- The C-001 fence, the C-003 transport boundary, and the NFR-003 closure
  budget are enforced by tests that were each demonstrated red once, so the
  invariants survive future edits without reviewer memory.
- Consumers install a tarball in this mission, so first-run UX is one extra
  step until the C-002 ruling; the wiring pointer already tells agents the
  exact launch command per site.
- NFR-002 is recorded honestly rather than greenwashed: at example scale the
  retained snapshot costs ~134 KB per page (the example carries full
  book-chapter markdown), so a naive linear extrapolation to the 10,000-page
  anchor lands at ~1.31 GB, **above** the 512 MB bound; the served-shape
  reading on a light synthetic corpus (~24-26 KB retained per page)
  extrapolates to ~238-250 MB, **under** it. Retained cost is payload-driven
  (roughly 15-25 KB fixed per page plus 5-6x on-disk bytes, because the
  snapshot keeps the raw artifact text for byte-derivation), so the bound
  holds for corpora averaging up to roughly 5-6 KB per page on disk, and a
  real 10k-page corpus of book-chapter pages would breach it. Per NFR-002's
  own promotion clause, a real synthetic 10k fixture is built when a consumer
  approaches that scale; the measurements and method live in
  `mcp/tests/perf/NOTES.md`.
- The MCP spec-revision transition window is accepted, not measured: hosts
  pinned to a revision older than the supported 2025-11-25 exist, the README
  names the supported revision, and such clients get the named
  `UNSUPPORTED_CLIENT_REVISION` error rather than a silently degraded
  conversation (NFR-004); an interop matrix is deferred follow-up per the
  spec's Assumptions.
- Client support for MCP resources varies; the size gate plus `uri` fields in
  tool outputs are the escape hatch that keeps every page reachable on any
  client.

## Considered and rejected

- **Shape B (per-consumer template factory).** Rejected for the stamp-time
  freeze against the moving published contract and the untestable N-fork
  maintenance tail (decision 1; re-trigger recorded there).
- **Root-relative links at emission (the other half of the R4 fork).**
  Rejected for v1 because it rewrites the published artifact shape for every
  existing consumer; runtime re-origining inside the fs adapter keeps the
  published shape stable (decision 7).
- **A hosted or remote HTTP MCP service.** Out of scope (C-003): doc-kitty
  sites deploy to static hosts, and a hosted transport is a separate mission
  with its own charter ruling.
- **Per-site hosted MCP, Mintlify/GitBook style.** Not available to a static
  host; the wiring pointer is the static-safe counter.
- **GitHub Packages as the public distribution channel.** Token-walled even
  for installing public packages (Context); acceptable only as an internal or
  beta channel.
- **Lazy per-request fetch and ETag-based revalidation.** A torn corpus (index
  of build N, page of build N+1) is undetectable per-request, and ETag support
  is host behaviour, not contract (research R2); snapshot-at-start plus
  `buildId` comparison closes the defect structurally (decisions 2, 6).
- **MCP SDK v1 (`@modelcontextprotocol/sdk`).** Maintenance-only line through
  approximately 2027-01; a new artifact born on v1 is born deprecated
  (research R1; decision 4).

## References

- Mission directory: `kitty-specs/doc-kitty-mcp-server-01M6BAQX/` -
  `spec.md` (requirements C-001..C-006, FR-001..FR-011, NFR-001..NFR-005),
  `plan.md` (IC-01..IC-04), `research.md` (R1-R8), `contracts/mcp-surface.md`,
  `data-model.md`, `quickstart.md`, `squad-dispositions.md`.
- Decision moments: pre-spec shape squad (unanimous A, 2026-11-01);
  post-plan review squad (2026-11-01); post-tasks squad (2026-11-01); operator
  ruling Q-P1 = hybrid resource surface (2026-11-01).
- [ADR-0043](./0043-toolkit-package-scope-and-self-reference.md) - the
  `@spec-kitty` package scope this server joins.
- [ADR-0058](./0058-build-state-owner-and-config-split.md) - the agent-API
  `_links` seam the wiring pointer rides on.
- [Generators](../architecture/generators.md) - the discovery surfaces,
  including the MCP pointer as the advisory fifth surface.
- [MCP server quickstart](../guides/mcp-server-quickstart.md) - the
  consumer-side launch guide.
- `mcp/tests/perf/NOTES.md` - the NFR-001/NFR-002 measurements cited above.
