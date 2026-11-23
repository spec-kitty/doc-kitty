---
section: Changed
---

- **A pack manifest's own hash is checked (#417).** Before, the pack reader
  showed `manifest_hash` as written and never recomputed it. Now it recomputes
  the hash from the manifest's RFC 8785 canonical JSON, as the charter's schema
  defines it. A manifest whose hash does not match reads as unverified, with a
  `manifest-own-hash-mismatch` warning, even when every constituent matches.
  A manifest with no `manifest_hash`, which verified before, now reads as
  unverified too, with a `manifest-own-hash-missing` warning.
  `packManifestHash` is exported. See
  [the packs architecture page](docs/architecture/packs.md).
