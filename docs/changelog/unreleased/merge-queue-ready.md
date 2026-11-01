---
section: Changed
---

- **CI is ready for a merge queue, and a PR can pause its CI.** Before, CI ran
  only on pull requests and pushes, so a merge queue would have waited forever
  for `ci-ok`. Now `ci.yml` also runs on `merge_group`, and a PR labelled
  `pr:pause-ci` skips every lane with `ci-ok` red until the label goes. The CI
  helper tests run in CI, and a change to `.github/scripts`, `.github/actions`
  or `.github/filters.yml` runs every lane. See
  [ADR-0072](docs/adr/0072-parallel-landing-without-shared-files.md).
