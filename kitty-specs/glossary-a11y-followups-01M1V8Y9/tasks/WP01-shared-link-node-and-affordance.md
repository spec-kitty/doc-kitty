---
work_package_id: WP01
title: Shared glossary link-node builder + AT-perceivable affordance
dependencies: []
requirement_refs:
- C-001
- C-002
- C-004
- FR-001
- FR-002
- FR-003
- FR-005
- NFR-001
- NFR-002
- NFR-003
- NFR-005
planning_base_branch: feat/glossary-a11y-followups
merge_target_branch: feat/glossary-a11y-followups
branch_strategy: Planning artifacts for this mission were generated on feat/glossary-a11y-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary-a11y-followups unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/glossary/
create_intent:
- src/lib/glossary/link-node.ts
execution_mode: code_change
owned_files:
- src/lib/glossary/link-node.ts
- src/lib/remark/glossary-autolink.internal.ts
- src/lib/remark/glossary-term.ts
- src/tests/glossary-link-node-parity.test.ts
- src/tests/glossary-autolink.test.ts
- src/tests/glossary-term.test.ts
- docs/architecture/glossary.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile:

```
/ad-hoc-profile-load implementer-ivan
```

Adopt its identity, boundaries, and quality discipline for the whole work package.

## Objective

Collapse the two byte-identical glossary link-node builders into **one** shared
builder, and add an AT-perceivable term affordance (`aria-label`) in that single
place — so an auto-link and a `:term` link stay byte-identical while every glossary
term anchor tells assistive technology it is a glossary term (issues #79 + #77).

## Context (read these first)

- `src/lib/remark/glossary-autolink.internal.ts` — `makeLinkNode(context,
  contextSlug, anchor, termName, surface, basePrefix)` at ~L166. Returns a `link`
  node with `hProperties` = `{class:'dk-glossary-link', 'data-glossary-term',
  '-context', '-anchor', '-context-slug'}`, url via `glossaryTermUrl`. Uses local
  interface `MdNode`.
- `src/lib/remark/glossary-term.ts` — `glossaryLinkNode(context, contextSlug,
  anchor, termName, children, basePrefix)` at ~L114. Byte-identical bag; uses local
  interface `MdastNode`. Called from `transformDirective`.
- `src/lib/glossary/resolve.ts` — exports `glossaryTermUrl(basePrefix, contextSlug,
  anchor)` (the single href source, #61/#63) and `resolveSurface`. The new builder
  lives beside it, in `src/lib/glossary/`.
- `src/tests/glossary-link-node-parity.test.ts` — live cross-emitter parity guard;
  invokes BOTH real emitters and asserts node equality.
- `docs/architecture/glossary.md` — "Hover preview footprint" section documents the
  shared link-node shape; contract at `contracts/shared-link-node.md`.
- Decision `01M1V8ZYHJYYVGY438PB166WAX` (spec C-002): the affordance is `aria-label`,
  chosen because it is an attribute (never enters the `textContent` used-list surface).

## Subtasks

### T001 — Create `src/lib/glossary/link-node.ts` (the one shared builder)

- Export `glossaryLinkNode(context, contextSlug, anchor, termName, children,
  basePrefix)` returning the `link` node with the full `hProperties` bag currently
  duplicated in both files, url via `glossaryTermUrl(basePrefix, contextSlug,
  anchor)` (import from `./resolve.js`).
- Declare a **minimal structural return type** (e.g. `GlossaryLinkNode` with
  `type`, `url`, `children`, `data.hProperties`) that both callers' local `MdNode` /
  `MdastNode` interfaces satisfy structurally. **Do NOT add `@types/mdast`** — keep
  the hand-rolled-node precedent (diagram-meta / the existing two builders).
- **Add the affordance here (T with T005 tests, C-002):** set
  `hProperties['aria-label'] = `${visibleText}, glossary term`` where `visibleText`
  is the concatenation of the text descendants of `children`. Provide a small local
  `textOf(children)` helper (mirror `glossary-term.ts` `textOf` / autolink
  `textContent`). If `visibleText` is empty, omit the leading text — but a resolved
  glossary link always has a surface, so this is a guard, not a normal path.
- Keep the visible `children` as the link's children unchanged — the aria-label is
  an **attribute only**, never an extra child node (FR-005).

### T002 — Rewire `makeLinkNode` (glossary-autolink.internal.ts) to delegate

- Replace the body of `makeLinkNode` so it wraps its `surface: string` into
  `children = [{ type: 'text', value: surface }]` and returns
  `glossaryLinkNode(context, contextSlug, anchor, termName, children, basePrefix)`
  from the new module (`../glossary/link-node.js`).
- Keep `makeLinkNode`'s existing signature/callers unchanged (still takes
  `surface`), so `expandTextNode` at ~L230 is untouched. The docstring should now
  point at the shared builder as the source of the shape.
- Remove the now-duplicated inline `hProperties` literal.

### T003 — Rewire `glossaryLinkNode` (glossary-term.ts) to delegate

- Replace the local `glossaryLinkNode` body to call the shared builder (import from
  `../glossary/link-node.js`), or replace its call site in `transformDirective` to
  use the shared builder directly and delete the local function. Prefer deleting the
  local duplicate and importing the shared one under the same name to minimise call-site churn.
- The `:term` label children handling in `transformDirective` (rich labels) is
  unchanged — it already passes `children` through.

### T004 — Extend the cross-emitter parity test for `aria-label`

- In `src/tests/glossary-link-node-parity.test.ts`, the equality assertion already
  compares the two emitters' nodes; confirm it now also covers `aria-label` (it
  will, if it deep-compares the bag). Add an explicit assertion that the emitted
  `aria-label` equals `"cargo, glossary term"` for the fixture term, so a regression
  that drops the attribute from the shared builder is caught by name.

### T005 — Update per-builder golden tests

- `src/tests/glossary-autolink.test.ts` and `src/tests/glossary-term.test.ts` pin
  their builder's node to a hardcoded literal. Add `'aria-label': '<surface>, glossary
  term'` to those golden literals so they match the new shape. Keep every other key
  identical.
- Verify no other test asserts the absence of `aria-label` on these nodes.

### T006 — Docs: architecture footprint + ADR/changelog note

- `docs/architecture/glossary.md` "Hover preview footprint" section: add one or two
  sentences that the shared link node now also carries an `aria-label` = visible text
  + ", glossary term", making the term programmatically distinguishable for
  assistive tech (no-JS-safe, attribute-only so the links-used surface is unchanged),
  and that it is emitted from the ONE shared builder (`src/lib/glossary/link-node.ts`).
- Add a short ADR **or** a CHANGELOG entry (match whatever the repo uses for a small
  a11y contract change — check `docs/adr/` numbering and `validate:adr-index`; if an
  ADR, keep the adr-index valid). Reference #77/#79 and the decision id.

## Branch Strategy

- Planning base and final merge target: **`feat/glossary-a11y-followups`**.
- Delivery is **direct-to-feat**: the orchestrator commits your changes to that
  branch (no lane worktree). Work in the repo root checkout.

## Definition of Done

- One shared builder in `src/lib/glossary/link-node.ts`; both emitters import/delegate
  to it; no second inline `hProperties` literal remains (C-001).
- Href still single-sourced via `glossaryTermUrl` (C-004).
- `aria-label` present on both emitters' nodes, byte-identical (NFR-001), leading
  with visible text (NFR-005), attribute-only (FR-005).
- `pnpm test` green — parity test, both golden tests, and the re-derive parity guard
  (`glossary-substrate-parity.test.ts`) pass **without** a new keyed exclusion (if
  that guard needs editing, stop — the affordance leaked into a build stage).
- No `@types/mdast` dependency added.
- Docs updated; `validate:adr-index` stays valid.

## Reviewer Guidance

- Diff the two emitters: they must now produce identical nodes via one builder.
- Confirm `aria-label` is an attribute, not a child; confirm `collectLinksUsed` /
  the count-pins are unaffected (the used-list surface is still the plain term).
- Confirm the re-derive parity guard is untouched or still green.
