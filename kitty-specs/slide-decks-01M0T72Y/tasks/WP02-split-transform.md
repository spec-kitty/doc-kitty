---
work_package_id: WP02
title: Split transform + directives + notes (pure, unit-tested)
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-007
- FR-008
- FR-018
planning_base_branch: feat/slide-decks
merge_target_branch: feat/slide-decks
branch_strategy: Planning artifacts for this mission were generated on feat/slide-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/slide-decks unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
- T011
- T012
history:
- '2026-08-24: authored by /spec-kitty.tasks'
- '2026-08-24: post-tasks squad remediation (config.ts is net-new remark plumbing; insertion point; extra edge cases)'
agent_profile: implementer-ivan
agent: claude
authoritative_surface: src/lib/remark/
create_intent:
- src/lib/remark/deck-split.ts
- src/lib/remark/deck-split.internal.ts
- src/tests/deck-split.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/deck-split.ts
- src/lib/remark/deck-split.internal.ts
- src/tests/deck-split.test.ts
- src/lib/config.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../data-model.md](../data-model.md),
[../contracts/deck-split-transform.md](../contracts/deck-split-transform.md), and
`docs/adr/0012-slide-decks-static-reveal-from-markdown.md` +
`docs/adr/0022-reveal-integration-and-token-theme.md`.

## Objective

Build the **single guarded remark transform** that turns a `kind: Presentation` deck's
mdast into slide `<section>`s at build time, plus its directive/note parsing, plus a full
Astro-free vitest suite. Pure logic lives in `deck-split.internal.ts` (unit-tested); the
plugin wrapper (`deck-split.ts`) applies the frontmatter guard.

**Scope guard is load-bearing**: the transform must be a **no-op** on any page whose
`kind !== 'Presentation'` — `---` stays `<hr>`, comments stay comments. This keeps every
documentation page byte-identical.

## Subtasks

### T008 — Plugin scaffold + guard + **net-new** integration wiring
- `deck-split.ts`: a remark plugin that `early-returns` unless
  `file.data.astro?.frontmatter?.kind === 'Presentation'`, then delegates to the pure
  helpers in `deck-split.internal.ts`.
- **`src/lib/config.ts` has no existing `remarkPlugins` seam** — this is **net-new plumbing,
  not a mirror.** Add an `astro:config:setup` hook inside `defineDocKittyIntegrations` that
  calls `updateConfig({ markdown: { remarkPlugins: [deckSplit] } })`. **Insertion point**:
  append the plugin **after** `remark-gfm` so headings/`thematicBreak` are already parsed;
  frontmatter is already stripped by the content layer, so a body `---` is a `thematicBreak`,
  never confused with frontmatter (see Risks). It runs before `mdast-util-to-hast`, so
  `data.hName`/`hProperties` are honored.
- Add a subtask-level check: a **non-deck** page is byte-identical after this wiring (the
  guard makes the global plugin a no-op off decks).

### T009 — Pure grouping (the heart)
- In `deck-split.internal.ts`, a single pass over `root.children` producing an ordered list
  of section nodes (`{ type:'deckSection', data:{ hName:'section', hProperties } }`):
  - content before first `##` → **title slide** (heading synthesized from
    `title`/`description`/`hero_image`);
  - `##` (depth 2) → close current, open new **horizontal**;
  - `###` (depth 3) → **convert** current horizontal to a **stack**: its accumulated content
    becomes inner #1, the `###` opens inner #2; the outer stack contains **only** inner
    sections;
  - `thematicBreak` (`---`) → close current, open **headingless** horizontal, **drop** the
    node, set `aria-label` (e.g. `Slide N`);
  - `####`+ → stay **inside** the current slide.
- **Edge behaviours to pin** (not implementer's choice): a deck with **no `##` at all** → a
  single title slide; a `###` appearing **before the first `##`** → it converts the **title
  slide** into a stack (title content = inner #1, the `###` = inner #2), same rule as any
  `##`. Preserve **document order** (the linear fallback depends on it).

### T010 — Directive parsing
- `html` node `^<!--\s*\.slide:\s*(.+?)\s*-->$` → parse `key="value"` pairs (+ bare tokens)
  → merge onto the **enclosing section** `hProperties` (multiple → merge, **last-wins per
  key**); remove the node.
- `html` node `^<!--\s*\.element:\s*(.+?)\s*-->$` → merge onto the **preceding sibling**
  `hProperties`; no preceding sibling → `file.message(...)` warn + skip; remove the node.
- Unknown directive key → `file.message(...)` warn; **never throw** (open-vocabulary).

### T011 — `Note:` → aside
- A paragraph whose first text child starts with `Note:` → a `deckNote` (`hName:'aside'`,
  `className:['notes']`, and **`data-pagefind-ignore`** in `hProperties`) that is a **direct
  child** of its slide's section (so the Notes plugin surfaces it; WP04 asserts it is not
  indexed). v1: single block after `Note:`.

### T012 — vitest suite
- `src/tests/deck-split.test.ts` (no Astro): title-slide from frontmatter · `##` split
  count/order · `###` stack conversion + only-inner invariant · **`###` before first `##`
  converts the title slide** · **no `##` → single title slide** · `---` headingless +
  `aria-label` + no `<hr>` · `####` stays in-slide · `.slide` attrs on section · **multiple
  `.slide` merge last-wins** · `.element` attrs on preceding block · `.element` no-sibling
  warn · unknown directive warn (no throw) · `Note:` → aside child (with
  `data-pagefind-ignore`) · **guard**: a non-Presentation page returned unchanged (`---`→`<hr>`).

## Branch Strategy

Planning branch: `feat/slide-decks`. Final merge target: `feat/slide-decks`. Runs
**parallel to WP03**. Implement with `spec-kitty agent action implement WP02 --agent claude`.

## Definition of Done

- The transform splits a deck per the rules and is a **no-op** off decks (guard test green).
- The integration hook registers the plugin via `astro:config:setup`/`updateConfig` (net-new),
  after GFM; a non-deck page is byte-identical.
- Directives and `Note:` map correctly; unknown directives warn without failing.
- vitest matrix (incl. the two added edges + last-wins) green; logic is Astro-free.
- `ci-ok` green (the WP01 draft deck now renders as real slides).

## Risks / Reviewer guidance

- **Stack conversion** — verify the outer stack `<section>` contains only inner `<section>`s
  and a `##` slide's own prose becomes inner #1.
- **Scope guard** — verify a non-Presentation fixture is untouched (the whole docs corpus
  depends on this).
- **thematicBreak vs frontmatter `---`** — the content layer strips frontmatter before this
  plugin, so only body `---` reaches it as a `thematicBreak`; confirm no double-eat.
