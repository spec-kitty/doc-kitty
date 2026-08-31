---
work_package_id: WP03
title: ADR-index generator + integrity + example Hub (#44)
dependencies:
- WP01
requirement_refs:
- FR-007
- FR-008
- FR-012
- FR-013
planning_base_branch: feat/qol-adoption-enablers
merge_target_branch: feat/qol-adoption-enablers
branch_strategy: Planning artifacts for this mission were generated on feat/qol-adoption-enablers. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/qol-adoption-enablers unless the human explicitly redirects the landing branch.
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
- T017
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/scripts/generate-adr-index.mjs
- src/tests/adr-index-generator.test.ts
- src/tests/adr-referential-integrity.test.ts
- docs/adr/0032-adr-index-generation.md
execution_mode: code_change
owned_files:
- src/scripts/generate-adr-index.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/adr-index-generator.test.ts
- src/tests/adr-referential-integrity.test.ts
- docs/adr/README.md
- docs/adr/0032-adr-index-generation.md
- docs/context/convention.md
- example/docs/adr/README.md
- .github/workflows/ci.yml
- package.json
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load your profile via `/ad-hoc-profile-load node-norris` (role: implementer) and the charter context (`spec-kitty charter context --action implement --json`). State what you applied. Node/TS implementer, ATDD/TDD: failing test first.

## Objective

Make the ADR index **generated, not hand-maintained** — correctly for the real topology. doc-kitty's own `docs/` tree is **never** Astro-rendered (only `example/` is built), so the own-tree index is a **generated artifact** (script + lockfile-style sync-check) and the example tree drops its redundant table so the `kind: Hub` layout auto-lists. Add a referential-integrity guard for ADR cross-references. Read `../spec.md` (FR-007/b, FR-008, FR-012, US3, SC-003a/b, SC-004), `../research.md` (Decision 5 — the BLOCKER resolution), `../contracts/adr-index-generator.md`, and `../decisions/post-spec-squad.md`.

## Critical context (squad-verified BLOCKER)

- Only `example/` is Astro-built (`package.json:13` → `pnpm --filter example build`; `example/astro.config.mjs`; `example/src/content.config.ts:17 base:'docs'`). doc-kitty's own `docs/adr/README.md` (30-row table) is validated but **never rendered** — this is exactly where ADR-0030 drifted.
- So "delete table → Hub generates" is WRONG for the own tree. The own tree gets a **generator + sync-check** (C-004: this is a generated artifact + lockfile check, NOT the rejected hand-maintenance bijection gate).
- The generated own-tree table must preserve the columns the hand table had: `ID | Title | Status | Date`, number-ordered. Status is in the ADR **body** `## Status` (not frontmatter); Date is frontmatter `updated`.
- Walk ADRs **recursively** so era-partitioned `adr/<era>/` ADRs appear (consistency with WP01's #41 guard).
- This WP depends on WP01: the generated index must include WP01's new **ADR-0031**. This WP adds its own **ADR-0032**. The generator run must therefore see 0001..0032.
- `assert-build-artifacts.mjs:138-139` currently asserts only the `/adr/` H1 — extend it, don't break it.
- Do NOT re-introduce a bijection/index-sync gate that enshrines hand-maintenance (C-004).

## Subtasks

### T011 — Generator test (test-first)
- `src/tests/adr-index-generator.test.ts`: over a fixture ADR set that **deliberately varies** so the assertions can't be faked by hardcoding:
  - include an `adr/<era>/` file (recursive) and `template.md` (excluded);
  - fixtures carry **distinct** statuses (at least one `accepted` and one `superseded`) and **distinct** `updated` dates, so a generator that hardcodes "accepted"/blank or ignores the body/frontmatter reds;
  - include the real-corpus Status-prose shapes: bare `Accepted`, `Accepted. Supersedes …`, and the markdown-emphasis form `**Accepted** — 2026-08-29. Ratifies …` (ADR-0030). Pin the token-extraction rule: strip `**` emphasis, take the leading token up to the first `.`/`—`/whitespace.
- Assert: number-ordered ascending; `template.md` excluded; era ADR included; each row's exact Title/Status/Date value; **idempotent** (run twice → byte-identical). Red now.

### T012 — Generator (make green)
- `src/scripts/generate-adr-index.mjs`: discover `docs/adr/**/NNNN-*.md` recursively (exclude `template.md`), parse frontmatter + body `## Status`, rewrite ONLY the table region of `docs/adr/README.md`. Boundary detection must be robust: preserve the `# Decision Records` H1 and the intro prose ABOVE and the trailing prose ("New ADRs copy …") BELOW; replace only the contiguous `|`-prefixed block. Format `updated` back to `YYYY-MM-DD` via a **UTC slice** (not full ISO) so output is byte-idempotent (INV-A1..A3 in `../data-model.md`).
- Run it to regenerate the real `docs/adr/README.md` (now includes 0031/0032). **Expected**: the first regen produces a visible diff (committed Status is lowercase `accepted` vs body `Accepted`; hand-curated titles may differ from frontmatter `title:`). The generator becomes the authority — this diff is correct, not a defect.

### T013 — Sync-check + wiring (both polarities)
- Add a `--check` mode (regenerate to buffer, non-zero exit on any diff from the committed file). Add a `validate:adr-index` script in `package.json` AND wire it as an explicit CI step in `.github/workflows/ci.yml` (the root `validate` = `pnpm --filter example run validate` does NOT chain it, and CI runs gates as explicit steps ~`:100-144`) — otherwise the guard never gates and SC-003a is vacuously green.
- **Negative fixture (required)**: a test that takes the generated output, **mutates it** (drop a row / reorder / change a status), runs `--check` against the mutated content, and asserts **non-zero exit / reported diff**. Positive-only ("clean on the correct file") is fakeable by an always-exit-0 check — mirror the both-polarity discipline of T014. SC-003a is only met when a STALE table provably reds.

### T014 — Referential-integrity fixtures (test-first)
- `src/tests/adr-referential-integrity.test.ts`: BOTH polarities — a valid ADR→ADR reference passes; a dangling reference (to a non-existent ADR) fails (SC-004). Reuse the existing `collectDanglingRelated` shape.

### T015 — Referential-integrity guard (make green)
- Implement as a **test-level import** of the existing `collectDanglingRelated` from `src/scripts/check-links.mjs:110` (do NOT edit that unowned file). If the ADR→ADR check needs traversal the helper doesn't expose, add a new gate script to this WP's `create_intent`/`owned_files` rather than editing `check-links.mjs`. Green T014.

### T016 — Example tree → Hub + build assertion
- Delete the redundant table from `example/docs/adr/README.md` (keep frontmatter/prose); the `kind: Hub` layout auto-lists on build (`Hub.astro:76-96`).
- Extend the existing `SECTION_INDEX` assertion in `src/scripts/assert-build-artifacts.mjs` (do NOT replace it): after the table is gone, assert the **built** `/adr/` HTML contains the Hub-rendered link to the existing ADR-0001 (`href="…/adr/0001-use-astro-starlight/"`). Reuse 0001 — **no new committed example fixture** (avoids polluting the example). This link is non-fakeable-by-source-grep: the example prose links `/adr/template/`, not `0001`, so a built `0001` link can ONLY come from the Hub auto-list (SC-003b). The sitemap URL-count guard is unaffected (routes unchanged).

### T017 — Living-docs sync + ADR
- Update `docs/context/convention.md` (~:199) so it states the ADR table is generated (no longer "hand-maintained ... and the adr/README.md table"). Add `docs/adr/0032-adr-index-generation.md` (status accepted): the two-tree mechanism (generator for own tree, Hub for example), the sync-check-as-lockfile rationale (C-004), and the deferred number-ordered/status-aware Hub-card follow-up (C-006). Re-run the generator so 0032 is in the index.

## Branch strategy
Planning/base `feat/qol-adoption-enablers`; merge target `feat/qol-adoption-enablers` (PR to `main` later). Lane/worktree from `finalize-tasks`. Depends on WP01 so the generated index includes ADR-0031.

## Definition of Done
- FR-007/b, FR-008, FR-012 satisfied; SC-003a/b, SC-004 pass.
- `generate-adr-index.mjs --check` is clean on the committed `docs/adr/README.md` (which lists 0001..0032, number-ordered, Status+Date).
- Example table removed; built `/adr/` HTML lists the ADR (assert-build-artifacts extended, not broken).
- convention.md synced; ADR-0032 added; NO bijection/hand-maintenance gate introduced (C-004).
- All existing gates green.

## Reviewer guidance
Verify: the generator is deterministic/idempotent (no false sync diffs); it walks recursively (era ADRs appear); Status comes from the body and Date from frontmatter; the sync-check is a lockfile-style regenerate-clean check, not a hand-maintenance gate; the example assertion is against BUILT HTML; the index includes ADR-0031 (from WP01) and 0032. Confirm no bijection gate crept in.
