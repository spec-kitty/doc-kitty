---
work_package_id: WP03
title: Discovery wiring (RSS exclusion + section labelling), before the deck
dependencies: []
requirement_refs:
- FR-011
planning_base_branch: feat/slide-decks
merge_target_branch: feat/slide-decks
branch_strategy: Planning artifacts for this mission were generated on feat/slide-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/slide-decks unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/
create_intent:
- src/tests/metadata-sections.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/rss.ts
- src/lib/metadata.ts
- src/tests/metadata-sections.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../data-model.md](../data-model.md), and
`docs/adr/0021-deck-routing-seam-out-of-frame-override.md` (D5, feeds).

## Objective

Wire discovery so a deck later lands into **correctly configured** surfaces and the
`build-example` count pins can be recomputed **exactly once** in WP04. Two edits: exclude
`kind: Presentation` from the RSS feed, and add `presentations` to the section
order/label maps so llms.txt and the agent API group it properly instead of ranking it
"unknown-last." Both are **inert** while `presentations/` is empty (only WP01's draft deck
exists, and drafts are `doc_status`-gated), so this WP is green on its own.

This WP **must precede WP04** (squad P-01): if the deck landed before this wiring, it would
leak into RSS or group as a bare slug, and the pins would need a second recompute.

## Subtasks

### T013 — RSS: exclude `kind: Presentation`
- In `src/lib/routes/rss.ts`, filter `data.kind !== 'Presentation'` in the **`rss.ts` route
  body** — around the `rankForFeed(await collectDocEntries())` call — **not** inside the
  shared `rankForFeed` helper (which lives in `metadata.ts` and must not change feed
  behaviour for other surfaces; RT-07). Key the exclusion on the **frontmatter `kind`**, not
  the section path (squad A-05) — robust regardless of where a deck is filed. Honors
  `sections.yaml` `feeds: [sitemap, llms, agent]` (no RSS).
- Leave sitemap/llms/agent inclusion untouched (a deck should appear there).

### T014 — `metadata.ts`: label `presentations`
- **`SECTION_ORDER` is a plain array where array position is the rank** (there is no numeric
  "115" in it — that value is from `sections.yaml`, not an array index). **Append
  `'presentations'` after `'changelog'`** in the `SECTION_ORDER` array and add a
  `SECTION_LABEL['presentations'] = 'Presentations'`. This fixes `sectionRank`/label so decks
  group correctly in llms/agent instead of ranking unknown-last.

### T015 — Unit coverage
- `src/tests/metadata-sections.test.ts`: assert `sectionRank('presentations')` is finite
  and ordered after `changelog`, `SECTION_LABEL['presentations']` is the human label, and
  the RSS filter drops a `kind: Presentation` fixture while keeping a normal doc.

## Branch Strategy

Planning branch: `feat/slide-decks`. Final merge target: `feat/slide-decks`. Runs
**parallel to WP02**, **before WP04**. Implement with
`spec-kitty agent action implement WP03 --agent claude`.

## Definition of Done

- A `kind: Presentation` entry is absent from the RSS feed; still present in sitemap/llms/agent.
- `presentations` is ordered + labelled in `metadata.ts`.
- Unit tests green; `ci-ok` green (inert on the empty published section).

## Risks / Reviewer guidance

- Verify the RSS exclusion keys on `kind`, not path — a deck filed elsewhere (should be
  impossible per FR-022, but defense in depth) must still be excluded.
- Confirm no doc page's section grouping changed (only `presentations` added).
