---
section: Changed
---

- **The ADR index is regenerated after merge, not in each PR.** Before, every
  PR that added an ADR also added a row to the table in `docs/adr/README.md`,
  and CI failed a stale table, so parallel PRs conflicted on it. Now a bot PR
  regenerates the table after merge, and CI checks per PR only that no two ADRs
  share a number, with the new `generate-adr-index.mjs --check-ids`. See
  [ADR-0072](docs/adr/0072-parallel-landing-without-shared-files.md).
