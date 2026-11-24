---
section: Security
---

- **A contract lock cannot name a file outside its snapshot (#423).** Before,
  `pnpm packs:sync-contract` wrote each key of `contract.lock.json` without
  checking it, so a `../` key could write outside `--to`. Now a key with a `..`
  segment, a leading `/`, a backslash or an empty segment stops the sync before
  anything is fetched, read or written, and names the key. A `packs.contract`
  snapshot with such a key fails the build with a `[dk-packs]` error.
