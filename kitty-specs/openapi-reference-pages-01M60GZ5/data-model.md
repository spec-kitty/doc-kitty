# Data model: OpenAPI reference pages

## OpenApiOptions (`defineDocKittyIntegrations({ openapi })`)

| Field | Type | Rule |
|---|---|---|
| `section` | string, optional | Default `reference/api`. One or more `/`-separated segments, each following the label rule. It must not be or sit under a reserved route (`api/`, the agent API) or collide with an authored section (ADR-0050). |
| `renderer` | function | Required. The `starlight-openapi` default export, imported by the adopter. |
| `specs` | ApiVersion[] | Length ≥1. Labels are unique after lower-casing. |

## ApiVersion

| Field | Type | Rule |
|---|---|---|
| `path` | string | A path relative to the site root. It must exist, be a single file, and be OpenAPI 3.0 or 3.1. An external `$ref` is rejected. |
| `label` | string | Lower-cased, then `[a-z0-9._-]+`. Never rewritten. |
| `released` | boolean | Required, with no default. |

**Invariants**
- Validation runs eagerly in `defineDocKittyIntegrations`. Any failure throws `[dk-openapi] <entry>: <reason>` before anything renders.
- The toolkit never imports the optional peers. Without the `openapi` option nothing of them is loaded.

## Published artifacts per version

| Artifact | Address | Content |
|---|---|---|
| Reference pages | `<base>/<section>/<label>/…` | Plugin routes inside the site layout |
| Raw document | `<base>/<section>/<label>/openapi.<ext>` | Byte-identical copy of `path` |
| Checksum | `<base>/<section>/<label>/openapi.<ext>.sha256` | `<sha256 hex>  openapi.<ext>\n` |
| `llms.txt` line | in `<base>/llms.txt` | `- [<label> (unreleased)?](<raw document URL>)` |

## States

A version is either **released** (no badge) or **unreleased** (a visible "unreleased" text on every page). Both appear in the sitemap.
