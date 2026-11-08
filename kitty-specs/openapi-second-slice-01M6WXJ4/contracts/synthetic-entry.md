# Contract: synthetic entry (FR-001 to FR-005)

## Agent index record (`/api/index.json`, appended after docs records)

Full `AgentRecordEntry` shape asserted by `mcp/src/corpus/source.ts`:

| Field | Value |
|---|---|
| `slug` | `<section>/<label>` |
| `section` | first segment of `<section>` |
| `title` | `<info.title> <label>` + ` (unreleased)` when unreleased |
| `description` | `OpenAPI <info.version> contract, <n> operations` |
| `type` | `reference` |
| `doc_status` | `active` |
| `kind` | `Reference` |
| `tags` | `["openapi"]` |
| `priority` | record default |
| `source` | absolute `/api/pages/<section>/<label>.json` |
| `url` | absolute overview URL |
| `released` | boolean (added) |
| `rawDocumentUrl` | absolute, base-aware raw document URL (added) |
| `sha256` | 64 lowercase hex (added) |

## Page payload (`/api/pages/<section>/<label>.json`)

Record fields plus `related: []`, `audience: []` (asserted by `mcp/src/corpus/source.ts:188-189`), `_links` (`self`, `html`, `describedby` = raw document), `markdown`, `keywords` (sorted unique operation summaries), `authors: []`, `buildId`. Contract major stays `"3"`.

`markdown` (from `openApiSummaryMarkdown`, also the OKF file body):

```md
# <info.title> <label>

- Released: yes|no
- API version: <info.version>
- Raw document: <rawDocumentUrl>
- sha256: <hex>

## Operations

- GET /pets: List pets
```

Spec-derived text (title, summaries, labels) is flattened to one line and Markdown link syntax escaped (FR-028).

## Content graph node

`{ id: "openapi:<label>", kind: "resource", title, url: rawDocumentUrl, resource: { sha256, released, overview } }`. No per-operation nodes.

## OKF file

`okf/<section>/<label>.md`, generated frontmatter as other generated OKF files, body = the summary above.

## Exclusions

No RSS/Atom item, no glossary autolinking, no frontmatter-gate entry, no footer page formats.
