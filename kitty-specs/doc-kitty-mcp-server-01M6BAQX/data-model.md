# Data Model: Generic Doc-Kitty MCP Server

**Mission**: doc-kitty-mcp-server-01M6BAQX
**Date**: 2026-11-01

Server-side data structures. Where a structure mirrors a published doc-kitty artifact, it is type-only coupled to the toolkit's contract (C-006) and never re-derived.

## CorpusSnapshot

Loaded once at server start; immutable for the process lifetime (FR-006).

| Field | Type | Source | Validation |
|---|---|---|---|
| siteTitle | string | index top-level `title` (there is no `site` envelope) | required, non-empty |
| baseUrl | string (URL) | launch config | absolute URL or absolute fs path per adapter |
| contractVersion | string | index `version` | must equal a known major; else UNKNOWN_CONTRACT_MAJOR |
| buildId | string | index `buildId` | required once FR-008 lands; missing -> tolerant warn on pre-FR-008 corpora |
| sections | Section[] | index `sections[]`, emitted from `docs/_meta/sections.yaml` by IC-01's contract addition (absent before it) | order preserved from registry order; legacy empty section value on the home record maps to the root section |
| pages | PageRecord[] | index records + per-page artifacts | index record drives identity |
| scenarios | feature/scenario records | `/api/scenarios.json` if present | optional surface; shape per the ScenarioIndex section |
| loadedAt | timestamp | server | informational |

## Section

| Field | Type | Notes |
|---|---|---|
| id | string | registry id from index |
| label | string | display label |
| order | number | registry order |
| purpose | string? | blurb line when present |

## PageRecord

| Field | Type | Source | Validation |
|---|---|---|---|
| id | string | per-page artifact path relative to `api/pages/`, minus `.json` (home => `home`; nested keeps slashes) | Pinned derivation rule; never slug arithmetic (home slug `""` case) |
| section | string | index record | must reference a known section id |
| title | string | index record | non-empty |
| description | string? | index record | feeds FR-004 matching |
| keywords | string[] | per-page artifact `keywords` field (not present in index records; snapshot loads the full corpus) | feeds FR-004 matching |
| links | map | record `_links` | rewritten by FsCorpusSource (FR-007) |
| markdown | string | per-page artifact `markdown` field | pass-through, unmodified |
| docStatus | string | record `doc_status` | publication gate already applied by the build |

## ScenarioIndex / feature / scenario records

Present only when the site publishes the scenarios surface. Mirrors the emitted artifact exactly - no flattening (implementer lens: flattening is re-derivation per C-006).

- Top level: `version` (string, e.g. `"2"`), `generated_by` (snake_case; value `doc-kitty-gherkin/<version>` - the real trap vs the index's camelCase `generatedFrom`; the older `generated_from` key was removed in 0.4.0, #183), `count`, `results` `{ report, format, as_of }`, `features[]`, `buildId` (added by WP01).
- Feature record: `id, doc_status, glossary_context, related, results ("current"), source, tags, title, url, scenarios[]`.
- Scenario record: `anchor, examples?, line, name, outline, result?, rule?, steps, tags` (`examples` and `rule` are genuinely optional in the real corpus; `result.status` is real data - pass it through, do not strip or invent).

## LaunchConfiguration

| Field | Type | Validation |
|---|---|---|
| source | { kind: "https", url } or { kind: "fs", dir } | exactly one |
| linkBase | string? | override for FR-007 rewrite target |
| resourceListingThreshold | number | default 1000 (research R5) |
| siteSlug | derived | one canonical function over the launch base (contract pins the rule) |

## Error taxonomy (visible to the client, NFR-005)

| Name | Trigger |
|---|---|
| UNKNOWN_CONTRACT_MAJOR | index `version` major not in the supported set |
| UNREACHABLE_ENDPOINT | source fetch failed after the one documented retry |
| MALFORMED_CORPUS | artifact failed schema/shape validation |
| PAGES_LINKS_GATED | index lacks per-page links; server degrades to index-only tools and announces it |
| BUILD_IDENTITY_MISMATCH | torn corpus detected (mixed buildId values) |
| PAGE_NOT_FOUND | identifier not present in the loaded snapshot |
| UNSUPPORTED_CLIENT_REVISION | connecting client negotiates an MCP spec revision older than the server's supported one (NFR-004; announced, never silently degraded) |

## State transitions

None. The snapshot is immutable; configuration is launch-time only.
