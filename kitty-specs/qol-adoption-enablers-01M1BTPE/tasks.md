# Tasks — QOL Adoption-Enabler Cluster

**Mission**: qol-adoption-enablers-01M1BTPE · **Branch**: `feat/qol-adoption-enablers` → merge target `feat/qol-adoption-enablers` (PR to `main` later)
**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Squad evidence**: [decisions/post-spec-squad.md](./decisions/post-spec-squad.md)

Test-first throughout (DIRECTIVE_034/041): acceptance pinned to structured `warnings[]` (FR-003), rendered `/adr/` HTML (FR-013), both-polarity ref-integrity fixtures (FR-008), retargeted `missing-kind` fixture (NFR-001), resolved-vocab parity (NFR-004).

## Dependency graph

```
WP01 (frontmatter contract: optional + derived + overridable, #38/#40/#41)
  ├──▶ WP02 (targeted own-corpus Feature correction, #40 dogfood)
  ├──▶ WP03 (ADR-index generator + integrity + example Hub, #44)   [needs WP01's new ADR present]
  └──▶ WP04 (doc-honesty prose, #44)                               [needs the amended contract]
```
WP01 is foundational (the hot file + all ADR add/amend). WP02/WP03/WP04 parallelize after it.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Retarget `missing-kind` fixture + add optional/derived + warning fixtures | WP01 | |
| T002 | Relax gate: `type` optional+derived (absent case), `kind` optional, authored-wins + `warnings[]` | WP01 | |
| T003 | #41 depth-tolerance guard on both twins | WP01 | |
| T004 | Vocabulary fixtures (authored/derived alias, forbid, no-file default) + resolved-vocab parity | WP01 | |
| T005 | `_meta/vocabulary.yaml` + `loadVocabulary` resolver (sections.ts) + mjs twin; apply to authored+derived | WP01 | |
| T006 | Amend ADR-0004 + ADR-0009; add ADR-0031 vocabulary-override | WP01 | |
| T007 | Full parity/gate sweep green (NFR-001..004) | WP01 | |
| T008 | Review the 19 `docs/plans/features/` pages; classify genuinely-misplaced | WP02 | [P] |
| T009 | Correct misplaced pages (plain edits; keep `Feature` valid; untouched if correct) | WP02 | |
| T010 | Verify zero path-mismatch warnings; single isolated commit | WP02 | |
| T011 | Generator test: deterministic/idempotent, number-ordered, era-recursive, Status/Date | WP03 | [P] |
| T012 | `generate-adr-index.mjs` — regenerate `docs/adr/README.md` table | WP03 | |
| T013 | `--check` sync-check + wire into `package.json` validate | WP03 | |
| T014 | Referential-integrity both-polarity fixtures | WP03 | |
| T015 | Referential-integrity guard (reuse `collectDanglingRelated` shape) | WP03 | |
| T016 | Delete `example/docs/adr` table; extend `assert-build-artifacts.mjs` (rendered `/adr/` HTML) | WP03 | |
| T017 | `convention.md` living-docs sync (table = generated); add ADR-0032 generator/two-tree note | WP03 | |
| T018 | `AGENTS.md`: `status`→`doc_status`, full section list, amended optional-frontmatter contract | WP04 | [P] |
| T019 | `README.md` + `src/README.md`: reframe "early scaffold"; honest toolchain; UNLICENSED honest | WP04 | |
| T020 | Cross-check: no stale claims remain; consistent with amended contract | WP04 | |

## Work Packages

### WP01 — Frontmatter contract: optional, derived, overridable (#38 + #40 mechanism + #41 guard)
- **Goal**: The shared type/kind contract becomes optional + registry-derived + vocabulary-overridable, on the bare-Node gate and the ts twin, pinned by resolved-vocabulary and depth-tolerance parity; ADRs amended/added.
- **Priority**: P1 (foundational spine).
- **Independent test**: `pnpm --filter @commondocs-kitty/toolkit test` (parity + fixtures green) and `node src/scripts/validate-frontmatter.mjs docs` (corpus green, no regressions).
- **Subtasks**: T001, T002, T003, T004, T005, T006, T007
- **Dependencies**: none
- **Prompt**: `tasks/WP01-frontmatter-contract.md` (~520 lines)
- **Risks**: mjs/ts split-brain (mirror the resolver + apply at authored AND derived on both); non-total derivation must be deterministic; do NOT delete tests to pass (retarget).

### WP02 — Targeted own-corpus Feature correction (#40 dogfood) — reframed post-tasks
- **Goal**: A reviewable classification of all 19 `docs/plans/features/` pages + in-place `kind` corrections (type stays `Feature`, path-derived/frozen) + genuinely type-misplaced pages filed as relocation follow-ups (C-006a). `Feature` stays valid; no new warnings.
- **Priority**: P2.
- **Independent test**: the committed classification (all 19, verdict+rationale) is the completion artifact; `node src/scripts/validate-frontmatter.mjs docs` shows **no new** path-mismatch warnings (a guard — it is already green pre-work, so it does NOT prove completion).
- **Subtasks**: T008, T009, T010
- **Dependencies**: WP01 (effective-type semantics settled)
- **Prompt**: `tasks/WP02-own-corpus-correction.md`
- **Risks**: the naive "zero warnings" metric is fakeable + inverted (see post-tasks-squad.md); `kind` is the in-scope lever; relocation deferred; NO bulk-edit flow (C-002); one isolated commit.

### WP03 — ADR-index generator + integrity + example Hub (#44)
- **Goal**: Own-tree `docs/adr/README.md` becomes a generated artifact (number-ordered, Status/Date) with a lockfile-style sync-check; referential-integrity guard; example tree drops its table so the Hub auto-lists (verified in built HTML); convention.md synced.
- **Priority**: P2.
- **Independent test**: `node src/scripts/generate-adr-index.mjs --check` clean; generator + ref-integrity tests green; `pnpm --filter example build && node src/scripts/assert-build-artifacts.mjs`.
- **Subtasks**: T011, T012, T013, T014, T015, T016, T017
- **Dependencies**: WP01 (the generated index must include WP01's new ADR-0031)
- **Prompt**: `tasks/WP03-adr-index-generator.md` (now also owns `.github/workflows/ci.yml` — the sync-check must be an explicit CI step, else SC-003a is vacuous)
- **Risks**: generator must be deterministic/idempotent (UTC date, robust table-region boundary — no false sync diffs); the `--check` needs a STALE negative fixture (both-polarity); do NOT re-introduce a bijection/hand-maintenance gate (C-004); recursive walk so era ADRs appear.

### WP04 — Doc-honesty prose (#44 narrative)
- **Goal**: AGENTS.md/README/src-README truthful: `doc_status`, full section list, the amended optional-frontmatter contract, no "early scaffold", UNLICENSED honest.
- **Priority**: P2.
- **Independent test**: grep shows no stale `status`/"early scaffold"; AGENTS.md section count == `sections.yaml`; description matches amended contract.
- **Subtasks**: T018, T019, T020
- **Dependencies**: WP01 (must describe the amended contract, not the pre-mission "required" posture)
- **Prompt**: `tasks/WP04-doc-honesty-prose.md` (~210 lines)
- **Risks**: describe post-mission contract (planner freshly-stale-on-landing trap); no overclaim (license).

## MVP scope
WP01 alone delivers the core adoption unblockers (#38 optional/derived + #40 override) and is independently testable. WP02/WP03/WP04 complete the dogfood + doc-honesty.
