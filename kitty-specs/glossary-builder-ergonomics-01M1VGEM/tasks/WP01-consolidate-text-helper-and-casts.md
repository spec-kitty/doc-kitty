---
work_package_id: WP01
title: Consolidate text helper, tighten builder casts, fix contract wording
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- C-004
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- NFR-001
- NFR-002
- NFR-003
- NFR-004
planning_base_branch: feat/glossary-builder-ergonomics
merge_target_branch: feat/glossary-builder-ergonomics
branch_strategy: Planning artifacts for this mission were generated on feat/glossary-builder-ergonomics. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary-builder-ergonomics unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
- T008
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/glossary/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/glossary/link-node.ts
- src/lib/remark/glossary-autolink.internal.ts
- src/lib/remark/glossary-term.ts
- src/tests/glossary-link-node-parity.test.ts
- tests/a11y/glossary.spec.ts
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

Behaviour-preserving cleanup (issue #83, DISCIPLINED_REFACTORING): collapse the
three equivalent subtree-text concatenators into ONE exported helper in the
glossary lib, make the shared builder's return type genuinely assignable to
both callers so the `as unknown as` casts disappear, and correct the prior
contract's wording. Optionally tighten two test nits. **No output may change**:
the orchestrator hashes a fresh `example/dist` before and after and rejects any
difference.

## Context (read these first)

- `src/lib/glossary/link-node.ts` — the ONE shared builder (`glossaryLinkNode`)
  and a private `textOf(node: LinkChild)` that feeds the `aria-label` visible
  text. `GlossaryLinkNode` is an **interface with no index signature**; that is
  the sole reason the callers need `as unknown as` (research D2: a `tsc` probe
  shows `LinkChild → MdNode` is fine and a type-alias literal of the same shape
  is fine; only the interface fails with "Index signature for type 'string' is
  missing in type 'GlossaryLinkNode'").
- `src/lib/remark/glossary-autolink.internal.ts` — `textContent(node: MdNode)`
  (visit-based) used by `seedFromExistingLinks` and `collectLinksUsed`;
  `makeLinkNode` returns `glossaryLinkNode(...) as unknown as MdNode`.
- `src/lib/remark/glossary-term.ts` — private `textOf(node: MdastNode)`
  (recursive) used by `transformDirective` for the label / warning strings /
  suppress form / fallback label; the `link` branch returns
  `glossaryLinkNode(...) as unknown as MdastNode`.
- `kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/shared-link-node.md`
  — last bullet of "The one builder" claims assignability that is only true
  after T004.
- `tests/a11y/glossary.spec.ts` `caretLeftProperty` + its two `.not.toBe('')`
  assertions (~L200, ~L265). `src/lib/glossary/preview-popover.client.ts`
  clamps the caret offset to `[CARET_HALF_PX, width - CARET_HALF_PX]`,
  `CARET_HALF_PX = 8`, written as `${n}px`.
- `src/tests/glossary-link-node-parity.test.ts` header docstring (describes the
  pre-extraction world: "each build the glossary link node from their own
  inline builder").
- Mission spec: [../spec.md](../spec.md); plan: [../plan.md](../plan.md);
  research: [../research.md](../research.md).

## Subtasks

### T001 — Export the one helper from `link-node.ts`

- Export the subtree-text helper (keep the name `textOf`; it is what both
  private variants were called). Parameter type stays the minimal structural
  `LinkChild` — both `MdNode` and `MdastNode` are already assignable to it, so
  callers pass their nodes with no cast.
- Pin the semantics: a `text` node is a **leaf** and contributes `value` only
  when `typeof value === 'string'` (else `''`); any other node concatenates
  `textOf(child)` over its `children` array in order; a node with neither
  yields `''`. Update the docstring: it is now THE helper, not a "mirror".
- Do not change what `glossaryLinkNode` does with it.

### T002 — Route `glossary-autolink.internal.ts` through it

- `import { glossaryLinkNode, textOf } from '../glossary/link-node.js'`.
- Delete `textContent`; replace both uses (`seedFromExistingLinks`,
  `collectLinksUsed`) with `textOf(n)` / `textOf(node)`. `visit` stays (it is
  still used by the walkers).
- The links-used `surface` must be unchanged for every real input (the count
  pins and `collectLinksUsed` goldens prove it).

### T003 — Route `glossary-term.ts` through it

- `import { glossaryLinkNode, textOf } from '../glossary/link-node.js'`.
- Delete the local `textOf`; `transformDirective` calls the import. All emitted
  warning strings / suppress text / fallback label are byte-identical.

### T004 — Make the builder's return type assignable; drop the casts

- In `link-node.ts` add `[key: string]: unknown;` to `GlossaryLinkNode` with a
  one-line comment naming why (interfaces get no implicit index signature; the
  callers' `MdNode`/`MdastNode` declare one, so this is what makes the return
  value assignable without a cast — #83).
- In both callers return the builder result directly: no `as unknown as`, and
  preferably no cast at all. If a plain `as MdNode` is somehow still needed,
  stop and report why rather than reintroducing `unknown`.
- Fix the `link-node.ts` module docstring paragraph that says the callers'
  interfaces are "structurally assignable to LinkChild / GlossaryLinkNode
  without a shared runtime dependency" so it states the real mechanism (open
  index signature on both sides; arguments flow `MdNode|MdastNode → LinkChild`,
  the return flows `GlossaryLinkNode → MdNode|MdastNode`).
- **Do NOT add `@types/mdast`** or any dependency. Do not touch the sibling
  `MdastNode` interfaces in deck-split / diagram-meta.

### T005 — Correct the contract wording

- (Governance file, so the CLI refuses it in `owned_files`; it is in scope for
  you regardless — delivery is direct-to-feat with no lane merge.) In
  `kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/shared-link-node.md`,
  rewrite the last bullet of "The one builder" to say the return type carries
  an open string index signature and is therefore assignable to both callers'
  local `MdNode` / `MdastNode` interfaces **with no cast** (as of #83; before
  #83 a double-cast was required). Keep the "no `@types/mdast`" note.

### T006 — Optional: caret-offset sanity (A4)

- Replace both `expect(await caretLeftProperty(page), ...).not.toBe('')` with
  assertions that the value matches `/^\d+(\.\d+)?px$/` and that
  `parseFloat(value) >= 8` (the documented `CARET_HALF_PX` clamp; state that in
  the assertion message / a comment). Do not change the count-pins or any other
  assertion. If this cannot be run locally (root-owned `test-results/`), use
  `pnpm exec playwright test tests/a11y/glossary.spec.ts --output <scratch dir>`;
  if the environment still blocks it, say so in your report and leave the edit
  for CI to verify.

### T007 — Optional: parity docstring (B1)

- Rewrite the header docstring of `src/tests/glossary-link-node-parity.test.ts`
  so it says: both emitters delegate to the ONE shared builder
  (`src/lib/glossary/link-node.ts`, #79); the `toEqual` is a **re-fork guard**
  (it fails if either emitter stops delegating and drifts), while the literal
  `aria-label` assertion in this file plus the two per-builder goldens are what
  catch an aria-label drop from the shared builder. Assertions unchanged.

### T008 — Verify and report

- From `src/`: `pnpm test` (vitest, serial) — all green, test count not lower
  than before.
- From `src/`: `./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS"`
  — must list NO `lib/glossary/` or `lib/remark/` file and ≤ 30 lines total
  (the 30 are pre-existing, in unrelated test files and starlight internals).
- `grep -rn "as unknown as" src/lib/remark/glossary-autolink.internal.ts src/lib/remark/glossary-term.ts`
  → no matches.
- `grep -rn "function textOf\|function textContent" src/lib/glossary src/lib/remark/glossary-*`
  → exactly one match, in `link-node.ts`. (Scoped to the glossary bounded
  context on purpose: `src/lib/remark/markua-callouts.internal.ts` has its own
  `textOf` with different semantics — it includes `inlineCode` and trims — and
  must NOT be folded, C-003.)
- `git diff --stat` — only the owned files change; `package.json` untouched.
- Report: what changed per file, the verification outputs above, and anything
  you could not run locally. **Do not commit** — the orchestrator owns commits.

## Branch Strategy

- Work directly in the repo root checkout on `feat/glossary-builder-ergonomics`
  (no lane worktree). Do not commit, stage, or switch branches.

## Definition of Done

- Exactly one subtree-text helper, exported from `src/lib/glossary/link-node.ts`,
  imported by both remark modules (FR-001/002, SC-001).
- Zero `as unknown as` in the two remark modules; `GlossaryLinkNode` has an
  open index signature; no dependency added (FR-003, C-002, SC-002).
- Contract wording true (FR-004, SC-005).
- Optional nits done or explicitly reported as skipped with the reason.
- Unit suite green; tsc shows no glossary/remark errors; no `hProperties`,
  href, children, warning string, or links-used entry changed (C-001).

## Reviewer Guidance

- Diff the deleted `textContent`/`textOf` against the surviving helper: for
  every real mdast input (text leaves with string `value`) the output must be
  identical; note the paper-only differences are non-mdast inputs.
- Confirm the index signature is the only type change and that the runtime
  object literal in the builder is untouched.
- Confirm no assertion in any test was weakened; the two optional nits only
  tighten.
- Confirm C-003: no file outside the owned list + the one contract document changed.
