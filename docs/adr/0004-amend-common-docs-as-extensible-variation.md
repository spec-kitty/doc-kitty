---
title: "ADR-0004: Amend Common Docs as an extensible variation"
description: Why doc-kitty treats Common Docs as an amendable base rather than a fixed spec, and adds presentations/ as canonical.
status: active
updated: 2026-08-21
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
  - adr/0002-readme-as-index
  - adr/0003-root-docs-and-agent-extension
  - adr/0005-frontmatter-doc-status-and-divio-type
  - plans/roadmap
---

# ADR-0004: Amend Common Docs as an extensible variation

## Status

Accepted

## Context

The Common Docs convention ([velvet-tiger/common-docs](https://github.com/velvet-tiger/common-docs)
v1.2, a valid [OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
bundle) gives us a fixed, ordered `docs/` tree, a required frontmatter contract,
immutable ADR discipline, curated (not-a-wiki) maintenance, and agent-friendly OKF
conformance. doc-kitty adopts it.

Adhering to the letter of the spec conflicts with doc-kitty's goals in several
places. doc-kitty solves for structure, maintainability, agent interoperability,
and flexibility. The recurring reason docs-next-to-code fails is that the structure
is too rigid to grow or the contents are too hard to browse (see
[problem.md](../context/problem.md)). A convention we cannot adapt reproduces the
failure we are solving for.

Earlier ADRs recorded individual deviations ([ADR-0002](./0002-readme-as-index.md)
README-as-index; [ADR-0003](./0003-root-docs-and-agent-extension.md) root `docs/`
plus the `agent` extension) without stating the overall stance. We need one
decision that says how doc-kitty relates to Common Docs, so future amendments have
a principle to appeal to rather than being litigated one by one.

## Decision

Treat Common Docs as an amendable base, not a spec to satisfy verbatim. doc-kitty
defines the Common Docs — Kitty Variation: keep the spirit and the OKF-conformant
core (the frontmatter contract, a required `type`, the curated tree, ADR
discipline, progressive-disclosure ordering), and deviate where it serves the four
outcomes. The variation, consolidated:

1. `README.md` is the section index and carries frontmatter (ADR-0002).
2. The toolkit renders the repo-root `docs/` directly, and adds an optional
   `agent` frontmatter extension (ADR-0003).
3. `status` is renamed `doc_status`, and a reading-mode axis is added alongside the
   OKF `type` ([ADR-0005](./0005-frontmatter-doc-status-and-divio-type.md); the
   axis was later renamed from `divio_type` to `kind`).
4. The canonical structure is what doc-kitty officially supports and is built for.
   The core focus is docsites that follow the structure. A project may adapt the
   section set (use a subset, add its own sections) and the toolkit does not
   hard-fail on deviation, but such adaptation is not officially supported out of
   the box. Amendments to the canonical set are made deliberately, recorded here,
   and only then become first-class.
5. `presentations/` is added as the first canonical section beyond Common Docs, for
   Markdown-authored reveal.js slide decks (see the reveal.js work in
   [plans](../plans/roadmap.md), M6). Canonical `type`: `Presentation`, appended to
   the section order as a Kitty addition. This is a canonical amendment, not an
   example of open user extension.
6. Display is decoupled from on-disk structure via an authored section registry,
   `docs/_meta/sections.yaml`. Section `id`, `label`, `order`, `purpose`, and
   `feeds` are declared as data; the toolkit derives navigation, labels, ordering,
   and per-section feeds from it, not from directory names or a hardcoded list.
   `docs/_meta/` is a reserved, non-content meta directory (excluded from the docs
   collection); it also holds the generated `page-inventory.yaml` metadata
   lockfile. doc-kitty ships the canonical registry (the default sections,
   including `presentations/`); editing it to relabel, reorder, or subset for
   display is the supported flexibility. Declaring entirely new sections there is
   the tolerated-but-unsupported adaptation path. (Pattern adapted from a reviewed
   reference implementation.)

This resolves the fixed-vs-flexible tension. Flexibility here means two things: the
convention is amendable by us, through ADRs like this one; and the toolkit degrades
gracefully on a project's own deviations rather than breaking. Deviation is
tolerated, not supported.

## Consequences

### Positive

- Flexibility becomes a first-class, documented property, directly countering the
  docs-next-to-code failure mode.
- New page kinds and sections (presentations now, others later) slot in via a
  small, principled amendment instead of a spec fight.
- doc-kitty stops implying strict Common Docs compliance and owns an explicit,
  versioned variation with a clear amendment trail.

### Negative

- Divergence from vanilla Common Docs: a vanilla tree needs migration (`index.md`
  to `README.md` plus frontmatter, and possibly new sections). Covered by the
  [adopting guide](../guides/adopting.md) and the `doc-kitty-convert` skill.
- Tolerating deviation weakens the closed-enum guarantee. The validator validates
  the canonical set strictly, but treats a project's unknown `type` values and
  non-canonical sections as advisory (warn, not fail). That is graceful
  degradation for unsupported deviation, not an endorsed extension path.
- OKF interoperability caveat: OKF requires a non-empty `type` and tolerates
  producer-chosen values, so conformance holds. Bespoke sections and types will
  not map to a generic consumer's known categories.

### Risks

- Section sprawl if canonical additions are undisciplined. Mitigation: an addition
  is canonical only when recorded here (amendment log) and reflected in the
  convention's directory list, `type` table, and section order, as done for
  `presentations/` below.

## Amendment log — canonical sections beyond Common Docs

| Section | `type` | Order | Added by | Purpose |
|---|---|---|---|---|
| `presentations/` | `Presentation` | appended (after `changelog`) | ADR-0004 | Markdown-authored reveal.js slide decks. |

## Alternatives considered

### Option A: Adhere strictly to Common Docs

Rejected. The fixed section set and the frontmatter-free `index.md` rule fight
README-as-index, metadata-first authoring, and flexibility, reproducing the
rigidity doc-kitty exists to remove.

### Option B: Fork entirely / invent a bespoke convention

Rejected. It loses OKF conformance, agent-tooling interoperability, and the base
itself, for more work and less compatibility. Amending a good base beats replacing
it.

## Implementation touch-points (deferred to M1/M6)

Recorded so implementation picks them up; no code changes are made by this ADR:

- **Section registry:** read `docs/_meta/sections.yaml` (id/label/order/purpose/
  feeds) to derive section identity, sidebar labels, ordering, and feeds, replacing
  the hardcoded `SECTION_ORDER`/`SECTION_LABEL` in `lib/metadata.ts`. Exclude
  `docs/_meta/**` from the content loader glob. Ship a canonical default
  `sections.yaml` (including `presentations`).
- `lib/schema.ts`: extend the canonical `type` set with `Presentation`; make
  unknown `type` values advisory rather than a hard schema failure.
- `scripts/scaffold.mjs` and `validate-frontmatter.mjs`: source sections from the
  registry; add `presentations` to the type-by-path map; warn (not fail) on unknown
  types and non-canonical sections.

## References

- [Convention](../context/convention.md), the spec this ADR governs.
- [ADR-0002](./0002-readme-as-index.md), [ADR-0003](./0003-root-docs-and-agent-extension.md),
  [ADR-0005](./0005-frontmatter-doc-status-and-divio-type.md).
- [Roadmap](../plans/roadmap.md), reveal.js decks (M6).
- velvet-tiger/common-docs; Open Knowledge Format (OKF) v0.2.
