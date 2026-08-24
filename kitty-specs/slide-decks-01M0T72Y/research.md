# Research: Slide Decks (reveal.js) — M6

Consolidated Phase 0 findings. The full decision-ready note is folded into `spec.md`
and the two ADRs (0021 routing, 0022 reveal integration); this file records the
decisions in the plan format, the supply-chain check for the one new dependency, and
the adversarial-evidence disposition.

## Decisions

### D-01 — reveal.js version + bundling
- **Decision**: Pin `reveal.js@6.0.1`, self-hosted, bundled by Vite (no CDN). Do **not**
  add `@types/reveal.js` (v6 bundles types).
- **Rationale**: v6 is Vite-native (ESM `.mjs`, `exports`-resolved specifiers, CSS at
  `reveal.js/reveal.css`), the friendliest reveal has been for an Astro consumer; a
  single pinned line replaces the "reveal vendored N times" tax of the anti-pattern repo.
- **Alternatives**: CDN (rejected — CSP/offline); older 4.x/5.x (rejected — pre-Vite
  module surface); `@types/reveal.js` (rejected — shadows bundled types).

### D-02 — plugin set
- **Decision**: Core + **Notes** only. No Markdown plugin (ever), no Highlight plugin.
- **Rationale**: Notes activates speaker view + `<aside class="notes">`. Astro/Shiki
  already highlights code at build; reveal Highlight would double-process. Markdown plugin
  is the rejected runtime path (ADR-0012 Option A).
- **Alternatives**: Highlight for per-line stepping (deferred, C-008); Math/Zoom/Search/
  multiplex (deferred).

### D-03 — init (SSR-safe)
- **Decision**: Initialize reveal from a browser-only dynamic import in a client
  `<script>` on the `prerender = true` deck route; never a top-level import in
  server-rendered `.astro`.
- **Rationale**: reveal touches `document`/`window` at import — a top-level import crashes
  `astro build`. The build-time pre-render also makes directive attributes static before
  JS, so the build is immune to reveal issue #3883 (Vite/Rolldown directive ordering).
- **Alternatives**: top-level import (rejected — SSG crash); reveal Markdown plugin
  (rejected — empty initial HTML).

### D-04 — split transform
- **Decision**: One global remark plugin, `early-return unless frontmatter.kind ===
  'Presentation'`, grouping mdast into `data.hName='section'` nodes: title slide (pre-`##`),
  `##`→horizontal, `###`→vertical slide inside a converted stack, `---`→headingless
  section (consume the `thematicBreak`, emit `aria-label`), `####`+ stay in-slide.
  Directives + `Note:` parsed in the same pass. Pure pieces are Astro-free + vitest.
- **Rationale**: Reuses Astro's configured remark/rehype chain so decks render identically
  to docs; mdast-level emission renders real `<section>`s; the scope guard keeps `---` an
  `<hr>` off decks.
- **Alternatives**: separate hand-rolled processor (rejected — loses the shared chain);
  client-side split (rejected — Option A).

### D-05 — directives + notes
- **Decision**: `<!-- .slide: … -->`→attrs on enclosing section; `<!-- .element: … -->`→
  attrs/classes (incl. `fragment`) on the preceding sibling; `Note:` paragraph→
  `<aside class="notes">` direct child of the section. Unknown directive key → `file.message()`
  warning, never throw. `.element` with no preceding sibling → warn+skip.
- **Rationale**: HTML-comment nodes in mdast; the "preceding element" is the previous
  sibling — no DOM re-scan, immune to #3883. Matches ADR-0012's open-vocabulary posture.

### D-06 — token theme + CSS isolation
- **Decision**: A `.reveal`-scoped sheet mapping `--r-*` onto `var(--dk-*)` (colors, fonts,
  `--dk-width-deck`), imported **only** by DeckLayout; reveal's core sheet + the map never
  global and never hoisted into a shared chunk. Build assertion enforces non-leak (core
  sheet by known signature). Per-file `deck:` override deferred.
- **Rationale**: reveal 6 exposes `--r-*` variables, so a thin map suffices and keeps the
  upgrade surface tiny; route-import isolation confines the core sheet's viewport hijack.

### D-07 — Pagefind + discovery
- **Decision**: `data-pagefind-body` on `.slides`; `data-pagefind-ignore` on the
  speaker-note `<aside>` (the only reveal chrome in static `dist` — controls/progress/
  slide-number are runtime-injected). Build assertion: deck slug indexed, note text not.
  RSS exclusion keyed on `kind: Presentation`; `presentations` added to `SECTION_ORDER`/
  `SECTION_LABEL`; sitemap/llms/agent include the deck (URL parity asserted).
- **Rationale**: Pagefind indexes only `data-pagefind-body` regions once any page uses the
  attribute — the out-of-frame route is silently excluded otherwise (the ADR-0012 risk).

### D-08 — a11y verification split
- **Decision**: axe (static, both modes) verifies accessible names, `<button>` labels,
  region, size-aware AA contrast; a Playwright **interaction** test verifies keyboard
  reachability, no trap, visible focus, and computed `transition-duration: 0s` under
  reduced motion. Committed visual baseline deferred.
- **Rationale**: axe-core does not exercise keyboard nav / traps / transition state
  (squad R-01) — those need an interaction test to be actually enforced.

## Supply-chain install safety — `reveal.js@6.0.1` (DIRECTIVE_051)

- **Registry authenticity**: `reveal.js` is the long-standing canonical package
  (hakimel/reveal.js) on the public npm registry; pin the exact version `6.0.1` and record
  the integrity hash in `pnpm-lock.yaml`. No scoped/typosquat risk (single well-known name).
- **Freshness**: 6.0.1 is a current 6.x release; not a 0-day/just-published version. The
  6.x line is the Vite-native major (D-01).
- **Lifecycle-script discipline**: reveal.js is a library with **no** `postinstall`/`preinstall`/
  `install` lifecycle scripts required for our use; keep the workspace's deny-by-default
  install-script posture (pnpm `ignore-scripts`/allowlist as configured). `@types/reveal.js`
  is **not** installed. Verify via a lockfile diff that only `reveal.js` (and no transitive
  script-running package) is added.
- **Node Active LTS**: build/runtime baseline is Node ≥22 (Active LTS), unchanged by this
  dependency.
- **Disposition**: **accepted** — one well-known, script-free, pinned, self-hosted library;
  no CDN; footprint minimized to core + Notes.

## Adversarial evidence (post-spec squad)

The four-lens squad (`reviews/post-spec-squad.md`) is the adversarial challenge pass for
this plan's security-and-architecture-impacting decisions. Contested findings and disposition:

| Finding | Disposition |
|---|---|
| A-01 "Presentation anywhere" infeasible | **changed** — narrowed to path+kind (ADR-0021 D1); off-section = hard error (FR-022) |
| A-02 "Starlight-exclusion" misframing | **changed** — re-framed as Astro route-override shadowing (ADR-0021 D3) + route-uniqueness assertion |
| A-03 generator↔route URL parity unasserted | **changed** — URL-parity assertion added (ADR-0021 D4, FR-017) |
| A-04 in-frame sidebar node | **changed** — presentations excluded from in-frame sidebar (ADR-0021 D5) |
| A-05 RSS exclusion keyed on path | **changed** — keyed on `kind: Presentation` (FR-011) |
| A-06 reveal core sheet isolation | **changed** — non-leak covers core + map (FR-010, ADR-0022 D5) |
| R-01 axe cannot verify keyboard/reduced-motion | **changed** — Playwright interaction test (FR-021/NFR-007) |
| R-02 vacuous chrome-ignore assertion | **changed** — narrowed to speaker-note aside (FR-012) |
| R-03 optional draft deck untestable | **changed** — draft deck fixture mandated (FR-023) |
| R-04 headingless aria-label not emitted | **changed** — emit `aria-label` (FR-001) |
| P-01/P-02 discovery + overview mis-sequenced | **changed** — Layered-landing note re-sequenced; discovery before deck, overview co-lands with deck |
| P-03/P-04/P-05 ADR gate / a11y split / token verify | **changed** — reflected in IC-00, IC-05, IC-01 |
| Deferred items (per-file `deck:` override, Highlight, visual baseline, multi-block notes) | **deferred_with_rationale** — C-008 |

No contested finding was silently dropped.
