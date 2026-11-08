---
section: Added
---

- **OpenAPI versions appear in the agent API (#257).** Before, the generated
  reference pages were invisible to agents. Now every spec version has one
  synthetic entry in `/api/index.json` (appended after the docs records, never
  ranked) and a page payload at `/api/pages/<section>/<label>.json`, carrying
  `released`, `rawDocumentUrl` and the raw document's `sha256`. Unreleased
  versions are included and marked. The content graph and the OKF bundle carry
  the versions too. See
  [ADR-0078](docs/adr/0078-openapi-surface-matrix.md).
