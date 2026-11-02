# Contract: MCP Surface

**Mission**: doc-kitty-mcp-server-01M6BAQX
**Date**: 2026-11-01
**Status**: planning draft (surface mappings ratify at Q-P1: hybrid recommended)

Transport: MCP over **stdio** only (C-003). SDK: `@modelcontextprotocol/server` (v2 line, currently 2.4.0), stateless, Node >= 22.22.

## Tools (always present)

| Tool | Input | Output (content) | Errors |
|---|---|---|---|
| `get_site_info` | none | siteTitle, baseUrl, contractVersion, buildId, pageCount, capabilities (which surfaces are live: pages, scenarios, resources) | - |
| `list_pages` | `section?: string` | array of { id, section, title, description, keywords } in registry order | MALFORMED_CORPUS |
| `get_page` | `id: string` | { id, title, description, links, markdown } byte-derived from the per-page artifact | PAGE_NOT_FOUND, PAGES_LINKS_GATED |
| `search_pages` | `query: string` | matching page records in published registry order, at most 25; matching is case-insensitive substring over title/description (index) and keywords (per-page artifacts) only; no scoring, no ranking (C-001) | MALFORMED_CORPUS |
| `list_scenarios` | none | array of ScenarioRecord | surface absent -> tool reports unavailability, not error |

No tool writes, fetches beyond the snapshot, or derives content. No tool accepts a URL or path; all inputs are identifiers from the loaded snapshot. Tool record outputs also carry the page's `uri` field (the `docs://` URI below) so attach-by-URI stays reachable when listing is gated off.

## Resources (when enabled, FR-011; contingent on Q-P1)

- URI scheme: `docs://<site-slug>/sections/<sectionId>` (metadata document) and `docs://<site-slug>/pages/<pageId>` (full page artifact content). `<site-slug>` is derived from the launch base by exactly one rule: lowercase, scheme and trailing slash dropped, non-alphanumerics collapsed to `-`; the contract pins this so two servers over the same site mint the same identities.
- Listed via `resources/list` only when `pages.length <= resourceListingThreshold` (default 1000, research R5); a resource template `docs://<site-slug>/pages/{id}` is registered in both modes so read-by-URI stays discoverable above the threshold.
- Every resource body byte-equals the artifact expectation per FR-010 (HTTPS mode) or equals it modulo the documented link rewrite (fs mode).
- The conformance matrix exercises both branches (listed mode on the example corpus; gated mode by forcing the threshold below the example page count).

## Byte-derivation carve-out (data used by FR-010)

HTTPS mode: every output field byte-equals the published artifact bytes through the documented projection. Fs mode: identical for content fields (markdown, metadata values) while exactly the link fields (`links`, `source`, `url`, `_links`) may differ only by the documented re-origining rule (FR-007). Anything else differing is a conformance failure.

## Prompts

None in v1.

## Handshake behaviour

1. Read index, branch on `version` major; unknown -> UNKNOWN_CONTRACT_MAJOR, server refuses to become ready (NFR-005).
2. Presence of `pages` links absent -> PAGES_LINKS_GATED announced once via `get_site_info.capabilities` and in every affected tool call.
3. `buildId` is emitted in the index AND every per-page and scenarios artifact (FR-008, emitted in this mission); the snapshot loader compares every loaded artifact's value against the index value and refuses with BUILD_IDENTITY_MISMATCH on divergence. Corpora predating FR-008 (no field anywhere) load with a warning instead (migration allowance).

## CLI

```text
doc-kitty-mcp --site <https://host/base>
doc-kitty-mcp --dir  </abs/path/to/build/dist>
             [--link-base <uri>]
             [--resource-threshold <n>]
```

Exit codes: 0 clean shutdown; 2 launch/config failure (unknown contract major, unreachable source, malformed corpus).
