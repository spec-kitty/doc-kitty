---
work_package_id: WP01
title: Mermaid build-render core (docs pages)
dependencies: []
requirement_refs:
- C-002
- C-003
- C-004
- C-005
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-010
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-005
planning_base_branch: feat/diagram-build-render
merge_target_branch: feat/diagram-build-render
branch_strategy: Planning artifacts for this mission were generated on feat/diagram-build-render. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagram-build-render unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/config.ts
create_intent: []
execution_mode: code_change
owned_files:
- src/package.json
- src/lib/config.ts
- src/lib/rehype/diagram-figure.ts
- src/lib/remark/diagram-meta.ts
- src/lib/remark/diagram-meta.internal.ts
- src/lib/diagram/diagram-render.client.ts
- src/scripts/assert-build-artifacts.mjs
- src/tests/diagram-pipeline.test.ts
- src/tests/diagram-figure.test.ts
- src/tests/diagram-preset.test.ts
role: implementer
tags: []
tracker_refs: []
---
## Objective
Issue #13, WP01: docs ```mermaid renders to a STATIC, THEMED, ACCESSIBLE inline
`<svg>` at build time (`@beoe/rehype-mermaid`), under the existing `diagrams`
opt-in, with a DUAL-MODE fallback to the current client render when Chromium is
not resolvable at build. Make the Mermaid build-artifact + unit gates MODE-AWARE.
Deck, CI, and PlantUML are OTHER WPs — do not touch them.

Read FIRST: kitty-specs/diagram-build-render-01M1XSBP/{spec,plan,research}.md
(research D1/D2/D5/D7 are load-bearing), contracts/build-render.md. Issue: `gh issue view 13`.

## Key facts from the Phase-0 spike (research D7)
- `@beoe/rehype-mermaid@0.4.2` renders `code.language-mermaid` → inline `<svg>`
  using Playwright Chromium (already at ~/.cache/ms-playwright locally; CI uses
  the pinned Playwright container in a later WP). It hooks the STANDARD code-fence
  node, NOT doc-kitty's `pre.mermaid` retype.
- Setting `mermaidConfig.themeVariables.*` to sentinel hexes puts those hexes into
  the SVG fills — so the theme rewrite maps sentinel→`var(--dk-diagram-*)`. Mermaid
  DERIVES extra shades from primaries, so pin EVERY themeVariable it consumes to a
  distinct sentinel (enumerate them; verify no un-mapped hex remains in the SVG).
- The existing `diagram-meta` remark pass injects `accTitle`/`accDescr`; it must
  run BEFORE the build render so Mermaid emits `<title>`/`<desc>` (the a11y name).

## Hard rules
- Do NOT run `pnpm build` in a way that clobbers example/dist while the orchestrator's
  oracle needs it — coordinate: run your own builds, but expect the orchestrator to
  re-run the byte-oracle. Run unit tests `cd src && ./node_modules/.bin/vitest run --project fast`.
  Set `PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright` for local build-render.
- Exact-pin `@beoe/rehype-mermaid` (C-002). Keep `mermaid@11.17.1` for the client
  fallback. Do NOT add a range.
- Client-fallback path must stay BYTE-IDENTICAL to pre-#13 (NFR-002): the mode flag
  off ⇒ the existing `mermaidFenceTransform` + client owner + gates, untouched.
- Gates are MODE-AWARE, never weakened (C-005): add a build-vs-client branch.

## Subtasks
### T001 — build-render stage + dep
- Add `@beoe/rehype-mermaid` (exact) to src/package.json. In config.ts's
  `diagramsIntegration`, add the build-render rehype stage (runs on the code node
  BEFORE `mermaidFenceTransform`, or replaces it in build mode). `mermaidConfig`:
  `theme:'base'`, `securityLevel:'strict'`, `themeVariables` = the FULL sentinel set.
### T002 — mode flag + dual-mode seam
- A resolved, gate-observable flag (env e.g. `DK_DIAGRAM_BUILD_RENDER`, default:
  auto-detect a resolvable Playwright Chromium; overridable). Build mode ⇒ build
  stage runs, NO client render owner injected for diagram pages, node becomes the
  static figure. Client mode ⇒ the existing path, untouched. Expose the resolved
  mode so the artifact gate can read it (e.g. a marker in the build output/manifest).
### T003 — sentinel→var theme rewrite
- A rehype pass over the build-rendered `<svg>`: replace each sentinel hex (in
  `fill:`/`fill=`/`stroke`) with the matching `var(--dk-diagram-*)`. Enumerate the
  full themeVariable→token map (extend `dkThemeVars()`'s six-token map to every
  Mermaid themeVariable that surfaces as a colour). VERIFY: no raw sentinel hex
  remains in the emitted SVG (a test asserts only `var(--dk-diagram-*)` themeable colours).
### T004 — a11y name + figure
- Ensure `diagram-meta` runs before the build render (accTitle/accDescr → `<title>`/`<desc>`).
  Adapt `diagram-figure.ts` so its matcher/wrapper handles a build-rendered `<svg>`
  (currently keys on `pre.mermaid`) AND the client `pre.mermaid` — same
  `<figure role=group aria-labelledby>`+`<figcaption>` output in both modes.
### T005 — mode-aware gates
- `assert-build-artifacts.mjs`: the "figure contains NO `<svg>`" check becomes
  mode-aware — build mode asserts the figure DOES hold an inline `<svg>` with
  `<title>`/`<desc>` + `var(--dk-diagram-*)` fills + NO runtime `_astro/mermaid*.js`;
  client mode keeps today's assertion. Same for `assertPinnedDepsNoCdn` (build
  mode: no runtime chunk). Unit tests (`diagram-pipeline/figure/preset`): add the
  build-mode chain assertions alongside the client ones.
### T006 — verify
- Local build BOTH modes (set/unset the flag): build mode ⇒ inline themed named SVG,
  no mermaid chunk; client mode ⇒ byte-identical to pre-#13 (diff the diagram pages).
- `cd src && ./node_modules/.bin/vitest run --project fast` green; tsc no new errors.
- Report per-file changes, the sentinel→var table, both-mode build evidence, and any
  gate you made mode-aware. Do NOT commit.

## Definition of Done
- Docs ```mermaid builds to a static themed accessible inline `<svg>` in build mode;
  client mode byte-identical to pre-#13; Mermaid gates mode-aware and green in both;
  `@beoe/rehype-mermaid` exact-pinned; deck/CI/PlantUML untouched.
