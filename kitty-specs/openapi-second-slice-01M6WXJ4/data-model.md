# Data model: OpenAPI pages, second slice

No stored data except the fetch cache. These are build-time values.

## SpecInput (option, statically validated)

| Field | Type | Rule |
|---|---|---|
| `path` | string | Local file, `.yaml`/`.yml`/`.json`; or |
| `url` | string | `https://` only; requires `sha256` |
| `sha256` | string | 64 lowercase hex; required with `url`, optional pin for `path` |
| `label` | string | Lower-cased, `[a-z0-9._-]+`, unique across explicit and archive |
| `released` | boolean | Required for explicit specs |

`archive`: `{ glob: string, labelPattern: string, released?: boolean = true }`. Exactly one of `path`/`url` per spec.

## MaterialisedSpec (closure; FR-006, FR-007)

| Field | Type | Notes |
|---|---|---|
| `label` | string | Unique key |
| `released` | boolean | |
| `origin` | `'file' \| 'bundle' \| 'swagger2' \| 'remote' \| 'archive'` | For messages and docs |
| `ext` | `'yaml' \| 'yml' \| 'json'` | Published as `openapi.<ext>` |
| `bytes` | Buffer | Final bytes: original, bundled or fetched |
| `sha256` | string | Of `bytes`, lowercase hex |
| `renderPath` | string | File the renderer reads; holds exactly `bytes` (or original for Swagger 2) |
| `title` | string | `info.title` |
| `apiVersion` | string | `info.version` |
| `operations` | Operation[] | FR-023 order |

Invariant: `sha256(bytes) === sha256` and the publisher and dev middleware write `bytes` unchanged (NFR-007).

## Operation

| Field | Type | Notes |
|---|---|---|
| `method` | string | Uppercase |
| `path` | string | As in the document |
| `summary` | string? | |
| `operationId` | string? | |
| `slug` | string | Renderer 0.27.0 slug, duplicate suffix applied |

Order: `path` bytewise, then `method` bytewise.

## OpenApiPublication (`DK_OPENAPI` env, extended)

`{ section, llmsOperations: boolean, versions: Array<Omit<MaterialisedSpec,'bytes'|'renderPath'|'origin'> & { rawRoute: string }> }`. `rawRoute` = `/<section>/<label>/openapi.<ext>` (base-less). Existing readers keep working: added fields only.

## SyntheticEntry

Projection of one publication version onto the agent record, page payload, graph node and OKF file. See [contracts/synthetic-entry.md](./contracts/synthetic-entry.md).

## ServedSurfaces (changed)

Adds `openapi: boolean` (true only when the option is set). Internal.

## State: fetch cache entry

`absent → fetched(valid) → corrupted (digest ≠ name)`. Online: corrupted or absent → refetch. Offline: absent or corrupted → `[dk-openapi]` failure; valid → used, no request.
