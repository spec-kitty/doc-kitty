# Mission Specification: Build-time diagram render — Mermaid + PlantUML (#13)

**Mission Branch**: `feat/diagram-build-render`
**Created**: 2026-09-07
**Status**: Draft
**Input**: Issue #13 — replace M5's client-side Mermaid render with build-time
static SVG for BOTH Mermaid and PlantUML; keep the `%%`/`'` metadata → `<figure>`
design, the `--dk-diagram-*` tokens, theme-awareness and accessibility.

Locked with the user: **dual-mode** (build-render when Playwright/Chromium is
available at build; fall back to the current client Mermaid render otherwise) and
**full PlantUML parity** (build-render + the `'`-comment metadata twin + example +
gates). Phase-0 design and a working feasibility spike are in
[research.md](./research.md).

This is a large, multi-slice feature. It changes what ships to the browser (build
mode ships no diagram runtime JS), adds two render dependencies, adds CI/deploy
infra (Chromium + a self-hosted PlantUML server), and — the largest hidden work —
makes every existing diagram gate **mode-aware** rather than assuming client render.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mermaid renders to a static, themed, accessible SVG at build (P1)
With build-render enabled, a ```mermaid block becomes an inline `<svg>` generated
at build time (via `@beoe/rehype-mermaid`, Playwright/Chromium), wrapped in the
existing `<figure class="dk-diagram" role="group">` + `<figcaption>`, named by its
`%%` metadata, and themed via `var(--dk-diagram-*)` so light/dark works with NO
client JS. No Mermaid runtime chunk ships for that page.

**Independent Test**: build the example with build-render on; a diagram page's HTML
contains an inline `<svg>` with `<title>`/`<desc>` (from `%% title/description`) and
`var(--dk-diagram-*)` fills; toggling `[data-theme]` changes the rendered colours
with no script; no `/_astro/mermaid*.js` ships and no `/mermaid/i` network request.

**Acceptance Scenarios**:
1. **Given** build-render on, **When** a ```mermaid page builds, **Then** its
   figure holds one inline `<svg>` (no `pre.mermaid`, no client render owner), the
   SVG carries `<title>`/`<desc>` matching the `%%` metadata, and every themeable
   fill/stroke is `var(--dk-diagram-*)`.
2. **Given** the built page, **When** `[data-theme]` flips, **Then** the SVG's
   computed node fill equals the other mode's `--dk-diagram-node-fill` — with no
   re-render and no JS (pure CSS var re-resolution).
3. **Given** the built corpus, **When** its shipped JS is scanned, **Then** no
   Mermaid runtime chunk is present and no diagram page fetches one.

### User Story 2 - Dual-mode: client fallback when the build can't run Chromium (P1)
When Playwright/Chromium is not available at build (an adopter's constrained env),
the build falls back to the current client Mermaid render — unchanged behaviour —
so `pnpm build` never hard-fails for lack of a browser.

**Independent Test**: with build-render forced off (no Chromium / flag off), a
```mermaid page builds exactly as today (a `pre.mermaid`, the client render owner,
the Mermaid runtime chunk) and the pre-#13 diagram gates pass.

**Acceptance Scenarios**:
1. **Given** build-render unavailable/off, **When** the example builds, **Then**
   the diagram output is byte-identical to the pre-#13 client-render output.
2. **Given** either mode, **When** the build runs, **Then** the active mode is
   deterministic and observable (a resolved flag) so gates assert the right mode.

### User Story 3 - PlantUML renders to a static, themed, accessible SVG at build (P1)
A ```plantuml block becomes an inline `<svg>` generated at build time (via
`astro-plantuml` against a self-hosted PlantUML server — NEVER plantuml.com),
wrapped in the SAME `<figure>`/`<figcaption>` treatment, named by a `'`-comment
metadata block (title/description/attribution/source — the parser twin of the
Mermaid `%%` pass), and themed via `var(--dk-diagram-*)`.

**Independent Test**: build a ```plantuml example page; its HTML holds an inline
`<svg>` with an accessible name from `' title/description`, the shared figure/caption,
and `var(--dk-diagram-*)` colours; the render never contacts plantuml.com.

**Acceptance Scenarios**:
1. **Given** a ```plantuml block with a leading `' key: value` block, **When** it
   builds, **Then** the figure holds an inline themed `<svg>` named by the metadata,
   with the same caption structure as a Mermaid figure.
2. **Given** the PlantUML render, **When** the build runs, **Then** it resolves only
   the configured self-hosted `serverUrl` (or local cache) — never plantuml.com.

### User Story 4 - CI and deploy build the diagrams (P2)
The `build-example` and `deploy` builds render diagrams (Chromium for Mermaid, a
self-hosted PlantUML service), with a disk cache so unchanged diagrams don't
relaunch the engines, and the pinned visual/golden baselines are regenerated once
under the build engines and pinned.

**Independent Test**: CI's build-example produces build-rendered diagrams; the a11y
and artifact gates pass against them; deploy builds identically.

**Acceptance Scenarios**:
1. **Given** CI, **When** build-example runs, **Then** Chromium and the PlantUML
   server are available and diagrams build to static SVG; the deploy build matches.
2. **Given** unchanged diagrams, **When** a rebuild runs, **Then** the disk cache
   short-circuits the engines (no needless Chromium/PlantUML launch).

### Edge Cases
- **No-JS**: build-mode SVG is fully static, so diagrams work with JS disabled
  (a strict improvement over M5's no-JS = source+caption).
- **Deck (out-of-frame)**: build-mode decks embed static SVGs; the reveal
  slide-by-slide client re-render machinery is bypassed in build mode (a static
  SVG needs no settle) but retained for the client fallback.
- **Malformed diagram**: a render error must fail the build loudly (never emit a
  broken/empty figure or silently fall back mid-page), OR degrade to the client
  path deterministically — decided per engine in the plan.
- **Derived Mermaid shades**: every themeVariable Mermaid consumes is pinned to a
  distinct sentinel so no derived colour escapes the `var()` rewrite (research D7).
- **CSP**: build-mode ships no diagram JS; inline SVG `<style>` still needs
  `style-src 'unsafe-inline'` (unchanged). Client fallback keeps the M5 posture.

## Requirements *(mandatory)*

### Functional Requirements
| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Mermaid build-render to inline SVG | US1 | High | Open |
| FR-002 | Themeable SVG via `var(--dk-diagram-*)` rewrite | US1 | High | Open |
| FR-003 | Accessible name + shared figure/caption on the build SVG | US1 | High | Open |
| FR-004 | Dual-mode fallback to client render | US2 | High | Open |
| FR-005 | Deterministic, gate-observable mode selection | US2 | High | Open |
| FR-006 | PlantUML build-render to inline SVG (self-hosted) | US3 | High | Open |
| FR-007 | PlantUML `'`-comment metadata parser twin | US3 | Medium | Open |
| FR-008 | Shared figure/caption + theme rewrite for PlantUML | US3 | Medium | Open |
| FR-009 | CI + deploy render infra (Chromium + PlantUML server) + cache | US4 | High | Open |
| FR-010 | Mode-aware diagram gates (build vs client) | US1/US2 | High | Open |
| FR-011 | Example PlantUML page + regenerated baselines | US3/US4 | Medium | Open |

### Non-Functional Requirements
| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | No diagram runtime JS in build mode | A build-render page ships zero Mermaid/PlantUML runtime JS and makes zero diagram network requests. | Performance | High | Open |
| NFR-002 | Client-fallback byte-parity | With build-render off, diagram output is byte-identical to the pre-#13 client render. | Reliability | High | Open |
| NFR-003 | Deterministic SVG bytes | Build-render SVGs are byte-stable across builds (pinned engine versions + cache); goldens pin them. | Reliability | High | Open |
| NFR-004 | A11y preserved | Build SVGs pass axe `svg-img-alt` and the diagram.spec.ts accessible-name/figure assertions in both modes. | Accessibility | High | Open |
| NFR-005 | Full gate suite green | Unit, build, validate/assert, a11y, and CI pass in the active mode. | Quality gate | High | Open |

### Constraints
| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Never plantuml.com | PlantUML render resolves only a self-hosted server or local cache; the public plantuml.com endpoint is never contacted (privacy). | Security | High | Open |
| C-002 | Pinned render deps | `@beoe/rehype-mermaid`, its render-time mermaid, and `astro-plantuml` are exact-pinned (golden-file deps). Client-fallback keeps `mermaid@11.17.1`. | Technical | High | Open |
| C-003 | Preserve the metadata + token contracts | The `%%`/`'` closed field set {title,description,attribution,source}, the `<figure role=group>`/`<figcaption>` structure, and the six `--dk-diagram-*` tokens + their contrast ratios are unchanged. | Technical | High | Open |
| C-004 | Opt-in, no forced dep | Build-render is under the existing `diagrams` opt-in; a site with diagrams off is byte-identical and pulls no render dep. | Technical | High | Open |
| C-005 | Dual-mode both-green | Both modes keep the full gate suite green; gates are mode-aware, never weakened. | Technical | High | Open |

### Key Entities
- **Build-render stage**: the rehype/remark stage(s) that turn a diagram fence
  into a themed, accessible inline-SVG `<figure>` at build (Mermaid via
  `@beoe/rehype-mermaid`; PlantUML via `astro-plantuml`).
- **Sentinel→var table**: the deterministic map from the sentinels handed to the
  render engine to `var(--dk-diagram-*)`, applied by the theme rewrite.
- **Mode flag**: the resolved, gate-observable selector between build and client
  render.

## Success Criteria *(mandatory)*
- **SC-001**: In build mode, 100% of diagram figures hold an inline `<svg>` (0
  `pre.mermaid`, 0 diagram runtime chunks shipped); the a11y + artifact gates pass.
- **SC-002**: A `[data-theme]` toggle changes a build SVG's computed node fill to
  the other mode's token with no script.
- **SC-003**: With build-render off, diagram output is byte-identical to pre-#13.
- **SC-004**: A ```plantuml example renders a themed, named inline SVG without ever
  contacting plantuml.com.
- **SC-005**: CI build-example + deploy render diagrams; all gates green in build mode.
