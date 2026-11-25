# Data model: Large hubs: paged hub listing

## Hub data entry (widened `HubCap`, #429)

Served in `virtual:doc-kitty/route-shaping` as sorted `[hubFolderSlug, entry]` pairs (NFR-003), one for every published `kind: Hub` hub with a non-root slug, in every sidebar mode.

| Field | Type | Rule |
| --- | --- | --- |
| `cap` | positive int | `resolveChildCap({ hub: sidebar_child_cap, section: sidebar.childCap, site: sidebar.childCap })` (slice 1) |
| `count` | int ≥ 0 | Number of children `composeHubChildren` lists |
| `children` | `{ slug, label }[]` | Hub listing order: ADR cards by id, then the others by section rank and title |
| `capped` | boolean (optional in the type, always emitted) | `count > cap` |
| `pageSize` | positive int (optional in the type, always emitted) | `resolveHubPageSize({ hub: hub_page_size, section: hub.pageSize, site: hub.pageSize })`, default 50 |

Derived values, not stored:

- `paged = capped && count > pageSize`
- `pageCount = paged ? ceil(count / pageSize) : 1`

Invariants:

- The union of `hubPageSlice(children, n, pageSize)` over n = 1…`pageCount` equals `children`, in order, with no duplicates.
- `children.length === count`.
- A paged hub has no child slug equal to `<hub>/page` (otherwise the build fails).

## Page-size levels

| Level | Where | Key | Validation |
| --- | --- | --- | --- |
| Hub | hub index frontmatter | `hub_page_size` | zod `int().positive()`; an invalid value fails the frontmatter gate |
| Section | `docs/_meta/sections.yaml` or the charter's `sections.entries` | `hub.pageSize` | `isChildCap`; throws `section "<id>" hub.pageSize must be a positive whole number` |
| Site | `defineDocKittyIntegrations({ hub: { pageSize } })` | `hub.pageSize` | `isChildCap`; throws `[dk-config] hub.pageSize must be a positive whole number` |

## Listing page

| Field | Value |
| --- | --- |
| URL | page 1: the hub's URL; page N ≥ 2: `<base>/<hub>/page/N/` |
| Title | page 1: the hub title; page N: `dockitty.hub.pagination.title` with `{title}` = hub title, `{page}` = N |
| Description | the hub's `description` |
| Children | `hubPageSlice(children, N, pageSize)`, each rendered as a hub card (title, kind, ADR status and date, description, deck PDF link) |
| Canonical | its own URL |
| prev/next | off (`prev: false`, `next: false`); the pagination replaces them |

## Agent API listing record (index)

Appended after the docs records and before any OpenAPI records, one per paged page N ≥ 2:

```json
{
  "kind": "Listing",
  "slug": "missions/page/2",
  "title": "Missions, page 2",
  "url": "https://site/missions/page/2/",
  "listing_of": "missions",
  "page": 2,
  "of": 17,
  "api": "https://site/api/pages/missions/page/2.json"
}
```

The per-page JSON adds `"children": [{ "slug", "title", "url" }]` for that page's slice. The exact field names follow the existing record shape in `agent-index.ts`; any field the existing records already name, such as `url` or `title`, keeps its existing name.

## llms.txt line

Directly after the hub's line in the hub's section group:

```
- [Missions, page 2](https://site/missions/page/2/): children 51–100 of 835
```
