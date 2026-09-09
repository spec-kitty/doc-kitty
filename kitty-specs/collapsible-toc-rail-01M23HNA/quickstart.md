# Quickstart: Collapsible on-this-page TOC side rail

## See it locally
1. `pnpm dev` (runs the example docsite).
2. Open a page that has an on-this-page outline (e.g. a prose/guide page or a rhetoric chapter)
   in a window ≥ 72rem wide.
3. Click the circular toggle on the hairline between the article and the right rail: the outline
   hides, the article widens and re-centers, the chevron points outward. Click again to restore.
4. Reload, and navigate to another doc: the collapsed choice persists with no flash of the outline.
5. Narrow the window below 72rem: the desktop toggle disappears and the mobile TOC behaves as before.

## Run the tests
- Pure logic: `pnpm test` (vitest — `src/tests/toc-rail-*.test.ts`: preference read/write, blocked
  storage, breakpoint, pre-paint string).
- Interaction + a11y: `pnpm test:a11y` (Playwright — `tests/a11y/toc-rail.interaction.spec.ts`:
  collapse/expand, recenter, persistence across reload, below-breakpoint absence, keyboard + aria).
- Visual baselines for the new toggle are regenerated in CI via `.github/workflows/update-a11y-baselines.yml`
  (cannot be regenerated deterministically off the pinned container).

## What "green" proves
SC-001 collapse/restore + recenter · SC-002 persistence + no flash · SC-003 desktop/has-TOC scoping,
mobile + left nav unchanged · SC-004 keyboard/aria · SC-005 automated coverage passes.
