---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: post-markua-hardening-01M18HD2
mission_id: 01M18HD2G0ZEW57XYN24BV7SQT
generated_at: '2026-08-30T05:53:12.339085+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: /workspace/doc-kitty/kitty-specs/post-markua-hardening-01M18HD2/spec.md
    sha256: 2a0f3232b03e796ac98759773a82194d7a5d178613c3100d473b4261c399623b
  plan.md:
    path: /workspace/doc-kitty/kitty-specs/post-markua-hardening-01M18HD2/plan.md
    sha256: 691d90ad545bf1f440ffdaacad2b9a05fb8d9e2260a28bf740b941375943eff8
  tasks.md:
    path: /workspace/doc-kitty/kitty-specs/post-markua-hardening-01M18HD2/tasks.md
    sha256: 78966c59df009d46c06746b6c674e65fdb35ffeb40ea110a1ed20cff9bb74789
  charter:
    path: /workspace/doc-kitty/.kittify/charter/charter.yaml
    sha256: 4dfc1be02167adb7fc10cce16eac90d0e6fd0aa6f22b90e7a0cb0f38055697de
verdict: ready
issue_counts:
  medium: 0
  high: 0
  low: 3
  critical: 0
  info: 0
findings:
- id: I1
  severity: low
  category: inconsistency
  summary: "WP frontmatter merge_target_branch (feat/post-markua-hardening) vs body 'Final merge target: main' — two distinct targets (spec-kitty mission merge vs eventual PR), potentially read as a contradiction."
- id: A1
  severity: low
  category: ambiguity
  summary: WP01 body cites diagram.spec.ts pre-toggle read at :508 while research cites :511/:513 — descriptive anchor drift; the pin (fillBefore must resolve to a real triple) is intact.
- id: C1
  severity: low
  category: coverage
  summary: NFR-002 full byte-identity diff -r runs at consolidation; WP04 (production markua-attributes.ts) relies on build+assert:markua as its interim corpus check.
---

## Specification Analysis Report

Cross-artifact consistency for mission `post-markua-hardening-01M18HD2` (spec.md, plan.md, tasks.md + data-model/research/contracts). These artifacts were already hardened by post-plan and post-tasks adversarial point-cuts; this pass confirms internal consistency and coverage.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | LOW | tasks/WP01–WP05 frontmatter vs body | `merge_target_branch: feat/post-markua-hardening` (spec-kitty mission/coordination merge) vs body "Final merge target: `main`" (eventual same-repo PR) reads as a contradiction to a fast skim. | Leave frontmatter (tooling-authoritative); the body context distinguishes the PR target. Optional one-word clarification. Not a blocker. |
| A1 | Ambiguity | LOW | tasks/WP01 §Context vs research.md §D-01 | Pre-toggle read cited at `:508` in the WP, `:511/:513` in research. | Descriptive only; the C34 pin (fillBefore → real triple, fail-on-sentinel) is unambiguous. Implementer verifies exact line at edit time. |
| C1 | Coverage | LOW | spec.md NFR-002 / tasks WP04 | Full `diff -r` byte-identity runs at consolidation; WP04 uses build + assert:markua as its interim corpus check (no shipped fixture stacks attribute paragraphs). | Confirm the consolidation `diff -r` gate runs; acceptable interim coverage. |

**Coverage Summary Table:**

| Requirement | Has Task? | WP / Subtasks | Notes |
|-------------|-----------|---------------|-------|
| FR-001 empty-tolerant toggle read | Yes | WP01 / T001,T003 | |
| FR-002 shared colour helper (class-close) | Yes | WP01 / T001,T003,T004,T005 | |
| FR-003 parity drift guard | Yes | WP03 / T013,T017 | |
| FR-004 guard sourced from build stack, false-green-proof | Yes | WP03 / T012,T013,T015 | |
| FR-005 five passes deck-agnostic via one seam | Yes | WP02 / T006,T007,T008,T010 | |
| FR-006 fold scattered deck checks | Yes | WP02 / T009 + C36b | |
| FR-007 preserve stacked attr paragraphs | Yes | WP04 / T018,T019 | |
| FR-008 non-vacuous callouts test | Yes | WP04 / T020 | |
| FR-009 living-docs sync | Yes | WP05 / T021–T025 (+config breadcrumb WP02, page-processor WP03) | |
| FR-010 file (b) follow-up | Partial | WP05 writes reference; orchestrator files at consolidation | By design (documented) |
| NFR-001 flake eliminated (20/20) | Yes | WP01 / T005 | |
| NFR-002 byte-identity | Yes | WP02 / T011 + consolidation diff | See C1 |
| NFR-003 #34 test-only | Yes | WP01 ownership (tests/a11y only) | |
| NFR-004 mutation-effective tests | Yes | contracts C34/C36e; WP01 T002, WP04 T020 | |
| SC-001..005 | Yes | mapped across WP01/02/03 + consolidation | |

**Charter Alignment Issues:** None. DIRECTIVE_040/043 (close by construction) satisfied and correctly scoped (not overclaimed for #35 after post-plan fold); DIRECTIVE_037 (living-docs) → FR-009/WP05; DIRECTIVE_044 (consolidation not proliferation) → C-005/WP02; DIRECTIVE_051 (supply-chain) N/A explicit (no deps); DIRECTIVE_034/036/041 (test discipline) honoured.

**Unmapped Tasks:** None — every subtask T001–T025 rolls up to a requirement/contract.

**Metrics:**
- Total Requirements: 10 FR + 4 NFR + 6 C = 20
- Total Tasks: 25 subtasks / 5 WPs
- Coverage: 100% of FRs have ≥1 task (FR-010 partial-by-design)
- Ambiguity Count: 1 (LOW)
- Duplication Count: 0
- Critical Issues Count: 0

## Next Actions

No CRITICAL/HIGH/MEDIUM findings — **ready to implement**. The three LOW findings are cosmetic/by-design and need no pre-implementation edit. Proceed to `/spec-kitty.implement` (or the implement-review loop). Ensure the consolidation `diff -r` byte-identity gate runs (C1) and the orchestrator files the (b) follow-up issue at consolidation (FR-010).
