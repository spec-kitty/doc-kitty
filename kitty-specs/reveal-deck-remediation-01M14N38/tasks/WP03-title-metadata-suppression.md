---
work_package_id: WP03
title: Title-slide metadata suppression
dependencies: []
requirement_refs:
- FR-002
planning_base_branch: fix/reveal-deck-remediation
merge_target_branch: fix/reveal-deck-remediation
branch_strategy: Planning artifacts for this mission were generated on fix/reveal-deck-remediation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/reveal-deck-remediation unless the human explicitly redirects the landing branch.
subtasks:
- T010
- T011
- T012
history:
- '2026-08-28: authored by /spec-kitty.tasks (planner-priti)'
agent_profile: frontend-freddy
authoritative_surface: src/lib/remark/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/remark/deck-split.internal.ts
- src/lib/remark/deck-split.ts
- src/tests/deck-split.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Run `/ad-hoc-profile-load frontend-freddy` (role: implementer) BEFORE anything else.
Apply its initialization, boundaries, directives, and tactics. Then read this WP in
full, plus:
- [../spec.md](../spec.md) — FR-002, SC-002; US1 acceptance scenario 1.
- [../plan.md](../plan.md) — **IC-02** (title-slide metadata suppression), which cites the
  exact lines to change.
- [../contracts/deck-chrome-and-metadata.md](../contracts/deck-chrome-and-metadata.md) — **C1**.
- [../reviews/post-plan-squad.md](../reviews/post-plan-squad.md) — finding **D1** (the
  positional-index break that WILL happen and must be fixed in the same change).

## Objective

Stop the front-matter `description` from appearing as visible body text on the synthesized
title slide, while keeping it as page metadata (`<meta name="description">`, which
`DeckLayout.astro:84` already emits — do not touch that). The leak is a **transform**
defect: `titleChildren()` synthesizes a `description` paragraph into the title slide.
Remove that paragraph and update the coupled unit tests in the same change (they WILL
break otherwise — a parity risk the squad flagged).

You own the deck-split module pair and its unit test. This is a small, surgical WP — the
risk is entirely in getting the test parity right, not the production change.

### Why this is a transform defect (not a DeckLayout defect)

The plan (IC-02) is explicit: the description reaches the slide because the pure transform
BUILDS it into the title `<section>`, not because DeckLayout renders it wrong. DeckLayout's
use of `description` (`<meta name="description" content={description}>`, `DeckLayout.astro:84`)
is CORRECT metadata usage and stays. So the fix is at exactly one place —
`titleChildren()` — and it propagates for free to (a) the live reveal DOM, (b) the no-JS
SSR body, and (c) the Pagefind-indexed `.slides` region, because all three derive from the
same transformed tree. That is why no DeckLayout change is needed and why the unit test
(which exercises `splitDeck` directly on hand-built mdast) is the right lock.

### Before / after of `titleChildren()`

```
BEFORE (deck-split.internal.ts:171-201)   AFTER
  [ heading(title h1),                       [ heading(title h1),
    paragraph(description),   ← REMOVE         paragraph(hero image) ]   ← now index 1
    paragraph(hero image) ]   ← was index 2
```

The single structural consequence is that `hero_image` moves from title child index 2 to
index 1 — which is the entire reason T011 exists.

## Subtasks

### T010 — Drop the description paragraph from `titleChildren()`
In `src/lib/remark/deck-split.internal.ts`, `titleChildren()` (`:171-201`) currently
pushes three things onto the title slide: the `title` `<h1>` (`:173-175`), a
**`description` paragraph** (`:176-178`), and the `hero_image` paragraph (`:181-199`).
Remove the description-paragraph block (`:176-178`) entirely. Keep the `<h1>` and the
`hero_image`. After the change, `titleChildren` synthesizes `[heading, (hero paragraph)]`
— no description paragraph.

- ADR-0012 FR-003 ("always emit a titled slide") stays satisfied: the title slide is still
  synthesized and still titled — only the redundant description paragraph is gone.
- The description remains page metadata (DeckLayout's `<meta>`). Do not add it back
  anywhere in the `.slides` body, the no-JS SSR body, or the Pagefind-indexed region.
- `src/lib/remark/deck-split.ts` (the plugin wrapper) needs no logic change; you own it to
  keep the module pair together. Touch it only if a type/import ripple requires it.

### T011 — Fix the two coupled assertions in `deck-split.test.ts` (finding D1)
Removing the description paragraph shifts the hero image's positional index. In
`src/tests/deck-split.test.ts` the first grouping test (`:45-61`) currently asserts:
- a comment "heading (h1) + description paragraph + hero image paragraph" (`:56`), and
- `const img = title.children[2]?.children?.[0];` (`:59`) — index **2** because the
  description used to be child **1**.

With the description gone, the hero image moves from `title.children[2]` to
`title.children[1]`. Update that test:
- Change `title.children[2]` → `title.children[1]` (`:59`).
- Update the `:56` comment to reflect "heading (h1) + hero image paragraph" (no description).
- Remove any assertion that expects a description paragraph on the title slide, here or
  elsewhere in the file. (Search the file for `'Sub'` / `description` usage in title-slide
  assertions.) NOTE: the frontmatter constant `DECK` (`:19-23`) keeps its `description`
  field — that is INPUT, and the `<meta>` path still uses it; only the assertion that the
  description becomes slide BODY content is removed.

Confirm you did NOT disturb the tests IC-02 says are unaffected: the no-`##` single-slide
test (`:113-127`), and the B-05 leading-`.element` test (`:277-287`). The B-05 test loops
over `children[0].children` asserting none carry an injected class — that still holds
(fewer children now, all still unclassed).

### T012 — Add a POSITIVE assertion that no title paragraph equals the description
Add a new unit assertion (in the grouping describe block) that pins the fix directly and
non-vacuously: given a deck whose frontmatter carries a non-empty `description`,
`splitDeck` produces a title slide whose children include **no `paragraph` node whose
text equals the description string**. For example:

```ts
it('never synthesizes the description as title-slide body text (FR-002)', () => {
  const { children } = splitDeck(root(h(2, 'One')), {
    kind: 'Presentation', title: 'T', description: 'LEAK-SENTINEL',
  });
  const title = children[0];
  const hasDescPara = title.children.some(
    (c) => c.type === 'paragraph'
      && c.children?.some((k) => k.type === 'text' && k.value === 'LEAK-SENTINEL'),
  );
  expect(hasDescPara, 'the description must not appear as a title-slide paragraph').toBe(false);
});
```

Use a distinctive sentinel string so the assertion cannot pass vacuously against
incidental text. This is the FR-002 unit half; WP05 owns the Playwright half.

## Validation

- `pnpm test src/tests/deck-split.test.ts` (or `npx vitest run src/tests/deck-split.test.ts`)
  — all describe blocks green, including your new positive assertion.
- `pnpm typecheck` / `npx tsc --noEmit` — the mdast structural types still hold.
- `pnpm lint` on the two changed source files.
- Grep the built example (optional but reassuring): after `pnpm build`, the showcase deck's
  `dist/.../presentations/showcase-deck/index.html` should carry the description in
  `<meta name="description">` but NOT as a `<p>` inside the first `<section>`.

## Branch Strategy

Planning base and final merge target: `fix/reveal-deck-remediation`. Work in the worktree
allocated to this WP's lane in `lanes.json`; changes merge back into the mission branch.
No dependencies — runs in Wave 1 alongside WP01, WP04, WP06.

## Definition of Done

- `titleChildren()` no longer synthesizes a description paragraph; the `<h1>` and
  `hero_image` remain; ADR-0012 FR-003 (always a titled slide) still holds (FR-002, C1).
- `deck-split.test.ts` is green: the description assertion is removed AND the positional
  hero index is corrected to `title.children[1]` (finding D1); the no-`##` and B-05 tests
  are untouched and still pass.
- A new positive assertion proves no title-slide paragraph equals the description
  (non-vacuous, sentinel-based) — the FR-002 unit lock.
- `vitest` green on the changed scope; `typecheck` + `eslint` green.

## Risks

- The ENTIRE risk is test parity: forgetting the positional-index fix (D1) leaves the hero
  test red even though the production change is correct. Make both edits in one change.
- Do not remove the `description` field from the `DECK` fixture constant — it is still
  valid input and other paths (the `<meta>` usage, not in this file) depend on the concept.
- Do not touch `DeckLayout.astro` — the `<meta name="description">` there is correct and is
  WP02's file anyway.

## Reviewer guidance

- Confirm the production diff removes exactly the `:176-178` description block and nothing
  else structural in `titleChildren`.
- Confirm the hero index moved 2→1 and the new positive assertion uses a distinctive
  sentinel.
- Run `vitest src/tests/deck-split.test.ts` and confirm all describe blocks pass.
