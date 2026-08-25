# Research: Diagrams (Mermaid) — M5

Consolidated Phase 0 findings. The decision-ready note is folded into `spec.md` and the two
ADRs (0023 render/metadata seam, 0024 token promotion/brand wiring); this file records the
decisions in the plan format, the supply-chain check for the two new dependencies, and the
adversarial-evidence disposition (the post-spec squad).

## Decisions

### D-01 — Client-side Mermaid; astro-mermaid for the fence transform only
- **Decision**: Pin `astro-mermaid@2.1.0` + `mermaid@11.17.1`, self-hosted/bundled (no CDN),
  `securityLevel:'strict'`, `theme:'base'`, `autoTheme:false`. Use astro-mermaid for its
  build-time fence transform (`` ```mermaid `` → `<pre class="mermaid">`); **doc-kitty owns
  the client render** (ADR-0023 D1). A foundation spike confirms astro-mermaid's client
  render can be suppressed; fallback is a minimal own fence transform.
- **Rationale**: One render owner avoids the double-render/wrong-theme race, supports live
  `--dk-diagram-*` theming + toggle re-render, and yields a module the out-of-frame deck can
  import. Client-side keeps `build-example` browser-free (the build-time render is #13).
- **Alternatives**: astro-mermaid owns the render (rejected — static themeVariables, deck
  unreachable, its own re-theme loop); CDN mermaid (rejected — CSP/offline).

### D-02 — `%%` metadata: remark parse, rehype figure
- **Decision**: A remark plugin parses the leading `%% key: value` block (fields
  `title`/`description`/`attribution`/`source`), strips the lines, injects `accTitle`/
  `accDescr` at the diagram-type declaration line, and stashes caption fields on `file.data`;
  a rehype plugin reads `file.data` and wraps `<pre class="mermaid">` in `<figure
  role="group">` + `<figcaption>`. Ordering is deterministic by pipeline stage.
- **Rationale**: remark-then-rehype removes the fragile rehype-after-astro-mermaid ordering
  dependency (ADR-0023 D2).

### D-03 — Accessibility statements name the SVG; name falls back to description
- **Decision**: `accTitle` (accessible name) from `title` **or `description`** when `title`
  is absent; `accDescr` (description) from `description`. Guaranteed types
  flowchart/sequence/class. Gate asserts the name **directly**; contrast **via vitest** on
  the token pairs; axe covers the HTML figure/figcaption.
- **Rationale**: a description-only diagram must not be nameless (squad R-01); axe evaluates
  neither SVG contrast nor reliably the SVG name (R-02/A-06).

### D-04 — `--dk-diagram-*` promoted to Default + brand; orphan retired
- **Decision**: Add the tokens to `DEFAULT_BASE`/`DEFAULT_DARK` + `theme.css` +
  `emitTokenSheet` (light **and** dark) and to the brand `tokens.css`; delete the orphan
  `diagram-tokens.css`. Token→`themeVariables` map fixed (ADR-0024 D4). Contrast proven by a
  foundation vitest.
- **Rationale**: promoting to Default alone leaves the branded example unthemed (A-05); one
  source of truth.

### D-05 — Deck render path + single render loop
- **Decision**: `DeckLayout` imports the shared `diagram-render.client` via a browser-only
  client `<script>` (mirroring `reveal-init.client`); tokens ride DeckLayout's existing base
  link (no new token wiring); the deck demonstrator diagram is on the **active first slide**.
  Exactly one render loop per `pre.mermaid` (NFR-007).
- **Rationale**: the out-of-frame deck bypasses Starlight; a shared exported module reaches
  it and is the single owner (A-02); reveal hides later slides so mermaid can't size them.

### D-06 — Footprint + no-JS
- **Decision**: The `mermaid` library chunk loads only on diagram pages — verified in the
  Playwright lane by network capture (diagram page vs a diagram-free control), after a spike
  confirms code-splitting. No-JS = the built HTML's raw diagram source + caption.
- **Rationale**: the footprint is a runtime concern, not a static-HTML grep (R-03).

## Supply-chain install safety — `astro-mermaid@2.1.0` + `mermaid@11.17.1` (DIRECTIVE_051)

- **Registry authenticity**: both are canonical public-npm packages (`mermaid` = the
  mermaid-js project; `astro-mermaid` = joesaby/astro-mermaid). Pin exact versions; record
  integrity hashes in `pnpm-lock.yaml`.
- **Freshness**: `astro-mermaid@2.1.0` and `mermaid@11.17.1` are current (2026-08) releases,
  not just-published 0-days.
- **Peer/compat**: **verify at foundation** that `astro-mermaid@2.1.0`'s `mermaid`
  peer/dep range admits `11.17.1` (a mismatch defeats the exact pins), and that neither pulls
  **Playwright/puppeteer** transitively into the build graph (client-side render must not
  drag a headless browser in). Verified by the lockfile/manifest diff.
- **Lifecycle-script discipline**: keep the workspace deny-by-default install-script posture;
  neither package needs `preinstall`/`install`/`postinstall` for our use — confirm via the
  lockfile diff that no script-running transitive is added.
- **Node LTS**: build/runtime baseline Node ≥22 (Active LTS), unchanged.
- **Disposition**: **accepted** — two well-known, self-hosted, pinned libraries; no CDN;
  `securityLevel:'strict'`; the peer-range + no-transitive-Playwright checks are foundation
  gates.

## Adversarial evidence (post-spec squad)

The four-lens squad (`reviews/post-spec-squad.md`) is the adversarial challenge pass for
this plan's security-and-architecture-impacting decisions. Contested findings + disposition:

| Finding | Disposition |
|---|---|
| R-01 description-only diagram nameless | **changed** — accTitle falls back to description (ADR-0023 D3, FR-004) + title-absent demonstrator |
| R-02 axe can't do SVG contrast | **changed** — contrast via vitest on token pairs (ADR-0024 D5, NFR-001) |
| R-03 footprint mis-laned | **changed** — Playwright network capture + code-split spike (NFR-006, FR-012) |
| R-04 vacuous render-wait | **changed** — render-gate `figure svg[aria-labelledby]` + pre.mermaid-not-raw (FR-011) |
| R-05 opt-in-off untested | **changed** — unit test on `{ diagrams:false }` (FR-001) |
| A-01 render-ownership race | **changed** — single render owner, astro-mermaid autoTheme off (ADR-0023 D1, NFR-007) |
| A-02 deck reachability | **changed** — shared exported render module imported by DeckLayout (ADR-0023 D4); tokens ride existing base link |
| A-03 rehype ordering | **changed** — remark-parse + rehype-wrap, order-free by stage (ADR-0023 D2) |
| A-04 axe-harness flow change | **changed** — render-gate + direct name/figure assertion, per shell; deck on active first slide (FR-011) |
| A-05 branded example unthemed | **changed** — brand tokens.css wiring + orphan retirement (ADR-0024 D2/D3) |
| A-06 axe may not enforce name | **changed** — direct accessible-name assertion primary (ADR-0023 D3, NFR-001) |
| A-07 injection placement fragile | **changed** — locate type-declaration line, init/frontmatter cases, bounded types (FR-013) |
| P-01 deck reds already-scanned route | **changed** — showcase-deck render-wait co-lands the deck fence (C-007, IC-06) |
| P-04 when example flips diagrams:true | **changed** — flipped in the transform WP (IC-02, C-007) |
| P-05 token contrast proven late | **changed** — contrast vitest at foundation (IC-01, ADR-0024 D5) |
| P-06 ADRs last | **changed** — ADR-0023/0024 authored in plan |
| A-08 CSP | **deferred_with_rationale** — no CSP today; consumer note + ADR-0023 D5 for a future CSP |
| Build-time render / PlantUML / interactive / mindmap types | **deferred_with_rationale** — issue #13 / C-008 |

No contested finding was silently dropped.
