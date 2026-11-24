---
section: Added
---

- **A site with classified pages builds an evidence index of its measures
  (#401).** Before, the measures that pages classify with `tom_classification`
  were only visible page by page. Now the build writes `api/tom-annex.json`:
  per measure of the catalog, the published pages that evidence it, by scope,
  and the measures nothing evidences yet. It is labelled "Evidence index, not
  the contractual annex.", carries a not-legal-advice notice, the open questions
  for counsel and an ADR-0087 `generated` stamp, and is linked from
  `api/index.json` and copied into the OKF export. Drafts never count, and a
  site with no classified pages builds nothing new. The new `dockitty-tom-annex`
  command writes an opt-in committed snapshot and hub page and checks them for
  drift. See [the guide](docs/guides/tom-annex.md).
