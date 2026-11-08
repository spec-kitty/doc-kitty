---
section: Added
---

- **More OpenAPI input shapes, each published byte for byte (#260).** Before,
  only a single self-contained OpenAPI 3.x file was accepted. Now a definition
  with relative `$ref`s across local files is bundled and published as one
  file (the published bytes are the bundle, so they match no single source
  file), Swagger 2.0 documents are accepted with their original bytes
  published, and a pinned `https` URL works via `specs[].url` + `sha256`,
  fetched within bounded redirects, timeout and size, and cached under
  `node_modules/.cache/doc-kitty/openapi/` for offline builds
  (`openapi.offline` or `DOCKITTY_OFFLINE=1`). Every error starts with
  `[dk-openapi]`, names the spec version and the cause, and redacts URL query
  strings. Swagger 2.0 and remote documents must be self-contained: an
  external `$ref` in either is refused, with the same ref-count bound as every
  other input. See [ADR-0078](docs/adr/0078-openapi-surface-matrix.md) and
  [the migration note](docs/migrations/0.6-to-0.7.md).
