---
title: QOL adoption enablers — optional/overridable frontmatter, generated ADR index, doc-honesty
description: "Closes #38/#40/#41/#44 — makes type/kind optional and vocabulary-overridable, generates the ADR index instead of hand-maintaining it, and brings AGENTS.md/README into truth."
doc_status: active
updated: 2026-08-31
type: Changelog
kind: Changelog
tags: [frontmatter, metadata, adr, vocabulary, adoption, doc-honesty, testing]
related:
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0009-finalize-metadata-contract
  - adr/0031-vocabulary-override
  - adr/0032-adr-index-generation
  - context/convention
---

# 2026-08-31 — QOL adoption enablers

Four adoption-friction issues surfaced by the spec-kitty proving-ground study
([`spec-kitty-adoption-proof`](../architecture/research/spec-kitty-adoption-proof.md))
are closed here. Each also fixes one of doc-kitty's own inconsistencies — the dogfooding
dividend. Base behaviour is unchanged: on today's corpus the relaxed gate and the generated
index are no-ops, and the full suite stays green (622 tests).

## What changed

- **`type` and `kind` frontmatter are now optional (#38).** The standalone
  `validate-frontmatter.mjs` gate no longer *requires* them: an absent `type` is derived from
  the section registry (filling only the absent case), and `kind` is simply accepted when
  absent. An explicitly authored `type` still wins; a mismatch against the derived type is an
  advisory warning on the validator's structured return, not a hard failure. The site zod schema
  was already optional — only the gate is relaxed. Amends ADR-0004/0009. Large existing corpora
  no longer have to hand-annotate two fields on every file.

- **The `type`/`kind` vocabulary is overridable per consumer (#40).** A new gate-readable
  `_meta/vocabulary.yaml` (resolved `default → consumer`, sibling to `sections.yaml`) lets an
  adopter alias, neutralize, or forbid a term — so a Mission-canon consumer whose charter forbids
  `Feature` is never forced to emit it, whether the term was authored *or* section-derived. The
  resolver is a single unit in `sections.ts` with a hand-mirrored twin in the bare-Node gate,
  pinned by a resolved-vocabulary parity test; it is deliberately *not* threaded through the
  fs-free `metadata.ts` derivation. `Feature` remains a valid default. New ADR-0031. doc-kitty's
  own `plans/features/` corpus was reviewed and confirmed self-consistent (19/19 legitimate
  features — recorded as a classification, not assumed).

- **The ADR index is generated, not hand-maintained (#44).** doc-kitty's own `docs/adr/` tree is
  never Astro-rendered (only `example/` is built), so the `docs/adr/README.md` table is now a
  generated artifact: `generate-adr-index.mjs` rebuilds it from each ADR's frontmatter + body
  `## Status`, number-ordered with Status/Date, and a lockfile-style `--check` (wired into CI)
  reds if the committed table drifts — the class that let ADR-0030 land unindexed is closed by
  construction. The Hub-rendered `example/docs/adr/` drops its redundant table and demonstrates
  auto-listing instead (asserted against built HTML). A referential-integrity check catches
  dangling ADR references. New ADR-0032.

- **AGENTS.md and the READMEs tell the truth (#44).** `AGENTS.md` now references `doc_status`
  (not the renamed `status`), enumerates all thirteen registered sections (was four), and
  describes the amended optional-frontmatter contract rather than the old "required" posture.
  `README.md`/`src/README.md` drop the "early scaffold / before the build toolchain is wired up"
  framing for an accurate description of the shipped toolkit; the licence is stated honestly as
  still `UNLICENSED`.

- **Era-partitioned ADR paths stay typed (#41).** `adr/<era>/NNNN-*.md` already typed as `ADR`
  at any depth via the first-path-segment switch; a regression guard on both the ts and mjs
  derivations now pins it so a future refactor cannot silently break it.

## Deferred (filed, not folded)

`plans/features/ → plans/missions/` folder rename (route churn); the mjs↔ts vocabulary/derivation
split-brain consolidation; an ADR-number-ordered, status-aware Hub card for multi-ADR rendered
trees. The README-enforced + `README.md → index.md` symlink loader hardening remains a separate
mission (Mission B).
