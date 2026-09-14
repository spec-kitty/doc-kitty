---
title: "ADR-0042: A native documentation charter — borrow the shape, not the engine"
description: doc-kitty resolves its documentation charter with its own pure-core/fs-loader/gate triad and zero Spec Kitty runtime dependency, via a single _meta/charter.yaml surface.
doc_status: active
updated: 2026-09-14
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0031-vocabulary-override
  - adr/0035-vocabulary-core-consolidation
---

# ADR-0042: A native documentation charter — borrow the shape, not the engine

## Status

**Accepted** — 2026-09-14. Delivered by the `documentation-charter` mission
(FR-011 … FR-015, C-003). WP01/WP02 shipped the authoring surface
(`_meta/charter.yaml`) and the resolution model; WP03 wires the enforcement gates
to the resolution contract.

## Context

doc-kitty already lets a consumer override the type/kind vocabulary through
`_meta/vocabulary.yaml` ([ADR-0031](0031-vocabulary-override.md)) and drive
display through the authored section registry `_meta/sections.yaml`
([ADR-0004](0004-amend-common-docs-as-extensible-variation.md)). Those are two
separate authored files with two separate resolution paths. The governance story
is real but scattered: an adopter who wants to know "what governs my docs?" has
no single answer, and two of the axes the toolkit actually enforces — the
`doc_status` status set and the required-field floor — were not consumer-authored
at all.

Spec Kitty (the mission runtime that develops this toolkit) has a first-class
*charter/doctrine* concept: one authoritative structured file plus a narrative
companion, with a resolver that derives an effective catalog and warns rather
than fails on unknown-but-permitted input. That shape is a good fit for
documentation governance. The tempting move is to reuse Spec Kitty's charter
engine directly.

That move is wrong for this toolkit. doc-kitty is a **public consumer template**:
adopters install `@commondocs-kitty/toolkit` and build a static site; they do
**not** run Spec Kitty. Depending on Spec Kitty's `DoctrineService` at
build/validate time would make the headline governance feature unusable for its
own audience, pull a heavy out-of-ecosystem runtime into every consumer build,
and invert the portability goal that ADR-0004 already committed to when it
rejected heavyweight external coupling.

## Decision

**doc-kitty's documentation charter is self-contained. It borrows the *shape* of a
charter — an authoritative structured file plus a narrative companion plus a
derived catalog, warn-not-fail — but none of the *engine*.**

1. **Zero Spec Kitty runtime dependency.** Charter resolution imports nothing
   from Spec Kitty or `DoctrineService`. It is resolved by doc-kitty's own
   triad, extending the two-layer pure-ESM core established in
   [ADR-0035](0035-vocabulary-core-consolidation.md):
   - a **pure core** (`vocabulary-core.mjs`) that stays filesystem-free and
     Astro-free and turns raw charter data into an effective `ResolvedCharter`;
   - a **filesystem loader** (`vocabulary-loader.mjs`) that is the only layer
     allowed to read `_meta/*.yaml`;
   - **bare-Node gates** that enforce the resolved charter without an Astro
     build, so the same rules hold in CI and in the Astro-side resolution (kept
     in parity by an existing guard).

2. **One authoring surface: `_meta/charter.yaml`.** A single optional file under
   the docs root carries every governable axis — `vocabulary` (types/kinds),
   `statuses`, `required_fields`, and `sections`. Every key is optional; an
   absent file, or an empty one, resolves to the shipped canonical defaults with
   no error.

3. **Per-axis precedence over the legacy files.** The legacy
   `_meta/vocabulary.yaml` and `_meta/sections.yaml` keep working. Precedence is
   resolved **per axis, not per file**: an axis declared in `charter.yaml`
   resolves *solely* from the charter; an axis the charter omits falls back to the
   corresponding legacy file if present, else to the canonical default. The same
   axis is never partial-merged across the charter and a legacy file, so a
   half-migrated tree is deterministic. When any legacy file is present, the build
   emits exactly one deprecation notice pointing at the migration guide.

4. **Extend-only statuses and a required-field floor.** Two new axes are
   deliberately narrow:
   - `statuses.add` may *add* to the canonical `doc_status` set; attempting to
     remove, forbid, or alias-away a canonical status **fails closed** with a
     message naming the reserved status. An unknown-and-not-added status on a page
     *warns* (parity with kinds), it does not fail.
   - `required_fields.optional` may relax the required set for this consumer,
     **except `title`**, which is a floor and is always required. Listing `title`
     in `optional` **fails closed** with a floor message.

5. **Fail-closed on malformed input; warn on the forward-compatible.** A
   malformed charter (bad YAML, an invalid axis, an unknown `version` shape) fails
   the build with a message naming the file and the offending key. An unknown
   *top-level* key only warns, so the schema can grow without breaking older
   consumers.

This ADR **relates to, and does not edit,** [ADR-0004](0004-amend-common-docs-as-extensible-variation.md):
that ADR's "amend Common Docs as an extensible variation" stance is what the
charter now operationalises into a single authored surface. ADR-0031's
consumer-overridable vocabulary and the ADR-0004 section registry are the two
axes the charter absorbs; the status and required-field axes are new.

## Consequences

- The convention document (`docs/context/convention.md`) is the narrative
  companion to the charter, not a promissory note about a future Spec Kitty
  recasting. It is recast to say so, and each governable dimension is labelled
  **fixed-doctrine** or **consumer-overridable**.
- Adopters get a single place to look — `_meta/charter.yaml` — documented in the
  [consumer setup guide](../guides/consumer-setup.md) and reachable by a
  behavior-preserving [migration guide](../guides/migrating-to-charter.md) from the
  legacy files.
- The portability invariant is testable: because resolution imports nothing from
  Spec Kitty and runs in bare Node, the clean-room consumption test (a packed
  tarball, no Spec Kitty present) exercises the charter exactly as an external
  adopter would.
- The legacy files are honored indefinitely as a compatibility surface, at the
  cost of one deprecation notice per build until they are deleted. That is a
  deliberate trade for a non-breaking migration.

## Alternatives considered

- **Consume Spec Kitty's charter/doctrine engine directly.** Rejected: it makes
  the headline governance feature unusable for adopters who do not run Spec Kitty,
  drags a heavy out-of-ecosystem runtime into every consumer build, and inverts
  the portability goal ADR-0004 set.
- **Keep two independent files (`vocabulary.yaml` + `sections.yaml`) and add two
  more for statuses and required fields.** Rejected: four authored files with four
  resolution paths worsens the "what governs my docs?" discoverability problem the
  charter is meant to solve.
- **A merge-based precedence (charter layered on top of the legacy files
  per key).** Rejected: partial-merging one axis across two sources makes a
  half-migrated state ambiguous. Per-axis, single-source precedence keeps every
  intermediate migration state deterministic.
