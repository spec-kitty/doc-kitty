---
title: "ADR-0065: `kind` is required on every page again"
description: The frontmatter gate requires `kind` on every page, as ADR-0009 decided; a charter can relax it. Reverses the 2026-08-31 update to ADR-0009 that made it optional.
doc_status: active
updated: 2026-10-25T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0009-finalize-metadata-contract
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0042-native-documentation-charter
  - context/convention
  - architecture/metadata-model
---

# ADR-0065: `kind` is required on every page again

## Status

Accepted (2026-10-25).

Reverses the `kind` bullet of the "Update (2026-08-31)" section of
[ADR-0009](./0009-finalize-metadata-contract.md), and the sentence "`kind` is
likewise optional" in the matching update to
[ADR-0004](./0004-amend-common-docs-as-extensible-variation.md). ADR-0009
decision 1, "required on every page", stands again. Both ADRs stay as written.
The rest of those updates is unchanged: `type` stays optional and derived from
the section registry.

## Context

ADR-0009 made `kind` required on every page. The QOL adoption-enabler mission
(#38) made it optional in the frontmatter gate, so that an adopter with a large
corpus would not have to add two required fields at once. The convention page,
ADR-0009 decision 1 and the project charter kept saying it was required, so the
contract had two statements (#219).

`kind` drives the per-kind layout and the reading of every page. A page without
it renders with the default layout and drops out of every view that groups
pages by kind. `type` has a derivation source, the section registry; `kind` has
none, so an absent `kind` is information that is missing, not information the
toolkit can work out.

Since #38, the charter can relax a required field for one consumer
(`required_fields.optional`, [ADR-0042](./0042-native-documentation-charter.md)).
This is the escape hatch #38 did not have. Both of doc-kitty's own trees already
carry `kind` on every page.

## Decision

1. **The gate requires `kind`.** `kind` joins the canonical required set
   (`title`, `description`, `doc_status`, `updated`, `kind`). A page without it
   fails `validate-frontmatter` with `` `kind`: required ``. The bundle-root
   `README.md` needs it too.
2. **A charter can relax it.** `kind` is not part of the floor, so
   `required_fields.optional: [kind]` in `_meta/charter.yaml` restores the
   optional behaviour for that consumer.
3. **The build stays lenient.** The Astro build schema accepts a page without
   `kind`, as it does a page without `doc_status` or `updated`, so a
   half-written stub still builds. Presence is the gate's job, as before.
4. **The vocabulary stays open.** An unknown `kind` value is still a warning,
   not a failure.

## Consequences

- An adopter page without `kind` now fails the frontmatter gate. The adopter
  either adds `kind` (the scaffolders already write it) or relaxes the field in
  the charter. The migration guide for 0.4.1 says how.
- The convention, the charter and the code give one statement of the contract.
- The parity suite pins the contract: the build accepts a page without `kind`,
  the gate rejects it, and a charter that relaxes `kind` accepts it.
