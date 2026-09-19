---
title: Roadmap
description: "Phased plan for doc-kitty, split into MVP and extended scope with MoSCoW priorities."
doc_status: active
updated: 2026-09-19
type: Plan
kind: Planning
authors:
  - stijn@sddevelopment.be
related:
  - architecture/ci-cd-pipeline
  - adr/0010-planning-kinds-and-moscow
---

# Roadmap

This plan splits the work into an MVP and an extended scope, and prioritizes each
feature with MoSCoW. The per-feature detail lives in [features](./features/); the
reasoning behind the shape lives in the [decision records](../adr/).

**Status (2026-09-19): the MVP is delivered and productized, and the last
Should-tier feature has landed.** Every Must/MVP feature has shipped, and the
whole Extended Should tier with it (Markua, glossary, build-time diagrams, and
now the **Doctrine variation (M7)** — a native `_meta/charter.yaml` that governs
the whole convention, `#100`, ADR-0042). All eight adoption enablers from the
spec-kitty proving ground (#37–#44) are landed. Productization is done too: the
toolkit is cut at **`0.1.0`** with a CHANGELOG, and the **consumption test** (N=2,
a packed-tarball clean-room build into a net-new consumer site) has landed — so
the reuse contract is demonstrated fact, not a claim. The remaining feature
frontier is only the three **Could-tier, design-only** repository portals
(mission status, QA, ticketing). See [Where we are now](#where-we-are-now-2026-09-19)
below.

(This is a `Planning` page and its features are `Feature` pages per
[ADR-0010](../adr/0010-planning-kinds-and-moscow.md).)

## Cross-cutting priority — CI/CD

Regardless of feature order, a working, path-efficient CI/CD pipeline is the
primary concern (tests, doc sanity, example deployment). See
[CI/CD Pipeline](../architecture/ci-cd-pipeline.md). It shapes the repo layout and
every feature's definition of done.

## Decisions

The decisions behind this plan are ADRs, not prose here:

- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md) — amend
  Common Docs; `presentations/` and the `_meta/` registry.
- [ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md) /
  [ADR-0009](../adr/0009-finalize-metadata-contract.md) — the frontmatter contract
  (`doc_status`, `kind`, and the rest).
- [ADR-0006](../adr/0006-direct-render-default-projection-deferred.md) — direct
  render by default; projection deferred.
- [ADR-0007](../adr/0007-ci-cd-path-scoped-lanes.md) — the CI/CD strategy.
- [ADR-0008](../adr/0008-swappable-theme-layer.md) — the swappable theme layer.
- [ADR-0010](../adr/0010-planning-kinds-and-moscow.md) — planning kinds and the
  `moscow` field.

## Scope

### MVP — a minimal viable docsite

The docsite that renders a Common Docs — Kitty tree well and serves agents: render
the `docs/` tree (README-as-index), the metadata model and chrome, the generators,
a swappable theme, audience targeting with rendered relationships and external
references, slide decks, and the CI/CD that keeps it green. Markua support is the
near-term focus and rides just behind the core.

### Extended scope

Everything that makes the docsite richer or turns it into a repository portal:
diagrams, glossary, the doctrine variation, the realistic example content, and the
status/QA/ticketing portals.

### Out of scope (this cycle)

Selective/redacted publishing (the projection pipeline) and a book/manuscript
content type. The first is only needed to publish a filtered subset of a private
tree; the second competes with Leanpub, which we are not doing.

> **Note — Markua support ≠ an in-tool book type.** Declining an in-tool
> book/manuscript type does **not** forgo Leanpub. Markua support (below,
> Should/MVP) keeps the docs source **Markua-clean**, which makes **authoring a
> book or course on Leanpub from the same source materially easier** later — an
> export/reuse path, not doc-kitty becoming a publisher. That Leanpub-export
> dividend is in scope *because* Markua is; the in-tool book *content type* stays
> out.

## Prioritized features (MoSCoW)

| Feature | Mission | MoSCoW | Scope | Status | Rationale |
|---|---|---|---|---|---|
| Common Docs rendering (README-as-index) | — | Must | MVP | ✅ Done | The base; a docsite that does not render the tree is nothing. |
| CI/CD pipeline | M0 | Must | MVP | ✅ Done | The harness every feature lands on; the stated primary concern. |
| Metadata model + chrome | M1 | Must | MVP | ✅ Done | The contract every other feature reads and renders from. |
| Generators: RSS + llms.txt | — | Must | MVP | ✅ Done | The agent- and human-facing discovery basics. |
| Generated sitemap + HATEOAS read API | — | Should | Extended | ✅ Done | SEO sitemap and the enriched machine-readable (`_links`) agent-API both ship. |
| Component system + swappable theme | M2 | Must | MVP | ✅ Done | Theme swappability is a hard requirement (ADR-0008); per-kind layouts underpin later features. |
| Markua syntax support (subset) | — | Should | MVP | ✅ Done | Near-term focus and Leanpub compatibility; ADR-0030, plus opt-in footnotes (ADR-0041). |
| Audience + related + external references | M3 | Must | MVP | ✅ Done | Core to the human-first, agent-supported promise: audience targeting and rendered relationships. |
| Slide decks (reveal.js) | M6 | Must | MVP | ✅ Done | Presentations are a first-class output pillar; static reveal.js out-of-frame route. |
| Diagrams (Mermaid + PlantUML) | M5 / #13 | Should | Extended | ✅ Done | Client-side (M5) then build-time static SVG (#13, ADR-0040), self-contained, dual-mode. |
| Glossary + Contextive | M4 | Should | Extended | ✅ Done | Ubiquitous-language support; multi-context autolinking, hover preview, `:term` directive. |
| Example content from ars-rethorica | ars-rethorica-example | Could | Extended | ✅ Done | The ars-rethorica showcase corpus (Introduction, Preamble, Book I 15 chapters, Book II/III landings, generated rhetoric glossary, two reader personas). |
| Doctrine variation | M7 | Should | Extended | ✅ Done | Native `_meta/charter.yaml` governs the whole convention (type/kind vocab, `doc_status` set, sections/IA registry, required-field set), resolved with no Spec Kitty runtime dependency; `#100`, ADR-0042, closes #98/#99. |
| Mission status portal | — | Could | Extended | 📐 Design-only | Repository portal; depends on spec-kitty integration. |
| QA portal | — | Could | Extended | 📐 Design-only | Repository portal; depends on CI test artifacts. |
| Ticketing report | — | Could | Extended | 📐 Design-only | Repository portal; adaptor work, GitHub first. |
| Selective/redacted publishing (projection) | M8 | Won't | Out | ⏸ Deferred | Only needed to publish a filtered subset of a private tree; revisit on demand. |
| Book / manuscript content type | — | Won't | Out | ⏸ Deferred | Competes with Leanpub; we stay docsite + presentations. |

Status legend: ✅ Done · ⛔ Not started · 📐 Design-only (spec'd, no delivered
code) · ⏸ Deferred (Won't, this cycle). Each row has (or will have) a
[feature page](./features/) carrying its `moscow` label and rationale in
frontmatter.

## Adoption enablers (from the spec-kitty proving ground)

The spec-kitty adoption study
([research](../architecture/research/spec-kitty-adoption-proof.md)) surfaced a set
of **doc-kitty-side changes that reduce adoption friction for a real, large
consumer** — most of which also fix doc-kitty's own bugs (a dogfooding dividend).
**All eight are now landed** (the tracker carries no open adoption issues).

| Enabler | Friction it removes | Status |
|---|---|---|
| Loader accepts `index.md` as the section index (alongside `README.md`) | Spares an adopter renaming ~60 section indexes + rewriting ~1,589 links/redirects | ✅ [#37](https://github.com/spec-kitty/doc-kitty/issues/37) |
| `type`/`kind` optional + `type` derived from the section registry | Avoids forcing two required frontmatter fields onto a large corpus (~790 docs) | ✅ [#38](https://github.com/spec-kitty/doc-kitty/issues/38) |
| Add `durable` to the `doc_status` enum | Never-retire throughline docs otherwise hard-fail the schema | ✅ [#39](https://github.com/spec-kitty/doc-kitty/issues/39) |
| Overridable `type`/`kind` vocabulary (neutralize `Feature` for Mission-canon adopters) | Lets a canon-bound adopter avoid a prohibited term; fixes an internal inconsistency | ✅ [#40](https://github.com/spec-kitty/doc-kitty/issues/40) |
| Tolerate `adr/<era>/NNNN-` ADR paths | Adopters with >100 era-partitioned ADRs keep their structure | ✅ [#41](https://github.com/spec-kitty/doc-kitty/issues/41) |
| First-class redirect-coverage gate for migrating adopters | The highest-risk migration item (URL-scheme change) had no equivalent | ✅ [#42](https://github.com/spec-kitty/doc-kitty/issues/42) — `check-redirect-coverage.mjs` |
| Resolve LICENSE (`UNLICENSED` → add LICENSE file) | Hard blocker: no adopter can vendor doc-kitty code until licensed | ✅ [#43](https://github.com/spec-kitty/doc-kitty/issues/43) — MIT, PR #74/#75 |
| Doc-honesty fixes (ADR-0030 in index; `AGENTS.md` `status`→`doc_status` + full section list; README "early scaffold" drift) | Curated-not-wiki integrity — the repo's own convention | ✅ [#44](https://github.com/spec-kitty/doc-kitty/issues/44) |

Both hard gates from the study — **LICENSE (#43)** and the **redirect-coverage
gate (#42)** — are cleared. The loader/vocab/enum items (#37–#41) that shrink
adopter churn and the doc-honesty items (#44) are all merged. What the study
still flags as *unproven* is the reuse ceiling: the toolkit is exercised at
**N=1** (only the spec-kitty brand theme is instantiated; the `consumer` layer is
a contract, not a fleet), and there is **no versioned, install-provable release**.
Those two are exactly what the productization step below closes.

## Where we are now (2026-09-19)

The MVP is **feature-complete and productized**, and the last Should-tier feature
has landed. Both productization steps that were the frontier on 2026-09-09 have
since landed:

1. **A shippable release.** The toolkit is cut at **`0.1.0`** (was `0.0.0`), with a
   [CHANGELOG](../../CHANGELOG.md) and a clean-checkout build proof. A consumer can
   pin a real version instead of vendoring `0.0.0`.
2. **A proven consumer path (N=1 → N=2) — landed.** The **consumption test**
   mission shipped: a dedicated CI workflow packs the toolkit to a tarball and
   installs it into a net-new consumer site (a second consumer theme — the
   `consumer` layer of the default→brand→consumer merge — over the ars-rethorica
   book corpus), building it exactly as an external adopter would. The reuse
   contract is now demonstrated fact. The reproducible adopter path is written up
   in the [consumer setup guide](../guides/consumer-setup.md).

Since then the last Should-tier feature has also landed: the **Doctrine variation
(M7)** shipped as a native `_meta/charter.yaml` (`#100`, [ADR-0042](../adr/0042-native-documentation-charter.md))
that governs a docsite's whole convention — the `type`/`kind` vocabulary, the
`doc_status` set, the sections/IA registry, and the required-field set — resolved
by doc-kitty itself with **no Spec Kitty runtime dependency**, under a documented
per-axis `default → consumer` precedence. Existing `_meta/*.yaml` files still work
(with a one-shot deprecation notice), so current consumers are unaffected.

Deferred, unchanged: selective/redacted publishing (projection, M8) and an
in-tool book type both stay **Won't** this cycle.

The remaining feature frontier is only the three **Could-tier, design-only**
repository portals — mission status, QA, and ticketing — each spec'd but with no
delivered code, and each dependent on an external surface (spec-kitty integration,
CI test artifacts, and a ticket tracker respectively). They are the next
candidates for scoping if and when that integration work is prioritized.
