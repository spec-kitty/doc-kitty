---
section: Added
---

- **A site can keep a validated list of its sub-processors and announce changes
  to it (#403).** Before, the list lived as prose that nothing checked or
  published. Now an optional `docs/_meta/subprocessors.yaml` holds one record per
  sub-processor: name, contact, processing, ISO 3166-1 alpha-2 locations,
  responsibilities, `since` and `until` dates, and optional references and
  `tom_classification` measures. The build and `pnpm validate:catalog` check it
  with the same rules and messages, and a bad catalog fails the build. With a
  catalog, the site serves `api/subprocessors.json` (records and dated changes)
  and a `subprocessors.xml` feed, both linked from `api/index.json` and both free
  of build times; a future date announces a change in advance. Without the file
  nothing changes. The toolkit ships no records, and this is not legal advice:
  whether the feed meets a contract's notice terms is for counsel. A generated
  list page follows separately. See
  [ADR-0086](docs/adr/0086-subprocessor-catalog.md).
