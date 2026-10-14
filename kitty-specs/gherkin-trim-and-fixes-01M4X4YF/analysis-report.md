---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: gherkin-trim-and-fixes-01M4X4YF
mission_id: 01M4X4YFF50NC7V053W0H2MGG9
generated_at: '2026-10-14T12:22:05.939477+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: kitty-specs/gherkin-trim-and-fixes-01M4X4YF/spec.md
    sha256: 02455c8cf4a33edc9329dda3d7262576ebbfe9407dfdca91badad3727beb01b1
  plan.md:
    path: kitty-specs/gherkin-trim-and-fixes-01M4X4YF/plan.md
    sha256: 754509eecf47351446cdfdeb1d1c6f2fc2e7a50dd434b265d5faf0492aa97b66
  tasks.md:
    path: kitty-specs/gherkin-trim-and-fixes-01M4X4YF/tasks.md
    sha256: 766321d0c02c7cc2fe64b7e5c998d172b1dec74dbad24158d68847a96521df12
  charter:
    path: .kittify/charter/charter.yaml
    sha256: a31f288ab9518a3b391733e14850b07822b9c826d9549366b8dc2c232a008e20
verdict: ready
issue_counts:
  critical: 0
  high: 0
  low: 3
  medium: 2
  info: 0
findings:
- id: U1
  severity: medium
  category: underspecification
  summary: FR-012 'one smoke per emitter (generated-page HTML)' does not name which existing test is that smoke; the built-HTML proof lives outside vitest (tests/a11y/gherkin.spec.ts, assert-build-artifacts.mjs).
- id: I1
  severity: medium
  category: inconsistency
  summary: WP05 writes research/test-verdicts.md under kitty-specs/ although it is a code_change WP that may not own kitty-specs paths.
- id: I2
  severity: low
  category: inconsistency
  summary: WP03 edits src/lib/config.ts and src/lib/gherkin/generate.mjs outside its owned files; recorded as out-of-map and sequenced before WP04/after WP02.
- id: C1
  severity: low
  category: coverage
  summary: NFR-004 (measurable trim) is reported, not gated, by design (C-004); only WP05 T021 covers it.
- id: A1
  severity: low
  category: ambiguity
  summary: Spec states the issue's '4,700 overlapping lines' as context; the inventory finds about 390 lines of real duplication. Expectation should be set in the PR.
---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| U1 | Underspecification | MEDIUM | spec.md FR-012; tasks/WP05 | The generated-page HTML smoke is not named. | In WP05, name the kept smokes explicitly: generated pages → `gherkin-render` goldens + `generate:210` (Markdown) and `tests/a11y/gherkin.spec.ts` / `assert-build-artifacts.mjs` (HTML); fences → `gherkin-fence` FEATURE_FENCE render; includes → `gherkin-include` site row + `assert-consumer-gherkin.mjs`. |
| I1 | Inconsistency | MEDIUM | tasks/WP05 T018 | Verdict file is a planning artifact written from a code WP. | Write the verdict table into the PR body and commit `research/test-verdicts.md` on the planning branch from the root checkout, not from the lane. |
| I2 | Inconsistency | LOW | tasks/WP03 T011, T013 | Out-of-map edits to WP02/WP04-owned files. | Keep the chain order WP02 → WP03 → WP04 and record the edits in the WP03 hand-off. |
| C1 | Coverage | LOW | spec.md NFR-004 | Reported, not gated. | Accept (C-004 forbids a ratchet). |
| A1 | Ambiguity | LOW | spec.md Summary | Expectation gap on trim size. | State the measured size in the PR. |

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 near-miss warning | Yes | T003, T004 | red-first |
| FR-002 draft hub | Yes | T005–T007 | |
| FR-003 setting-independent generation | Yes | T008 | |
| FR-004 titles | Yes | T011 | |
| FR-005 titles validation | Yes | T009, T010 | |
| FR-006 CLI parity | Yes | T012 | |
| FR-007 example + docs | Yes | T014, T023 | |
| FR-008 scenario-index check | Yes | T015–T017 | |
| FR-009 parity | Yes | T001, T002 | |
| FR-010 verdict tables | Yes | T018 | |
| FR-011 planted breaks | Yes | T019 | |
| FR-012 target shape | Yes | T020 | see U1 |
| FR-013 records | Yes | T022–T024 | |
| NFR-001 suite green | Yes | T021 + each WP DoD | |
| NFR-002 no orphaned behaviour | Yes | T019 | |
| NFR-003 determinism | Yes | T008 | |
| NFR-004 measurable trim | Yes | T021 | reported |

**Charter Alignment Issues:** none. ADR immutability is honoured (new ADR-0054); docs updated in the same change; no CI change.

**Unmapped Tasks:** none.

**Metrics:**

- Total Requirements: 17 (13 FR, 4 NFR) plus 8 constraints
- Total Tasks: 24
- Coverage: 100%
- Ambiguity Count: 1
- Duplication Count: 0
- Critical Issues Count: 0

### Next actions

No blocking findings. Proceed to implementation; apply U1 and I1 inside WP05 (they change how the WP is executed, not the plan).
