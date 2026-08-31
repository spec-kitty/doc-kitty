# Research — QOL Adoption-Enabler Cluster

Phase 0 consolidation. Most grounding was done pre-spec (3-lane research squad → `scratchpad/GROUNDING-BRIEF.md`) and hardened post-spec (3-lens brownfield squad → `decisions/post-spec-squad.md`). No `[NEEDS CLARIFICATION]` markers remain. No dependency change (see plan Supply-Chain note), so the supply-chain adversarial pass is N/A; the adversarial evidence below is the post-spec squad's contested-finding dispositions.

## Decision 1 — `type`/`kind` optional lives only in the bare-Node gate (#38)
- **Decision**: Relax `src/scripts/validate-frontmatter.mjs` only; `src/lib/schema.ts` is already optional (`:139,:142`).
- **Rationale**: The site zod schema already accepts absent `type`/`kind`; the strictness is the standalone gate (`:277-278`, `:100`). Smallest diff, no build-side change.
- **Alternatives**: Change the zod schema too — rejected (already optional; would be a no-op or a regression risk).

## Decision 2 — Authored-wins + advisory warn via structured `warnings[]` (#38)
- **Decision**: Derivation fills only the absent case; an authored `type` always wins; a mismatch is an advisory entry in the validator's structured `warnings[]`.
- **Rationale**: Preserves ADR-0004 behavior; a structured warning is test-observable without console coupling (DIRECTIVE_041). The gate already returns `{problems, warnings}`.
- **Alternatives**: Registry-wins (owner rejected — churns existing docs, surprises authors); console-only warning (fakeable — rejected).

## Decision 3 — Vocabulary override is on-disk `_meta/vocabulary.yaml`, not the theme merge (#40)
- **Decision**: A disk `_meta/vocabulary.yaml` (sibling to `sections.yaml`), resolved `default → consumer`, read by the bare-Node gate via the existing `gray-matter` YAML path; a `loadVocabulary()` resolver beside `loadSectionRegistry` in `sections.ts` with a hand-mirrored twin in the gate.
- **Rationale**: The gate runs outside `astro build`, so an ADR-0008 theme-merge (build-only) override is invisible to CI (NFR-003). Vocabulary is governance data, not presentation. Precedent: `sections.yaml` is already dual-read by mjs + ts.
- **Alternatives**: JS/theme config override (rejected — no build context in the gate); env-var/CLI flag (rejected — not declarative, not per-consumer-portable).

## Decision 4 — Override applies to authored AND derived values (#40)
- **Decision**: The alias/neutralize/forbid transform is applied both to authored values and to the section-derived value, on both twins.
- **Rationale**: Otherwise an untyped `plans/features/` page *derives* `Feature`; if the override removed `Feature` from the enum, the derived value would self-fail (reviewer MAJOR). The override must reach derived values.
- **Alternatives**: Authored-only override (rejected — self-contradicts FR-001 derivation).

## Decision 5 — ADR index: generator + lockfile sync-check for own tree; Hub for example (#44) — BLOCKER resolved
- **Decision**: doc-kitty's own `docs/adr/README.md` becomes a generated artifact (`generate-adr-index.mjs`), number-ordered with ID/Title/Status/Date, kept honest by a regeneration-clean CI check. `example/docs/adr/` drops its redundant table and the `kind: Hub` layout auto-lists.
- **Rationale**: Only `example/` is Astro-built (`package.json:13`, `example/astro.config.mjs`, `content.config.ts:17 base:'docs'`); doc-kitty's own `docs/` tree is validated but never rendered, and that is exactly where ADR-0030 drift occurred. "Delete table → Hub generates" would leave the own tree indexless. A generator is genuine generation (source of truth = the ADR files); the sync-check is a lockfile, not the rejected hand-maintenance bijection gate (C-004).
- **Alternatives**: Keep hand table + append 0030 + ref-integrity only (owner rejected — drift recurs); build doc-kitty's own `docs/` as a second Astro site (rejected — Mission-B-scale build-topology change + Hub can't do number-ordering/body-Status).

## Decision 6 — Targeted per-page Feature correction; keep Feature valid (#40 dogfood) — squad-driven
- **Decision**: `Feature` stays a valid doc-kitty default type. Correct only `docs/plans/features/` pages whose content is genuinely not a feature so authored == derived (zero residual path-mismatch warnings). No blanket re-type, no `plans/features→Feature` derivation-subtype change.
- **Rationale**: The subtype is hardcoded (`metadata.ts:236` + mjs twin); blanket re-typing while it fires would create permanent mismatch warnings (reviewer + planner MAJOR). doc-kitty isn't Mission-canon, so `Feature` is legitimate for it; #40's neutralization is proven via the override mechanism + fixtures (an *adopter* neutralizes it).
- **Alternatives**: Blanket-neutralize `Feature` in doc-kitty's own vocab + move the derivation subtype (owner rejected — bigger, touches the derivation spine, needs a term that doesn't fit doc-kitty); folder rename (deferred, C-006).

## Decision 7 — #41 is guard-only; do not broaden the mapping (#41)
- **Decision**: Add a depth-tolerance regression test on both twins; leave the first-path-segment switch untouched.
- **Rationale**: `sectionOf = parts[0]` already types `adr/<era>/NNNN-*.md` as ADR at any depth (verified `metadata.ts:227-243`, mjs twin). An `adr/**` glob would clobber the basename-keyed `template.md` subtype (C-003).
- **Alternatives**: Rewrite to a glob (rejected — over-match trap).

## Adversarial evidence — contested-finding dispositions (post-spec squad)
Per `contracts/adversarial-evidence-contract.md`, every contested finding's disposition:
- ADR-index topology BLOCKER (architect) → **changed** (Decision 5; generator + two-tree).
- FR-006 plain-edits-unsafe (reviewer+planner) → **changed** (Decision 6; targeted, keep Feature valid).
- FR-004 override-must-reach-derived (reviewer) → **changed** (Decision 4; spec FR-004/US2-#3).
- NFR-001 net-new-only unachievable (reviewer) → **changed** (spec NFR-001 reworded to retarget the `missing-kind` fixture).
- Runtime split-brain on resolved vocab (architect) → **changed** (spec NFR-004; parity on resolved vocab).
- FR-009 vs FR-001/002 contradiction (planner) → **changed** (spec FR-009 amended-contract + resequenced to IC-05, gated after ADRs).
- Fakeable ACs FR-003/FR-013/FR-008 (reviewer) → **changed** (structured `warnings[]` / built-HTML / both-polarity fixtures).
- Hub alphabetical ordering + body-only Status on the example tree (architect) → **deferred_with_rationale** (C-006 follow-up; acceptable for the single-ADR demo; own tree gets full fidelity via the generator).
- mjs↔ts split-brain consolidation (architect DIRECTIVE_043/044) → **deferred_with_rationale** (C-006; structural refactor out of locality budget; contained by NFR-004 parity).
- `plans/features → plans/missions` folder rename (planner) → **deferred_with_rationale** (C-006; route/link churn, Mission-B-adjacent).
No contested finding was silently dropped.
