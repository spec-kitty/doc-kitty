---
title: Design readiness
description: "Which features are ready to spec, and which underdesigned aspects need an ADR or design pass first."
status: active
updated: 2026-08-22
type: Plan
authors:
  - stijn@sddevelopment.be
related:
  - plans/roadmap
  - architecture/theming
  - architecture/metadata-model
---

# Design readiness

An assessment of whether each planned feature has enough design to spec into a
mission, and where it does not, the artifact that would close the gap. It comes
from a two-lens architectural review of the plan and the underlying design. Update
it as gaps close.

Verdict: M0 (CI/CD) and M1's contract are ready to spec. The shared presentation
substrate — the slot surface and per-kind layout resolution — is now designed
(ADR-0011, [theming.md](../architecture/theming.md), and the
[Spec Kitty brand theme](../architecture/theming-spec-kitty-brand.md)), so the
metadata chrome, personas, and the audience/related/reference blocks are unblocked.
Slide decks now have their own pass on top of that substrate (ADR-0012). The next
open Phase-1 gaps are the section registry and the catalog collections.

## Ready to spec now

- **M0 CI/CD** — the pipeline design is specified.
- **M1 schema, validator, and migration** — the metadata contract is finalized.
- **The coded rendering and RSS/`llms.txt` generators** — the behaviour exists in
  `src/`; their architecture docs are outlines and need backfilling from the code
  (documentation debt, not a design hole).
- **Markua** — after a light ADR that ratifies the chosen approach.

## Underdesigned — needs a pass first

Ranked, most blocking first. Each names the artifact that closes it: a new ADR (a
real decision), a new or expanded architecture doc, or a refinement.

### Foundational, MVP-blocking

1. **Component system and theme. — CLOSED (2026-08-22).** The curated slot surface,
   the per-kind layout resolution mechanism, and the token catalog are now specified
   in [theming.md](../architecture/theming.md) and [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md),
   with the first brand theme derived in [theming-spec-kitty-brand.md](../architecture/theming-spec-kitty-brand.md).
   This was the highest-leverage gap; closing it unblocks chrome, personas, and the
   relationship blocks. Decks (gap 2) still need their own pass.
2. **Slide decks. — CLOSED (2026-08-22).** The slide-splitting convention, the
   self-contained static reveal.js pipeline, and the `Presentation` layout are now
   specified in [slide-decks.md](../architecture/slide-decks.md) and
   [ADR-0012](../adr/0012-slide-decks-static-reveal-from-markdown.md), on top of
   gap 1's substrate.
3. **Section registry (`_meta/sections.yaml`).** Decided in ADR-0004 but the schema,
   the loader, the `feeds` semantics, and `type`-to-section derivation are
   undefined; the code still hardcodes the section order. Artifact: refine
   [loader-and-schema.md](../architecture/loader-and-schema.md) and
   [generators.md](../architecture/generators.md).
4. **Catalog collections (`bibliography`, `tools`).** `external_references {type,id}`
   names them with no record schema, storage location, or resolution and failure
   rule. Blocks the Must/MVP audience-and-references feature. Artifact: a
   [metadata-model.md](../architecture/metadata-model.md) refinement, plus an ADR if
   the storage choice is a real decision.

### Cross-cutting

5. **CI artifact persistence.** One unresolved decision — committed cache versus
   build artifact versus a git-ref marker — blocks the ticketing cache, the QA
   results, and the nightly-smoke marker. Artifact: a CI ADR that clears all three.
6. **Portal ingestion (anti-corruption layer).** The three portals share a
   paradigm in prose but have no shared internal-model and inbound-mapper contract.
   Artifact: a cross-portal ADR deciding shared versus standalone, then per-portal
   refinements: the ticketing datamodel and mapper, the mission-status
   orchestrator-api shape and its own gating model, and the QA test-result model.

### Extension passes (Should/Could, less urgent)

7. **Markua** — promote the research to an ADR (the preprocess-to-directive
   approach) and pin the normaliser's block-detection rules.
8. **Diagrams** — the self-contained PlantUML approach is a real unmade decision
   (PlantUML normally needs Java or a Kroki server). Artifact: an ADR.
9. **Glossary and Contextive** — near-greenfield: the `.contextive` loader and the
   first-occurrence auto-link plugin. Artifact: an architecture doc and an ADR.
10. **Sitemap and HATEOAS read API** — the `_links` relation set is undefined.
    Artifact: a `generators.md` refinement.
11. **Doctrine variation** — vague by nature; defer to its mission.

## Sequence of design passes

- **Phase 1 (unblocks MVP speccing):** 1 (theme slot surface and per-kind layout) —
  done; 2 (decks) — done; next 3 (section registry); then 4 (catalog collections);
  backfill the outline docs.
- **Cross-cutting, before portals are scheduled:** 5 (CI persistence), 6 (portal
  ingestion).
- **Later:** Markua ADR, diagrams, glossary, `_links`, doctrine.
