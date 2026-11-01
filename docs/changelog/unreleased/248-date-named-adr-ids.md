---
section: Added
---

- **Date-named ADRs get real ids, order and status (#248).** Before, an ADR's
  id was always its leading four digits, so `2026-03-09-1-slug.md` read as
  `2026`. Its status came only from a body `## Status` section, and its date only
  from `updated`. Now a docs tree can set `adr.id` in `docs/_meta/charter.yaml`:
  `preset: date-seq` reads `2026-03-09-1` and orders by date, then by sequence
  number (`-2` before `-10`), and `pattern:` takes a regex with a named `id`
  group. When an ADR has no body `## Status`, its frontmatter `status` is shown,
  and when it has no `updated`, its frontmatter `date`. The generated ADR index
  and the hub's ADR cards still share one extractor. Without the axis nothing
  changes. `generate-adr-index.mjs` reads the charter next to `--dir`, or the
  one under the new `--docs-root`. See
  [ADR-0069](docs/adr/0069-configurable-adr-id-and-frontmatter-status.md).
