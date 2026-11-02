---
work_package_id: WP03
title: 'MCP server core: stdio wiring and the five tools'
dependencies:
- WP02
requirement_refs:
- FR-003
- FR-004
- NFR-004
- C-001
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-doc-kitty-mcp-server-01M6BAQX
base_commit: 6d95b58e27bfc0d0f79f22ef1d8e9b2110458699
created_at: '2026-11-01T19:22:07.140262+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
history:
- '2026-11-01 planned: created from IC-03 of plan.md after post-plan squad amendments'
authoritative_surface: mcp/src/
create_intent:
- mcp/src/server.ts
- mcp/src/surface/tools.ts
- mcp/src/surface/guards.ts
- mcp/src/surface/uris.ts
- mcp/src/surface/optional.ts
execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- mcp/src/server.ts
- mcp/src/surface/tools.ts
- mcp/src/surface/guards.ts
- mcp/src/surface/uris.ts
- mcp/src/surface/optional.ts
- mcp/tests/surface/**
tags: []
tracker_refs: []
---

# WP03 - MCP server core: stdio wiring and the five tools

## Objective

The protocol surface over the WP02 snapshot: one stdio MCP server exposing five read-only discovery tools, with named typed errors and hand-rolled validation. Resources are WP04; conformance is WP05.

The contract of record for this WP is `kitty-specs/doc-kitty-mcp-server-01M6BAQX/contracts/mcp-surface.md` - implement it verbatim, including its two post-squad corrections: `search_pages` returns matches **in published registry order, cap 25, no ranking** (C-001), and tool record outputs carry the page `uri` field.

Squad context you must respect:

- **SDK v2 reality + the zod question, RESOLVED and verified (post-tasks implementer lens, against the real package types)**: `registerTool`'s primary overload takes `inputSchema?: StandardSchemaWithJSON`, and the package root exports `fromJsonSchema(schema, validator?)` which converts a hand-declared JSON Schema object into that type; the omitted validator lazily defaults to the SDK's bundled validator. **Use `fromJsonSchema` with hand-declared JSON-schema objects; do NOT import zod, do NOT use the deprecated raw-shape overload.** `./stdio` subpath and `McpServer({name, version})` verified.
- **2.4.0 caveats** (verified against release notes): `x-mcp-header` on number params rejected (we have no header annotations - moot); `outputSchema` meta-id unwrap change (we ship no outputSchema in v1 - keep it that way); bundled Ajv rejects weird `$id` schemes (we ship no JSON Schema `$id`s).
- **Degrade loudly, never invent**: PAGES_LINKS_GATED mode still serves index-level tools; page-level calls return the named error, never synthesized content.

## Subtask guidance

### T011 - server.ts wiring

- `createServer(snapshot, config)`: `new McpServer({ name: 'doc-kitty-mcp', version: <pkg version> })`, stdio transport via the SDK's `./stdio` subpath export.
- No HTTP listener import anywhere - WP05's boundary test enforces it structurally (C-003).
- Optional-surface seam (planner lens): `server.ts` calls one hook, `registerOptionalSurfaces(server, snapshot, config)`, imported from `mcp/src/surface/optional.ts` - in THIS WP that module is a no-op stub. WP04 replaces the stub with the real resources registration. Disjoint ownership, standalone compile, no config-flag hand-waving.

### T012 - get_site_info + list_pages

- `get_site_info()`: `{ siteTitle, baseUrl, contractVersion, buildId, pageCount, capabilities }` mirroring data-model.md.
- `list_pages({ section? })`: filter by section id when given; return `{ id, section, title, description, keywords, uri }` in registry order.
- **URIs are minted HERE, not in WP04** (planner lens): create `mcp/src/surface/uris.ts` with the canonical site-slug rule (lowercase the launch base, drop scheme and trailing slash, collapse non-alphanumerics to `-`; fs mode derives from the site's declared origin in the index) and `pageUri`/`sectionUri` minting functions. The tools' `uri` fields use them unconditionally - the contract requires `uri` with or without the resources surface.

### T013 - get_page

- Input `{ id }`; unknown -> `PAGE_NOT_FOUND`. Pages-gated snapshot -> `PAGES_LINKS_GATED` named error.
- Output: `{ id, title, description, links, uri, markdown }`, byte-projected from the per-page artifact (projection rule in the contract carve-out).

### T014 - search_pages

- Case-insensitive substring match over: index title, description; per-page keywords (snapshot has them).
- Output: matching records in REGISTRY ORDER, cap 25. No score field, no "relevance" (C-001).
- Must satisfy WP05's three discriminating controls (SC-002): keyword-only term hits; body-only term misses; known-K recall exact.

### T015 - list_scenarios

- Snapshot without scenarios surface -> tool present but reports unavailability per contract (structured content `{ available: false }`), not an error.
- With the surface: return the published `features[]` array **byte-derived, no flattening** - the emitted envelope is `{ version, generated_from, count, results, features[] }`, each feature carrying its `scenarios[]` (`anchor, examples?, line, name, outline, result?, rule?, steps, tags`). `result.status` is REAL data in every example scenario: pass it through; do not strip it and do not invent fields. No synthesized `pageId`: a feature already carries `id`.

### T016 - Validation guards

- Small guard module: assert non-empty string ids, integer threshold, known enums; on violation throw `MALFORMED_CORPUS`-family errors with path-precise messages.
- Applied at: snapshot load boundaries and every tool handler input.
- [P] parallel-safe with T012-T015 (own file, `mcp/src/surface/guards.ts` inside owned fileset... note: guards module file must live under your owned_files: put it in `mcp/src/surface/guards.ts`).

## Testing notes

In-process SDK client harness in `mcp/tests/surface/`: spin the server in-memory/stdio against the WP02 example fixture; all five tools exercised; error paths with page-not-found and gated fixtures; no vitest output-generated snapshots (WP05 owns the golden mechanism - here use explicit expect assertions on fields).

## Definition of Done

- [ ] All five tools respond correctly against the example fixture harness.
- [ ] Error paths produce the named codes exactly (WP02 taxonomy).
- [ ] `search_pages` honors registry order, cap 25, field set (title/description/keywords only).
- [ ] No zod (or other schema lib) import added; no second declared runtime dep.
- [ ] No resources capability declared yet (WP04 toggles it).

## Risks / reviewer guidance

- Reject ranking fields or scoring output (A2/V: charter fence C-001).
- Reject body-content search or markdown-derived fields (interpretation creep).
- Reject silent fallback when pages are gated.
- Reviewer: re-run `npm view @modelcontextprotocol/server version` at review time; if latest moved from the pin, check release notes for breaking changes before approving.

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Depends on WP02 lanes; see frontmatter.

Implementation command: `spec-kitty agent action implement WP03 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
