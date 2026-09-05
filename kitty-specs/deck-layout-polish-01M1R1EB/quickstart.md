# Quickstart — verification runbook (Deck & Layout Polish)

## Gates (must all stay green — NFR-004)
```bash
cd <repo-root>
pnpm test           # vitest unit (incl. new deck-theme-parity.test.ts)
pnpm typecheck      # astro check
pnpm build          # astro build (example/dist)
pnpm test:a11y      # Playwright + axe
pnpm validate       # frontmatter
node src/scripts/assert-build-artifacts.mjs example/dist
node src/scripts/assert-no-broken-links.mjs example/dist --base /doc-kitty --site https://spec-kitty.github.io
node src/scripts/assert-markua-builds.mjs
```
> Env hazard: if local pnpm gates fail on a broken/half-materialized `node_modules`,
> CI is the verifier (memory `doc-kitty-env-hazard-broken-node-modules`). Use `pnpm clean`
> before a true rebuild to avoid the `example/node_modules/.astro` cache trap.

## Pixel pass (NFR-005) — the mission-required browser verification
Chromium is at `/usr/bin/chromium`; Playwright is in the workspace store. Harness:
`scratchpad/shots.mjs` (import playwright by absolute path from
`node_modules/.pnpm/playwright@*/node_modules/playwright/index.mjs`).

```bash
pnpm clean && pnpm build
nohup pnpm preview &          # serves http://localhost:4321/doc-kitty
node scratchpad/shots.mjs after
```
Capture + compare BEFORE (`scratchpad/before`) vs AFTER (`scratchpad/after`):
- **#65**: `presentations/showcase-deck/#/1` (the demo bg slide) in `colorScheme:'light'`
  AND `'dark'` — body text legible (≥4.5:1) in BOTH; slide still shows an applied bg.
- **#66**: title slide `#/0` — `h1 + hero` only, nothing clipped; the moved intro+diagram
  visible on `#/1` (new slide); a slide with a vertical stack shows the up/down affordance.
- **#67**: `guides/markua-showcase/` at 1600 / 1920 / 2560 — `.main-frame` capped
  (≤ ~90rem) and centered; no large one-sided gutter. Also spot-check a page WITH a right
  TOC.

## Acceptance mapping
| Check | Requirement | Contract |
|-------|-------------|----------|
| Deck light/dark | FR-001/002, C-001/002 | C-DECK-THEME-1 |
| Parity guard + no raw hex | C-003, FR-003 | C-DECK-THEME-2/3 |
| Demo slide contrast both schemes | NFR-001, FR-003 | C-DECK-THEME-3 |
| Title fits / content moved / sentinel | NFR-002, FR-004/008 | C-STAGE-1 |
| No slide overflow (stage units) | FR-005 | C-STAGE-2 |
| Up/down affordance | FR-006 | C-AFFORD-1 |
| Wide cap + center | FR-007, NFR-003, C-005 | C-WIDE-1 |
| Gates green + in-frame unchanged | NFR-004 | C-DECK-THEME-1 |
```
