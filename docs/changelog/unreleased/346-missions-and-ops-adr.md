---
section: Documentation
---

- **An ADR for missions and Ops pages (#346).** Before, there was only
  research and a plan for rendering a kittified repository's missions and Ops.
  Now
  [ADR-0082](docs/adr/0082-missions-and-ops-through-a-mission-status-contract-reader.md)
  records the decisions: a reader over core's mission-status contract, an
  authoritative export adapter with a file fallback labelled "snapshot,
  unverified", two producer-registry entries, publication by allow-list, and a
  leak gate.
