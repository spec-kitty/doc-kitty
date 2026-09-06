---
work_package_id: WP01
title: Glossary term-link affordance + popover polish (#64)
dependencies: []
requirement_refs:
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
- NFR-005
- NFR-006
planning_base_branch: feat/glossary-term-ux
merge_target_branch: feat/glossary-term-ux
branch_strategy: Planning artifacts for this mission were generated on feat/glossary-term-ux. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary-term-ux unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/glossary/
create_intent:
- docs/changelog/2026-09-06-glossary-term-ux.md
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/lib/remark/glossary-term.ts
- src/lib/remark/glossary-autolink.ts
- src/styles/dk-components.css
- src/lib/glossary/preview-popover.client.ts
- docs/changelog/2026-09-06-glossary-term-ux.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_001 (one shared link-node shape — never fork the two paths), a11y-first, keep presence-gated dormancy + the re-derive parity guard intact.

## Objective

Polish the glossary term-link UX (#64): a `dk-glossary-link` class + distinct-but-quiet style, same-tab internal links, and a caret + viewport-aware flip on the hover popover — without breaking the shared-link-node invariant, the re-derive parity guard, the no-JS fallback, or presence-gated dormancy. Read `../spec.md`, `../plan.md` (IC-01/02/03), and `docs/architecture/glossary.md`. Approach is decided — implement it. Work in the lane worktree if one is allocated, else on feat/glossary-term-ux.

## Critical context (verify current line refs on main)

- `docs/architecture/glossary.md`: the auto-linker (`glossary-autolink`) and the `:term` directive (`glossary-term`) emit the SAME link node ("indistinguishable downstream"); the "On this page" block RE-DERIVES links by re-running the same remark plugins over the body (`page-processor.ts` `REDERIVE_REMARK_PLUGINS`), and `src/tests/glossary-substrate-parity.test.ts` fails the build if the two stage lists drift. The whole feature is presence-gated on `.contextive/definitions.yaml` (NFR-002 byte-identical dormancy).
- `src/lib/remark/glossary-term.ts` (~:99-124) emits the link node with `target:'_blank'`, `rel:'noopener'`, `data-glossary-term`/`data-glossary-context`. `src/lib/remark/glossary-autolink.ts` emits the auto-link node. Find the shared shape (a helper, or the two must be edited to stay byte-identical).
- No `.dk-glossary-link` CSS exists today. `src/styles/dk-components.css` is the base global sheet (in `customCss` + linked on the deck route) that SURVIVES brand swaps.
- `src/lib/glossary/preview-popover.client.ts` (~:157) positions the popover `top = rect.bottom + scrollY + 6` — always below, no caret.
- Glossary demo pages for verification: `example/docs/glossary-demo/cargo-and-collisions/` (autolinks + `:term`), `example/docs/glossary/`.

## Subtasks

### T001 — Emit `dk-glossary-link` at the shared link-node (both paths)
- Add a `dk-glossary-link` class to the emitted term-link node. Apply it at the SHARED shape so BOTH `glossary-autolink.ts` and `glossary-term.ts` produce it identically (prefer a shared helper if one exists; otherwise edit both to stay byte-identical). Merge with any existing class list (don't clobber).
- Verify the re-derive path emits it too (it re-runs the same plugins — should be automatic); `glossary-substrate-parity.test.ts` must stay green.
- **Files**: src/lib/remark/glossary-term.ts, src/lib/remark/glossary-autolink.ts.

### T002 — Same-tab internal term links
- Drop `target:'_blank'` and `rel:'noopener'` from the emitted term-link node (both paths / shared shape). Term links resolve to internal `/glossary/<ctx>/#anchor`, so same-tab is correct. Keep `data-glossary-*` + href unchanged.
- **Files**: src/lib/remark/glossary-term.ts, src/lib/remark/glossary-autolink.ts.

### T003 — Distinct-but-quiet `.dk-glossary-link` style
- In src/styles/dk-components.css add `.dk-glossary-link` styling: distinct-but-quiet, e.g. `text-decoration: underline dotted; text-underline-offset: .15em; cursor: help;`. It must be visually distinguishable from an ordinary accent link AND meet WCAG 2.2 AA contrast in BOTH themes (use existing `--dk-*` tokens; do not hardcode hex). Do NOT restyle ordinary links. Keep it in the base sheet (survives branding). Add a comment.
- **Files**: src/styles/dk-components.css.

### T004 — Popover caret
- In preview-popover.client.ts (+ any popover CSS it owns), add a caret (a `::before`/element triangle) pointing from the popover to the term. Use brand tokens for colour/border so it reads on the popover surface in both themes.
- **Files**: src/lib/glossary/preview-popover.client.ts.

### T005 — Popover viewport-aware flip
- Compute whether the popover fits below the term; if it would overflow the viewport bottom, flip it ABOVE (`top = rect.top + scrollY - popoverHeight - 6`) and flip the caret to point down. Handle a popover taller than the space below (prefer the side with more room). Preserve WCAG 2.2 1.4.13 (hoverable, Esc-dismissible, persistent). Measure after the popover is in the DOM (so height is known).
- **Files**: src/lib/glossary/preview-popover.client.ts.

### T006 — Changelog + verify
- Add docs/changelog/2026-09-06-glossary-term-ux.md (dated fragment; match an existing fragment's frontmatter; **description ≤180 chars** — CI validate:docs caps it). Summarize the three fixes (#64).
- Verify (report): `pnpm build` exit 0; `pnpm test` green incl. glossary-substrate-parity; `pnpm validate:docs` + `validate:example` pass; a glossary term anchor in built HTML carries `dk-glossary-link` and NO `target="_blank"` (grep example/dist/glossary-demo/*/index.html); a `:term` link and an auto-link carry identical class/attrs; a glossary-free build stays byte-identical (dormancy — reason or check).

## Definition of Done
- T001–T006 complete; `spec-kitty agent tasks mark-status T001 T002 T003 T004 T005 T006 --status done`.
- Build + tests + validate + parity green; class present on both paths, no `target="_blank"`, style AA both themes, popover caret + flip work.

## Risks / reviewer guidance
- **Reviewer (opus)**: verify the class + target change are at the SHARED shape (both auto-link and `:term` identical — diff a built page's two link kinds); parity guard green; re-derive emits the class (On-this-page markup matches); dormancy byte-identical (glossary-free build); term-link AA + distinguishable both themes; popover caret + flip correct near BOTH edges + Esc/hoverable preserved; no `target="_blank"` on internal term links.
