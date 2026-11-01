---
section: Changed
---

- **Changelog entries are fragment files.** Before, every PR added its entry
  to the one `[Unreleased]` section of `CHANGELOG.md`, so parallel PRs
  conflicted on the same lines. Now a PR adds one file under `docs/changelog/unreleased/`, and
  `pnpm changelog:release <version>` writes the fragments into the version
  section at release time. Released history is unchanged. The example site
  shows pending fragments as Unreleased. See
  [ADR-0072](docs/adr/0072-parallel-landing-without-shared-files.md).
