---
section: Changed
---

- **The vendored packs contract moves to `contract-packs-v0.1.0-rc.2` (#418).**
  Before, doc-kitty read packs with the charter's rc.1 contract, which does not
  know routing catalogs, so open-packs' `foundation` manifest read as
  unverified. Now the snapshot is at rc.2 (charter `33f3ad4`), and every
  open-packs manifest verifies. rc.2 also holds graph shards only at the pack
  root and drops the `charter.yaml` rule.
