# Research (Phase 0): Build-time diagram render — Mermaid + PlantUML (#13)

Locked with the user: **dual-mode** (build-render when Playwright/Chromium is
available at build; fall back to the existing client Mermaid render otherwise)
and **full PlantUML parity** (build-render + the `'`-comment metadata twin +
example + gates). Grounded in the deep pipeline scout and the M5 research
`research/2026-08-21-astro-feature-discovery/findings-D-contextive-diagrams.md`.

## Correction to prior memory
`astro-mermaid` was NEVER wired. The current client render is doc-kitty's OWN
`mermaidFenceTransform` (config.ts) + the single render owner
`src/lib/diagram/diagram-render.client.ts` (dynamic `import('mermaid')`,
`mermaid@11.17.1` pinned). This mission adds a build-render path IN FRONT of that
and keeps the client path as the dual-mode fallback.

## D1 — Mermaid build render: `@beoe/rehype-mermaid`
- **Decision**: `@beoe/rehype-mermaid@0.4.2` (deps `mermaid-isomorphic@^3`,
  `svgo@^3.3.2`, `@beoe/rehype-code-hook-img`). Rehype plugin: replaces a
  `pre.mermaid` (or a mermaid code node) with generated inline `<svg>` at build,
  with a **disk cache** so unchanged diagrams don't relaunch Chromium. Uses
  Playwright Chromium at build (we already pin `@playwright/test@1.62.1` and the
  a11y CI lane runs `mcr.microsoft.com/playwright:v1.62.1-noble`).
- **Version pin**: exact-pin `@beoe/rehype-mermaid` AND let it own the render-time
  mermaid (via mermaid-isomorphic) — this is a golden-file dep (SVG/aria bytes
  are asserted). The client-fallback path keeps `mermaid@11.17.1`.
- **Dual-mode seam**: the `diagrams` preset gains a build-render stage that runs
  only when a build-render capability is present (Chromium resolvable); when it
  runs, the emitted node is a static `<figure>` with inline `<svg>` and NO client
  render owner is injected for that page. When it does NOT run (no Chromium),
  the existing `mermaidFenceTransform` + client owner path is used unchanged.
  A single resolved flag (env/option, e.g. `DK_DIAGRAM_BUILD_RENDER`) selects the
  mode deterministically per build so gates can assert the active mode.

## D2 — Theme-aware static SVG WITHOUT client JS: CSS-variable rewrite
- **Decision**: a rehype post-process rewrites the baked `<svg>` so its themeable
  fills/strokes reference `var(--dk-diagram-*)` (the SAME six tokens the client
  hook maps today: node-fill, node-border, node-text, edge, subgraph-title,
  cluster-fill). The toggle then stays **pure CSS** — flipping `[data-theme]`
  re-resolves the vars, so the static SVG is light/dark aware with zero JS. This
  preserves the exact six-token contract `diagram-tokens.test.ts` locks and lets
  the T021 "node fill == other-mode token after toggle" invariant hold WITHOUT a
  re-render (the computed fill follows the var).
- Render Mermaid with `theme:'base'` and a fixed set of sentinel `themeVariables`
  (distinct hexes), then map each sentinel → its `var(--dk-diagram-*)` in the
  rewrite (a deterministic hex→var table, the build-time analogue of
  `dkThemeVars()`). Alternative (@beoe selector dark-mode: emit both palettes) is
  REJECTED — it doubles bytes and breaks the single-token-source contract.

## D3 — PlantUML build render: `astro-plantuml`
- **Decision**: `astro-plantuml@1.0.0` (peerDep `astro >=5.5.6`; we resolve
  Astro 5.5.6+ under `^5.2.0`), SVG mode, **self-hosted server** via `serverUrl`
  (a PlantUML server as a CI/build service — `plantuml/plantuml-server` Docker or
  the JAR) and/or a local `diagramsPath` cache. **NEVER** the default
  `plantuml.com` endpoint (privacy: uploads source off-site — DIAG-SEC-02).
  `remark-local-plantuml` does not exist on npm; `astro-plantuml` is the path.
- **`'`-metadata twin** (full parity): a parser mirroring
  `diagram-meta.internal.ts` for PlantUML comment syntax — a leading
  `' key: value` block over the same closed field set {title, description,
  attribution, source}, injecting PlantUML's accessibility (title / caption) and
  feeding the SAME `diagram-figure` rehype wrapper. PlantUML SVGs are NOT
  theme-aware by default → the same D2 CSS-variable rewrite applies.

## D4 — CI / deploy infra
- **Decision**: run the `build-example` and `deploy` builds with Chromium + a
  PlantUML server available. Preferred: build inside the pinned Playwright
  container (`mcr.microsoft.com/playwright:v1.62.1-noble`) with `playwright
  install chromium`, and a PlantUML server as a workflow `services:` container
  (`plantuml/plantuml-server`) reached via `serverUrl`. The `@beoe` disk cache is
  committed/CI-cached so unchanged diagrams skip Chromium.
- **Determinism**: the pinned visual baselines (`tests/a11y/__screenshots__/`)
  and the golden SVG bytes must be regenerated once under the build-render engine
  and then pinned; the render-time mermaid/plantuml versions are exact-pinned so
  bytes are stable. Local envs without Chromium fall to client mode (dual-mode),
  so `pnpm build` still works for contributors.

## D5 — Gate inversion is MODE-AWARE (the largest work item)
Every current diagram gate encodes the CLIENT invariant and must become
mode-aware, not simply inverted:
- `assert-build-artifacts.mjs` "figure contains NO `<svg>`" (browser-free proof)
  → under build-render, assert the figure DOES contain an inline `<svg>` with the
  accessible `<title>`/`<desc>` + `var(--dk-diagram-*)` fills; under client mode,
  the existing `pre.mermaid`/no-svg assertion.
- `diagram.spec.ts` FP-1 "a mermaid chunk IS fetched" → under build-render,
  assert NO diagram runtime chunk ships and NO `/mermaid/i` request; client mode
  keeps the current assertion. T022 (diagram-free deck ships zero mermaid) holds
  in both modes.
- `assertPinnedDepsNoCdn` "a bundled `_astro/mermaid*.js` MUST exist" → mode-aware
  (build-render ships none; client fallback still does).
- The a11y/theme tests (DX-2, DX-4, T021) re-expressed against the static SVG:
  the accessible name comes from the SVG `<title>`/`<desc>`; the theme toggle is
  pure-CSS (assert computed fill follows the var, no re-render, still one `<svg>`).

## D6 — Invariants preserved (unchanged behaviour contracts)
- The `<figure class="dk-diagram" role="group" aria-labelledby>` + `<figcaption>`
  treatment and the `%%`/`'` field set are preserved; `diagram-figure.ts` is
  adapted to wrap an `<svg>` as well as a `pre.mermaid`.
- The six `--dk-diagram-*` tokens and their contrast ratios
  (`diagram-tokens.test.ts`) are unchanged; the build SVG references them.
- Decks: the out-of-frame DeckLayout gets static SVGs too; the reveal
  slide-by-slide client re-render machinery (INV-SETTLE/SCOPE) is bypassed under
  build-render (a static SVG needs no settle), but kept for the client fallback.

## Riskiest unknowns → validated in WP spikes
1. `@beoe/rehype-mermaid` producing an SVG whose fills can be deterministically
   rewritten to `var(--dk-diagram-*)` (sentinel→var table). WP01 spike.
2. `astro-plantuml` running under Astro 5.5.6+ against a self-hosted server, and
   its SVG accepting the same var-rewrite. WP02 spike.
3. Visual-baseline determinism under the build engines; regen + pin. WP03.
4. Dual-mode selection being deterministic and gate-observable. WP01.

## D7 — Feasibility spike (WP01 de-risk, run in Phase 0)
Isolated scratch spike (`@beoe/rehype-mermaid@0.4.2` + Playwright 1.62.1,
Chromium already in `~/.cache/ms-playwright`):
- `@beoe/rehype-mermaid` renders `<pre><code class="language-mermaid">…` → inline
  `<svg>` (~9.5KB for a 3-node flowchart). It hooks the STANDARD code-fence shape
  (`code.language-mermaid`), NOT doc-kitty's current `pre.mermaid` retype — so the
  build stage runs on the code node BEFORE `mermaidFenceTransform`, or the
  transform is bypassed in build mode.
- **Sentinels flow through**: setting `themeVariables.primaryColor/lineColor/…`
  to `--dk-diagram-*` hexes puts those exact hexes into the SVG `fill:`/`fill=`
  (observed `#eceef2`, `#1d2733`, `#33507f`). CONFIRMS D2's sentinel→`var()`
  rewrite is viable.
- **Caveat**: Mermaid DERIVES extra shades from the primaries (observed
  `#eef2ec`), so the rewrite must pin EVERY themeVariable Mermaid consumes to a
  distinct sentinel (a full sentinel table), not just the six — else a derived
  shade escapes the var mapping. WP01 enumerates the full themeVariable set.
- **a11y**: the spike SVG had no `<title>`/`<desc>` (no acc statements injected).
  The existing `diagram-meta` remark pass that injects `accTitle`/`accDescr` must
  run BEFORE the build render so Mermaid emits the named `<title>`/`<desc>`.
- Local iteration is possible (node_modules writable, Chromium present); CI uses
  the pinned Playwright container.

## D8 — PlantUML feasibility spike (WP02 de-risk, Phase 0)
Local infra confirmed: Docker + `plantuml/plantuml-server:jetty` (HTTP 200 SVG),
Java 26, `/usr/share/plantuml/plantuml.jar`, Graphviz `dot`.
- A self-hosted server renders fine; astro-plantuml (peerDep astro >=5.5.6, we
  resolve it) points `serverUrl` at it — NEVER plantuml.com (C-001).
- **THEMING (the D3 open question) — SOLVED and simpler than Mermaid**: injecting
  `skinparam` colours as sentinels (`skinparam backgroundColor #e1f0c1`,
  `rectangle { BackgroundColor/BorderColor/FontColor }`, `skinparam ArrowColor …`)
  surfaces EXACTLY those sentinels in the SVG, with **ZERO chromatic non-sentinel
  hexes** (PlantUML does not derive shades the way Mermaid does). So the WP01
  sentinel→var rewrite applies unchanged; PlantUML has no derived-shade leak risk.
- Mechanism: the `'`-metadata parser injects a skinparam preamble mapping the six
  `--dk-diagram-*` tokens → PlantUML colour params (per diagram type; cover the
  common ones for the example), astro-plantuml renders, the shared sentinel→var
  rewrite + diagram-figure wrap produce a themed, named, accessible figure.
- **Client mode**: there is no client PlantUML renderer, so in client mode a
  ```plantuml is a plain code fence (no figure) — PlantUML is build-only. There is
  no pre-#13 PlantUML output, so no byte-parity obligation (unlike Mermaid).
- A dk-plantuml server container is left running on :8091 for local WP02 iteration.
