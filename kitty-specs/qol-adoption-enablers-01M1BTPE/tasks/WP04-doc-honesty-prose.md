---
work_package_id: WP04
title: Doc-honesty prose (#44 narrative)
dependencies:
- WP01
requirement_refs:
- FR-009
- FR-010
planning_base_branch: feat/qol-adoption-enablers
merge_target_branch: feat/qol-adoption-enablers
branch_strategy: Planning artifacts for this mission were generated on feat/qol-adoption-enablers. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/qol-adoption-enablers unless the human explicitly redirects the landing branch.
subtasks:
- T018
- T019
- T020
history:
- created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: AGENTS.md
create_intent: []
execution_mode: code_change
owned_files:
- AGENTS.md
- README.md
- src/README.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load your profile via `/ad-hoc-profile-load scribe-sally` (role: implementer) and the charter context (`spec-kitty charter context --action implement --json`). State what you applied. You maintain neutral, traceable, accurate documentation (DIRECTIVE_037 living-docs, DIRECTIVE_047 audience-oriented). Describe reality; do not overclaim.

## Objective

Bring doc-kitty's own project docs into truth. Read `../spec.md` (FR-009, FR-010, US3 scenarios 4–5, SC-005), `../research.md`, and `../decisions/post-spec-squad.md` (the FR-009 planner MAJOR: describe the AMENDED contract, not the pre-mission "required" posture).

## Critical context (squad-verified)

- **AGENTS.md** currently: requires the stale `status` field (renamed `doc_status` by ADR-0005/0009) and omits `kind`; lists only 4 sections vs the 13 in `docs/_meta/sections.yaml`.
- CRITICAL sequencing: this WP depends on WP01, which makes `type`/`kind` **optional/derived**. AGENTS.md must describe the **amended** contract (`type` optional & registry-derived, `kind` optional) — NOT re-assert "required", or it lands freshly-stale.
- **README.md** (`:15-17`, `:39`) and **src/README.md** (`:8-11`) say "early scaffold / before the build toolchain is wired up" — false (live build/test/validate/a11y toolchain + 30+ ADRs). Reframe honestly. Do NOT overclaim: license is still `UNLICENSED` (README `:51-53`) — state it truthfully.
- "twelve-section" wording is NOT drift (documented base convention; `sections.yaml`=13 adds Kitty `presentations`) — leave it or clarify, don't "fix" it into a wrong number.

## Subtasks

### T018 — AGENTS.md
- Replace stale `status` with `doc_status`; add `kind` to the documented field set; describe the amended contract (`type` optional/derived, `kind` optional — reference ADR-0004/0009/0031 landed by WP01). Rebuild the section enumeration from `docs/_meta/sections.yaml` (all 13). Scan for any other drift (dead paths, wrong counts, outdated commands) and fix.

### T019 — READMEs
- `README.md` + `src/README.md`: replace the "early scaffold / before the build toolchain is wired up" framing with an accurate description of the shipped toolkit (build + test + validate + a11y in CI; static site with sitemap/RSS/agent-API; 30+ ADRs). State the UNLICENSED status truthfully; do not imply a license exists.

### T020 — Cross-check
- Grep for residual stale markers (`status:` as a field reference, "early scaffold", "wired up", 4-section lists). Confirm AGENTS.md section count == `sections.yaml`; confirm the contract description matches WP01's amended behavior. No overclaim.

## Branch strategy
Planning/base `feat/qol-adoption-enablers`; merge target `feat/qol-adoption-enablers` (PR to `main` later). Lane/worktree from `finalize-tasks`. Depends on WP01 (must describe the amended contract).

## Definition of Done
- FR-009/010 satisfied; SC-005 (prose half) holds: no stale `status`/"early scaffold"; AGENTS.md lists all 13 sections and the amended optional-frontmatter contract; UNLICENSED stated honestly; no overclaim.

## Reviewer guidance
Verify AGENTS.md describes the POST-mission contract (optional/derived), not "required"; section list matches `sections.yaml`; no "early scaffold" remains; license framing is honest (still UNLICENSED). Confirm "twelve-section" base-convention wording was not mis-"corrected".
