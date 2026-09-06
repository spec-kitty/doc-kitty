---
work_package_id: WP01
title: Total feed comparator + slug-sorted collection + regression tests
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- FR-001
- FR-002
- FR-003
- NFR-001
- NFR-002
- NFR-003
planning_base_branch: feat/feed-order-determinism
merge_target_branch: feat/feed-order-determinism
branch_strategy: Planning artifacts for this mission were generated on feat/feed-order-determinism. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/feed-order-determinism unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/metadata.ts
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/metadata.ts
- src/lib/routes/shared.ts
- src/tests/metadata.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

```
/ad-hoc-profile-load implementer-ivan
```

## Objective

Make feed ordering build-reproducible (issue #85): a total comparator in
`rankForFeed` (updated desc, then slug asc, locale-independent) and a
slug-sorted `collectDocEntries`, pinned by a shuffled-input unit test.

## Context (read first)

- `src/lib/metadata.ts` `rankForFeed` (~L507): `.filter(isPublished).sort((a,b) => updatedMillis(b.data) - updatedMillis(a.data))`. `rankForAgents` just above shows the total-comparator style used in this file (section → priority → `title.localeCompare`).
- `src/lib/routes/shared.ts` `collectDocEntries` (~L17): maps `getCollection('docs')` to `DocEntry[]`; Astro-bound (no pure unit seam).
- `src/tests/metadata.test.ts` ~L101: existing `rankForFeed drops drafts and sorts by updated desc` test with fixture `entries`.
- Spec/plan/research/contract in `kitty-specs/feed-order-determinism-01M1VV64/`.

## Subtasks

### T001 — Total comparator
- In `rankForFeed`, after the `updatedMillis` delta, break ties by ascending slug using a **locale-independent** comparison (`a.slug.localeCompare(b.slug, 'en')` or `a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0`). Keep filter and primary key untouched. Update the docstring to state the full order and why (#85: content-layer insertion order is nondeterministic).

### T002 — Slug-sorted collection
- Add a small exported pure helper in `src/lib/routes/shared.ts` (e.g. `sortBySlug(entries: DocEntry[]): DocEntry[]`, non-mutating, same comparison as T001 — consider reusing one shared `compareSlug` exported from `metadata.ts` so the two never diverge) and apply it in `collectDocEntries` before returning. Docstring: order contract per `contracts/feed-order.md`.

### T003 — Shuffle test for `rankForFeed`
- In `src/tests/metadata.test.ts`: build ≥4 published entries where ≥3 share the same `updated`; rank the list and a DETERMINISTIC permutation of it (e.g. reversed, and an interleaved order) and assert identical slug sequences; assert tied entries are in ascending slug order and a newer entry still comes first. No `Math.random`. Verify the test FAILS if you temporarily remove the tiebreak (report that you did).

### T004 — Collect-order contract test
- Test the pure helper from T002 (shuffled input → ascending slug; original array not mutated). If `shared.ts` cannot be imported under vitest because of `astro:content`, put the helper (and `compareSlug`) in `metadata.ts` instead and import from there; `shared.ts` then only calls it. Say which you did.

### T005 — Verify
- `cd src && pnpm test` → all green (previously 943; expect +2 or +3).
- `cd src && ./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | wc -l` → 30 (pre-existing baseline), none in `lib/metadata.ts` / `lib/routes/shared.ts`.
- `git diff --stat` → only owned files; no `package.json`.
- Do NOT run `astro check`. Do NOT commit — the orchestrator owns commits and runs the build oracle.

## Definition of Done
- Comparator total, locale-independent; collection slug-sorted; tests pin it and fail without it; suite green; tsc baseline unchanged; scope respected.

## Reviewer Guidance
- Confirm the comparator is total (unique slug) and locale-independent.
- Confirm no consumer of `collectDocEntries` relied on insertion order (grep consumers; `buildDocsIndex` is a keyed map).
- Confirm the shuffle test is deterministic and actually fails without the tiebreak.
