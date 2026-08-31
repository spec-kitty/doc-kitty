# Post-tasks anti-laziness/feasibility squad — findings & resolutions

Point-cut: after `/spec-kitty.tasks`, before `/spec-kitty.analyze`/implement. 3 profile-loaded read-only lenses (reviewer-renata anti-laziness, paula-patterns decomposition/ownership, node-norris implementer feasibility). Convergent, all folded into the WP prompts + spec.

## BLOCKER (renata) + MAJOR (paula) — WP02 metric is fakeable AND inverted → reframed
All 19 `docs/plans/features/` pages are ALREADY `type: Feature`; derivation is `Feature`; so "zero path-mismatch warnings" is green **before any work**, and correctly re-typing a misplaced page would *create* a warning. The only warning-free type fix is relocation, whose target (`plans/missions/`) is the deferred C-006a rename. **Resolution:** reframe WP02 to (1) a required reviewable classification of all 19 pages; (2) in-place `kind` corrections only (`kind` is not path-derived; `type` stays `Feature`); (3) genuinely type-misplaced pages filed as relocation follow-ups under C-006a; (4) "zero new warnings" is a GUARD, not proof. Spec FR-006/SC-005/C-006 + WP02 rewritten.

## MAJOR (node-norris) — "apply resolve* at the derivation switch in BOTH twins" over-scopes the ts side → clarified
There is NO build-time authored-vs-derived enforcement on the ts twin: `expectedDocType` is pure derivation, `schema.ts` has no `superRefine`/runtime callers, and `metadata.ts:211` forbids importing `sections.ts` (fs-free). Threading vocab through `expectedDocType` would ripple through all call sites + both parity tests for no behavioral gain. **Resolution:** the resolver wiring lives ONLY in the mjs `validate()` (the single enforcement surface); `sections.ts loadVocabulary` is a standalone unit pinned by the T004(e) parity test; the mjs twin mirrors it. Do NOT thread vocab into `metadata.ts`. WP01 T005 + spec NFR-004 clarified.

## MAJOR (paula) — sync-check can't gate CI in-map → ownership fix
Root `validate` = `pnpm --filter example run validate` (example tree) and CI runs gates as explicit steps (`ci.yml:100-144`); no lane owned `.github/workflows/ci.yml`. **Resolution:** added `.github/workflows/ci.yml` to WP03 `owned_files` (one `pnpm validate:adr-index` step). Otherwise SC-003a is vacuously green.

## MAJOR (renata) — fakeable DoDs tightened
- WP01 T001: `missing-kind` retarget must be an explicit ACCEPT assertion (move to accept path, `validatorRejects===false` AND `buildRejects===false`), not array-element deletion (NFR-001). node-norris confirmed mechanics: move from `PRESENCE_LENIENT` to `SHAPE_PARITY reject:false`.
- WP01 T004(e): parity fixture MUST be non-default (alias + forbid); assert `resolveType('Feature')==='Mission'` on both resolvers — else resolved-vs-static is indistinguishable.
- WP01 T001(c): add an orphan/root null-derivation fixture (US1 AS-3) — previously pinned by nothing.
- WP03 T013: add a STALE/mutated negative fixture that must red the `--check` (both-polarity like T014).
- WP03 T011: divergent Status/Date fixtures incl. the `**Accepted** —` markdown-emphasis case; pin the token-extraction rule.
- WP03 T016: node-norris — reuse the existing ADR-0001 (Hub-only link, non-fakeable-by-prose); NO new committed example fixture; extend (don't replace) the `SECTION_INDEX` assertion.

## MINOR folded
- WP03 T012: robust table-region boundary + UTC date slice for byte-idempotency; first-regen diff (lowercase→Accepted, curated titles) is expected, not a defect.
- WP03 T015: ref-integrity must IMPORT `collectDanglingRelated` from `check-links.mjs` (test-level), not edit that unowned file.
- WP01 T002: `validate()` is a branch restructure (`effective = ('type' in data)? … : expectedType(...)` → resolve → warn/forbid), not a one-liner.

## Confirmed SOUND (concede — no change)
- Decomposition/ownership: no owned_files overlap; mjs/ts twin correctly bundled in WP01 (splitting would force overlap on the hot file); WP03→WP01 single-writer ADR-index seam correct; DAG WP01→{WP02,WP03,WP04} right; #41 guard-only genuinely already passes.
- Vocabulary seam feasible (sections.ts has no Astro coupling; gray-matter reads vocabulary.yaml like sections.yaml; no new dep).
- ADR generator, referential-integrity reuse, Hub build-assertion all feasible against real code.
- Interim WP01-landed/WP03-pending stale-README window is benign (sync-check ships with WP03; don't run accept between them).
