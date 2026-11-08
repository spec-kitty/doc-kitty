---
section: Breaking
---

- **A version label containing a dot now fails the build (#259).** Before, the
  `openapi` option accepted a label such as `v1.1`, but the renderer drops
  dots from routes, so the label advertised an address the site never served
  (`/v11/`). Now the build refuses it — for `specs[].label` and for labels
  derived by `archive.labelPattern` alike — with a pointed `[dk-openapi]`
  error. Rename it to a route-safe label such as `v1-1`. Every `section`
  segment follows the same rule: a mount point such as `reference/v1.1` is
  refused too; write `reference/v1-1`. See
  [ADR-0078](docs/adr/0078-openapi-surface-matrix.md) and
  [the migration note](docs/migrations/0.6-to-0.7.md).
