# Tasks: Glossary Term-Link UX Polish

**Mission**: glossary-term-ux-01M1TM62 · **Branch**: `feat/glossary-term-ux`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

One cohesive work package (glossary term UX). All edits at existing glossary seams.

## Subtask Index

| ID | Description | WP |
|----|-------------|----|
| T001 | Emit `dk-glossary-link` class at the shared link-node (both auto-link + `:term`) | WP01 |
| T002 | Drop `target="_blank"`/`rel="noopener"` for internal term links | WP01 |
| T003 | `.dk-glossary-link` distinct-but-quiet style in dk-components.css (AA both themes) | WP01 |
| T004 | Popover caret (::before pointing at the term) | WP01 |
| T005 | Popover viewport-aware upward flip near the bottom edge | WP01 |
| T006 | Dated changelog fragment + verify (parity, dormancy, no-JS, pixel) | WP01 |

## Work Package

### WP01 — Glossary term-link affordance + popover polish
- **Goal**: term links read distinct-but-quiet + same-tab (shared emitter), and the hover popover gets a caret + viewport flip — no architecture/dormancy/parity regression.
- **Priority**: P1.
- **Independent test**: on a glossary demo page (both themes) a term is visibly distinct-but-quiet + AA, clicks same-tab; hovering near the viewport bottom shows a caret-anchored popover that flips up; parity guard + glossary-free dormancy green.
- **Requirements**: FR-001..006, NFR-001..005.
- **Subtasks**: T001–T006.
- **Owned files**: `src/lib/remark/glossary-term.ts`, `src/lib/remark/glossary-autolink.ts`, `src/styles/dk-components.css`, `src/lib/glossary/preview-popover.client.ts`, `docs/changelog/2026-09-06-glossary-term-ux.md` (new).
- **Dependencies**: none.

## Mission-level verification (orchestrator)
- NFR-006 pixel pass (both themes): term-link distinct-but-quiet + AA; same-tab nav; popover caret + flip near viewport bottom.
- Gates: `pnpm test` (incl. glossary-substrate-parity), build, validate:docs/example, assert:artifacts, assert:no-broken-links, `test:a11y` (CI-serial) + axe AA on a glossary page both themes; glossary-free dormancy byte-identical.

## Execution
Single WP; MVP = WP01.
