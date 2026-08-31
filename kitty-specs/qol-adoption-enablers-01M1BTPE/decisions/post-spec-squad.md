# Post-spec brownfield squad — convergent findings & resolutions

Point-cut: after `/spec-kitty.specify`, before `/spec-kitty.plan`. 3 profile-loaded read-only lenses (architect-alphonso, reviewer-renata, planner-priti). Question: does the spec match brownfield reality and is scope/boundary/assumptions sound?

## BLOCKER (architect) — ADR-index topology error → resolved in rev2 + owner decision
doc-kitty's own `docs/` tree is **never** Astro-built (only `example/` is: `package.json:13`, `example/astro.config.mjs`, `example/src/content.config.ts:17 base:'docs'`). So `docs/adr/README.md`'s `kind: Hub` is inert; deleting its table would leave no index, and ADR-0030 drift occurred in exactly this un-rendered tree. **Owner decision:** generator script + lockfile-style sync-check for the own tree (FR-007); Hub for `example/docs/adr/` (FR-013). C-004 reframed: generated artifact + regeneration-clean check ≠ the rejected hand-maintenance bijection gate.

## MAJOR (reviewer + planner, convergent) — FR-006 "plain edits" unsafe → rescoped
`plans/features/* → Feature` is hardcoded in the derivation (`metadata.ts:236`, `validate-frontmatter.mjs:222`). Blanket re-typing frontmatter creates permanent authored-vs-derived mismatch warnings on all 19 pages. **Owner decision:** keep `Feature` a valid type; do a **targeted per-page correction** of only genuinely-misplaced pages so authored==derived (zero residual warnings). No derivation-subtype surgery. #40's neutralize-Feature is proven via the override mechanism + fixtures.

## MAJOR (reviewer) — FR-004 must resolve override against DERIVED types → FR-004/005 reworded
Removing `Feature` from the enum while `plans/features→Feature` derivation still fires would self-contradict FR-001. rev2 FR-004 now owns "applied to authored **and** derived values"; US2 scenario 3 added.

## MAJOR (reviewer) — NFR-001 "net-new only" unachievable → reworded
`kind`-optional flips `schema-validator-parity.test.ts:92` (`missing-kind` rejected→accepted). rev2 NFR-001: retarget the fixture; no test deleted/weakened to pass.

## MAJOR (architect) — vocab runtime split-brain → NFR-004 reworded
Static-array parity tests won't prove the mjs/ts twins **resolve** the same YAML identically. rev2 NFR-004: assert agreement on the **resolved** vocabulary; apply the override transform at both the derivation switch and authored path, in both twins.

## MAJOR (planner) — FR-009 (AGENTS.md) contradicts FR-001/002 → reconciled + resequenced
AGENTS.md must describe the **amended** contract (type optional/derived, kind optional), sequenced after the ADRs. rev2 FR-009 + US3 scenario 4.

## Fakeable-AC sharpenings (reviewer) → folded
- FR-003: assert structured `warnings[]` fired (not console text).
- FR-013: assert rendered `/adr/` HTML (not source grep); FR-007: sync-check + generated row.
- FR-008: both polarities (valid passes, dangling fails) in one test.

## Confirmed sound (all lenses concede)
- #38 ↔ loader separability: `validate-frontmatter.mjs` uses its own `walk()`, zero glob/symlink coupling → C-001 split is clean. (Forward note: Mission B's symlink fix must also touch `walk()`'s `statSync`.)
- #44 ↔ loader separability.
- `_meta/vocabulary.yaml` disk seam (not the ADR-0008 theme merge) — correct; resolver beside `loadSectionRegistry` + mjs twin.
- #41/FR-011/C-003 fully sound: first-path-segment switch types ADRs at any depth; don't broaden to `adr/**`.

## Follow-ups filed, not folded (C-006)
(a) `plans/features/ → plans/missions/` folder rename (route churn, Mission B); (b) mjs↔ts vocab/derivation split-brain consolidation (structural, DIRECTIVE_043/044); (c) ADR-number-ordered, status-aware Hub card.

## Planner WP shape (for /plan)
Spine (serial on the hot file `validate-frontmatter.mjs` + parity twins): WP1 #38 gate-relax + registry-derived type + kind-optional + #41 guard + ADR amendments → WP2 #40 vocabulary.yaml seam+resolver+ADR → WP3 #40 targeted own-corpus correction (one isolated commit, last). Parallel track (independent files): WP4 #44 ADR-index generator + sync-check + ref-integrity + example Hub table removal; WP5 #44 doc-honesty prose (AGENTS.md/READMEs/convention.md) — gated AFTER the amended ADRs settle.
