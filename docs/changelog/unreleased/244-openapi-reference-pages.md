---
section: Added
---

- **A site can publish versioned API reference pages from its OpenAPI files
  (#244).** Before, DocKitty had no API reference: authors linked to a separate
  Swagger site or pasted the spec into a page. Now an `openapi` option in
  `defineDocKittyIntegrations` takes OpenAPI 3.0 or 3.1 files, each with a
  `label` and `released` flag, and builds reference pages at
  `/reference/api/<label>/` inside the normal frame, with version links and an
  "unreleased" badge. Each version also publishes its raw file, byte for byte,
  and an `openapi.<ext>.sha256` that `sha256sum -c` checks, and gets a line in
  `llms.txt`. The option is off by default and needs two optional peers,
  `starlight-openapi@0.27.0` and `@astrojs/markdown-satteri@0.4.4`. A bad
  path, file or label fails the build with a `[dk-openapi]` error. A strict CSP
  needs one script hash and one style-attribute hash (with `'unsafe-hashes'`). See
  [Publish OpenAPI reference pages](docs/guides/openapi-reference.md) and
  [ADR-0049](docs/adr/0049-openapi-reference-via-existing-integration.md).
