---
section: Added
---

- **A site with classified pages can build an evidence index of its measures
  (#401).** Before, the measures that pages classify with `tom_classification`
  were only visible page by page. Now a site that sets `tomAnnex: true` (off by
  default) builds `api/tom-annex.json`:
  per measure of the catalog, the published pages that evidence it, by scope,
  and the measures nothing evidences yet. It is labelled "Evidence index, not
  the contractual annex.", carries a not-legal-advice notice, the open questions
  for counsel and an ADR-0087 `generated` stamp, and is linked from
  `api/index.json` and copied into the OKF export. Drafts never count, and a
  site that leaves the option off, or has no published classified page, builds
  nothing new. The new `dockitty-tom-annex`
  command writes an opt-in committed snapshot and hub page and checks them for
  drift, a hand edit to their stamp's `by` included. See [the guide](docs/guides/tom-annex.md).
