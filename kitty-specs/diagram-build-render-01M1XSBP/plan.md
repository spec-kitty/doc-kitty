# Implementation Plan: Build-time diagram render — Mermaid + PlantUML (#13)

**Branch**: `feat/diagram-build-render` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## Summary
Direct-to-feat, PR to `main` (Closes #13). A large feature delivered as FOUR
sequenced work packages, each a reviewed, gated slice. Dual-mode (build-render +
client fallback), full PlantUML parity, mode-aware gates. Feasibility spiked
(research D7): `@beoe/rehype-mermaid` renders local inline SVG and the
`--dk-diagram-*` sentinels flow into the fills, so the `var()` theme rewrite is
viable.

## Work-package sequence (each depends on the prior)
- **WP01 — Mermaid build-render core (docs pages)**. Pin `@beoe/rehype-mermaid`;
  add the build-render stage under the `diagrams` opt-in; the sentinel→`var(--dk-diagram-*)`
  theme rewrite (enumerating EVERY themeVariable Mermaid consumes so no derived
  shade escapes); reuse the `diagram-meta` accTitle/accDescr inject so the SVG is
  named; adapt `diagram-figure` to wrap an `<svg>`; the deterministic, gate-observable
  **mode flag** + dual-mode seam (build when Chromium resolvable, else the existing
  client path unchanged). Make the Mermaid build-artifact + unit gates mode-aware.
  Deck + CI + PlantUML deferred to later WPs. Verified by a local build in both modes.
- **WP02 — PlantUML build-render + `'`-metadata parity**. Pin `astro-plantuml`
  (self-hosted `serverUrl`, never plantuml.com); the `'`-comment metadata parser
  twin of `diagram-meta.internal.ts`; the shared figure/caption + `var()` rewrite
  for the PlantUML SVG; an example `plantuml` page; PlantUML gates. Reuses WP01's
  figure/rewrite/mode seam.
- **WP03 — CI/deploy infra + baselines + a11y + deck**. Chromium + a self-hosted
  PlantUML `services:` container in `build-example` + `deploy`; the `@beoe` disk
  cache; regenerate + pin the visual/golden baselines under the build engines;
  the mode-aware `diagram.spec.ts` inversions (FP-1/T021/T022/DX-*); build-mode
  deck static-SVG integration (bypass the reveal re-render machinery in build mode).
- **WP04 — Docs/ADR + mission close**. ADR for the build-render contract + dual-mode;
  update `docs/architecture/diagrams.md` + CHANGELOG; final full-suite pass.

## Charter Check
- DISCIPLINED delivery: each WP gated; NFR-002 keeps client-fallback byte-parity;
  the build-mode change is deliberate and mode-observable (C-005).
- DIRECTIVE_041: mode-aware gates PIN both paths; no gate weakened, they gain a mode branch.
- DIRECTIVE_051 (supply chain): three pinned render deps (C-002) — the one place
  this mission adds dependencies; each exact-pinned as a golden-file dep.
- Security (C-001): PlantUML never contacts plantuml.com — a hard gate.

## IC map
- IC-01 Mermaid build stage + var-rewrite + figure adaptation + mode seam (WP01).
- IC-02 PlantUML build stage + `'`-metadata twin (WP02).
- IC-03 CI/deploy render infra + baseline regen + mode-aware e2e + deck (WP03).
- IC-04 docs/ADR (WP04).

## Risks (carried from research)
- Mode-aware gate inversion is the largest work item; spread across WP01 (unit +
  artifact) and WP03 (e2e). Never weaken a gate — add a mode branch.
- Visual-baseline determinism under the build engine — regen once, pin, exact deps.
- `astro-plantuml` on Astro 5.5.6+ against a self-hosted server — WP02 spike.
