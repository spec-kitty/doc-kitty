# Implementation Plan: Glossary Term-Link UX Polish

**Branch**: `feat/glossary-term-ux` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

## Summary

Three UX polishes to the glossary term link + hover popover (#64), all at existing seams:
a `dk-glossary-link` class emitted at the shared link-node shape (so auto-link and `:term`
stay identical), a distinct-but-quiet style in the base component sheet, dropping
`target="_blank"` for internal term links, and a caret + viewport-aware upward flip on the
hover popover. No architecture change; presence-gated dormancy, the re-derive parity guard,
and the no-JS fallback are preserved.

## Technical Context

**Language/Version**: TypeScript 5.x + Astro 5.18 (Starlight); remark/rehype (mdast) glossary plugins; a client custom element for the popover. Node 24 / pnpm workspace.
**Primary Dependencies**: none added — edits to existing `src/lib/remark/glossary-*.ts`, `src/lib/glossary/preview-popover.client.ts`, `src/styles/dk-components.css`.
**Storage**: N/A (static SSG).
**Testing**: vitest unit (incl. `src/tests/glossary-substrate-parity.test.ts`), Playwright/axe a11y, build-artifact/link/markua asserts, and a mission-required Playwright pixel pass (both themes, BEFORE/AFTER).
**Target Platform**: static site (base `/doc-kitty`), modern browsers; graceful no-JS.
**Project Type**: single toolkit package (`src/`) + example site (`example/`).
**Performance Goals**: no runtime cost; the popover island stays presence-gated (glossary-free routes never load it).
**Constraints**: WCAG 2.2 AA (term contrast, both themes) + 1.4.13 (popover); shared link-node invariant (C-001); base-sheet CSS that survives brand swaps (C-002); presence-gated byte-identical dormancy (NFR-002); re-derive parity (NFR-003); no-JS click-through (NFR-004).
**Scale/Scope**: ~4 source files + 1 changelog + tests. No API/schema surface.

## Charter Check

*GATE.* Charter mode compact (`software-dev-default`). DISCIPLINED_REFACTORING / DIRECTIVE_001: the class + `target` change go at the single shared link-node emitter (not duplicated per path) — the invariant a parity guard already enforces. DIRECTIVE_051 supply-chain: **N/A — no dependency change** (recorded, not skipped). Authority paths (`docs/context/`): no new domain terms. No charter violations.

## Design seam (verified on main)

- Term link node is emitted by `src/lib/remark/glossary-term.ts` (the `:term` directive, ~:99-124, currently sets `target:'_blank'`, `rel:'noopener'`, `data-glossary-*`) and `src/lib/remark/glossary-autolink.ts` (the auto-linker). Per `docs/architecture/glossary.md`, both emit the SAME link node ("indistinguishable downstream"); the class + `target` change must be applied to that shared shape and both paths kept identical (a shared helper is ideal). The re-derive path (`page-processor.ts` `REDERIVE_REMARK_PLUGINS`) re-runs these, so the class rides the re-derive automatically and `glossary-substrate-parity.test.ts` must stay green.
- No `.dk-glossary-link` CSS exists today — new styling goes in `src/styles/dk-components.css` (the base global sheet already linked in-frame + on the deck route; survives brand swaps).
- Popover positioning is `src/lib/glossary/preview-popover.client.ts:157` (`top = rect.bottom + scrollY + 6`, no caret, no flip).

## Project Structure

```
kitty-specs/glossary-term-ux-01M1TM62/
├── plan.md · research.md (this + decisions) · tasks/ (WP prompt)
src/
├── lib/remark/glossary-term.ts, glossary-autolink.ts   # class + drop target=_blank (shared shape)
├── lib/glossary/preview-popover.client.ts              # caret + viewport flip
├── styles/dk-components.css                             # .dk-glossary-link style (base sheet)
docs/changelog/2026-09-06-glossary-term-ux.md           # dated fragment
```

**Structure Decision**: Single toolkit package; all edits at existing glossary seams. One cohesive work package (glossary UX).

## Complexity Tracking

*No charter violations — none.*

## Implementation Concern Map

### IC-01 — Term-link affordance (class + same-tab) at the shared emitter
- **Purpose**: emit `dk-glossary-link` and drop `target="_blank"` at the shared link-node so both auto-link and `:term` paths are identical and same-tab.
- **Requirements**: FR-001, FR-003, FR-004; C-001, C-003; NFR-003, NFR-004.
- **Surfaces**: `src/lib/remark/glossary-term.ts`, `src/lib/remark/glossary-autolink.ts` (+ any shared helper).
- **Risks**: applying to one path only breaks the indistinguishable-downstream invariant + parity guard; the re-derive must see the class (it re-runs the same plugins, so automatic — verify).

### IC-02 — Distinct-but-quiet term styling
- **Purpose**: style `.dk-glossary-link` distinct-but-quiet (dotted underline + help cursor), AA both themes, distinguishable from an accent link.
- **Requirements**: FR-002; C-002; NFR-001.
- **Surfaces**: `src/styles/dk-components.css`.
- **Risks**: must not reduce contrast below AA or collide with Starlight/brand link styles; keep it in the base sheet (survives branding).

### IC-03 — Popover caret + viewport-aware flip
- **Purpose**: add a caret and flip the popover above the term when it would overflow the viewport bottom.
- **Requirements**: FR-005, FR-006; NFR-005.
- **Surfaces**: `src/lib/glossary/preview-popover.client.ts` (+ any popover CSS it owns).
- **Risks**: keep WCAG 1.4.13 (hoverable/Esc/persistent); handle both edges + a popover taller than the space below; caret must flip with the popover.

## Post-design Charter Re-check
No new violations; supply-chain N/A (no dependency change). The single cross-cutting risk (shared-emitter invariant) is covered by the existing parity guard + IC-01's shared-shape requirement.
