// Enumerated coverage surface for the accessibility lane (WP09 T040).
//
// These are NAMED CONSTANTS, not "a representative page": adding or removing a route
// is a visible diff in this file, so the coverage set is auditable. Routes are
// absolute and carry the site base (`/doc-kitty`, from example/astro.config.mjs) so
// they resolve exactly as GitHub Pages serves them.
export const BASE = '/doc-kitty';

export const ROUTES = {
  // Brand home — the visual-regression baseline target (T041).
  home: `${BASE}/`,
  // Persona page — the relocated, published persona (Marzipan the Mapmaker) at
  // its design-of-record location under context/audience/ (ADR-0020).
  persona: `${BASE}/context/audience/example-persona/`,
  // Hub page — the WP04 Hub layout.
  hub: `${BASE}/context/`,
  // Prose page — a standard Default-layout content page.
  prose: `${BASE}/guides/getting-started/`,
  // Blocks demonstrator — the WP06 page that renders ALL THREE content blocks
  // (audience + related + external-references) so axe scans a wired block page
  // (post-spec R1). Without this route the block renderers were exercised by zero
  // pages, making WP04's "blocks clear the a11y lane" vacuous.
  blocks: `${BASE}/architecture/blocks-demonstrator/`,
  // Diagram demonstrator — the mission M5 page (WP04) that renders TWO diagrams: a
  // fully-annotated flowchart and a description-only sequence. Both fences carry
  // `%%` metadata, so both render to a themed `<figure class="dk-diagram">` whose
  // `<svg>` gains `aria-labelledby` (see the render-gate note on `AxePage`).
  diagram: `${BASE}/architecture/diagram-demonstrator/`,
  // PlantUML demonstrator — the #13 WP02 build-only page (a ```plantuml fence with
  // `'`-comment metadata). In BUILD mode it renders a themed, named static SVG
  // figure against the self-hosted server (never plantuml.com); in CLIENT mode
  // PlantUML has no renderer, so the fence stays a plain code block (no figure).
  // The diagram e2e's build branch asserts the named figure here (DX-2/DX-5).
  plantuml: `${BASE}/architecture/plantuml-demonstrator/`,
  // Glossary demonstrator — the CONTEXT-FREE page (WP09 T033). It declares NO
  // `glossary_context`, so it carries BOTH a plain auto-link (`cargo`, single
  // context) AND a `:term`-only forced link (`policy` → the hr context) that a
  // context-free page could not have produced by resolution — the two halves the
  // non-vacuity guard distinguishes (an unresolved `policy` would otherwise be
  // plain). It also renders the "On this page" glossary sub-list and mounts the
  // hover-preview island, so the axe scan, the 1.4.13 spec, the footprint twin,
  // and the JS-off check all key on this one route.
  glossaryDemo: `${BASE}/glossary-demo/cargo-and-collisions/`,
  // Slide deck — the published showcase reveal.js deck (WP05, AX-1/AX-2). This is
  // the OUT-OF-FRAME deck route (ADR-0021/0022): a COMPLETE standalone HTML
  // document, NOT the Starlight article shell — `main.reveal > .slides > section`,
  // a labelled `<nav>` of real `<button>`s, and NO header/sidebar/footer chrome.
  // Its axe coverage therefore rides the `deck` shell below, whose non-vacuity
  // guard asserts the deck's OWN surfaces (the Starlight chrome roots do not exist
  // here) — adding it to AXE_PAGES is exactly what finally scans it.
  deck: `${BASE}/presentations/showcase-deck/`,
  // Diagram-free PUBLISHED deck (WP05 T022 / NFR-002 / C7). The showcase deck
  // proves diagrams RENDER; this deck proves the opposite footprint half — a deck
  // with NO `mermaid` fence must resolve ZERO Mermaid runtime chunks on its route
  // (the render owner's `if (!nodes.length) return;` short-circuits BEFORE
  // `import('mermaid')`). It is the ONLY observable NFR-002 proof at deck level:
  // FP-1's control route covers doc pages only, and citing the production guard is
  // circular. Deliberately NOT added to AXE_PAGES and given NO `renderWait` — it
  // has no diagram to gate on and a render-gate would hang forever.
  deckNoDiagram: `${BASE}/presentations/roadmap-deck/`,
  // Markua showcase — the WP10 verification corpus (markua-syntax-support). One
  // page exercising every coverage-matrix construct: the ten callout classes ×
  // three input forms, asides (incl. a live nested `{aside}`), figures, crosslink
  // ids, and icons. Scanned in BOTH modes; its guardRoots pin construct-specific
  // selectors a Markua-free page cannot satisfy.
  markuaShowcase: `${BASE}/guides/markua-showcase/`,
  // Markua-capable deck — the markua-decks mission fixture (#47, WP04). The
  // OUT-OF-FRAME deck route (same shell as `deck`/`deckNoDiagram` above), NOT
  // the in-frame `markuaShowcase`/`markuaMalformed` pages: this proves the four
  // content passes (`markuaNormalise`/`markuaAttributes`/`markuaCallouts`/
  // `markuaFigure`) now render their constructs ON A SLIDE, composed with
  // `deckSplit` without swallowing a `##`/`###` boundary. Exercises a `W>`
  // caution aside, an `{aside}…{/aside}` wrapper, a `{#id}` attribute line
  // adjacent to a `###`, and a body figure distinct from the title-slide hero.
  markuaDeck: `${BASE}/presentations/markua-deck/`,
  // Markua graceful-degradation page — the deliberately-malformed fixture
  // (unknown icon / unbalanced wrapper / unsupported attr). Scanned for a11y so
  // the degraded output (icon-less tip, literal `{aside}`, ignored `{fullbleed:}`)
  // clears WCAG too.
  markuaMalformed: `${BASE}/guides/markua-malformed/`,
  // Ars Rhetorica showcase — the rhetoric hub (WP02/T003), the Hub-layout landing
  // for the ported corpus. Scanned in BOTH modes as a real long-form content hub.
  rhetoricHub: `${BASE}/rhetoric/`,
  // Ars Rhetorica showcase — Book I, chapter 1 (WP04/T012). The representative
  // long-form prose page carrying the full footnote apparatus (`[^^…]` →
  // `class="footnotes"` back-references) AND a `{blurb}` callout (→ `dk-callout`),
  // so the axe scan covers the corpus's densest reader-facing surface in both
  // colour modes (SC-005 / the a11y half of the showcase acceptance).
  rhetoricChapter: `${BASE}/rhetoric/book-one/chapter-01/`,
} as const;

// ---------------------------------------------------------------------------
// axe coverage entries carry a `shell` discriminant so the ONE axe lane can scan
// two structurally different page kinds without a silent, chrome-guard-vacuous
// pass:
//   • 'starlight' — the in-frame Starlight article pages. Colour mode resolves
//     through Starlight's `localStorage['starlight-theme']` + `data-theme`
//     resolver (see mode.ts `gotoInMode`); the non-vacuity guard asserts the
//     header/main/sidebar/footer chrome really rendered.
//   • 'deck'      — the out-of-frame reveal deck. It has NO Starlight resolver
//     and NO `prefers-color-scheme` fallback (its `--dk-*` dark tokens live only
//     under `:root[data-theme='dark']`, theme.css), so dark is driven by setting
//     that same `data-theme` attribute directly (mode.ts `gotoDeckInMode`); the
//     guard asserts the deck's own surfaces (`main.reveal`, `.slides`, a rendered
//     `<section>`, and the labelled nav buttons) instead of the absent chrome.
// `guardRoots` is the per-shell non-vacuity set: each selector must exist before
// axe analyzes, so a mismatched selector / un-rendered region fails loudly rather
// than reporting a clean zero against a page axe never really scanned.
export type AxeShell = 'starlight' | 'deck';

export interface AxePage {
  name: string;
  path: string;
  shell: AxeShell;
  guardRoots: readonly string[];
  // Render-gate (WP06 DX-1). A diagram renders CLIENT-SIDE, so on a diagram route
  // axe must first WAIT for that render before scanning — otherwise it scores the
  // bare `<pre>` and passes vacuously. `renderWait` is a locator awaited
  // UNCONDITIONALLY in axe.spec.ts (never "if a figure exists, wait" — a gate that
  // fires only when the element is already present can never fail). It is matched
  // against `expect(...).toHaveCount(renderCount)`, so the gate is COUNT-AWARE: the
  // demonstrator renders TWO diagrams, and a bare `.toBeVisible()`/`.first()` would
  // strict-throw or gate only one. Metadata-eligibility: the gate locator
  // `figure.dk-diagram svg[aria-labelledby]` ONLY appears when the fence carried
  // `%%` metadata (the remark pass injects `accTitle`, and Mermaid sets
  // `aria-labelledby` only when an accTitle is present). A scanned diagram route
  // MUST therefore carry metadata on every fence — a bare fence would render an
  // `aria-labelledby`-less `<svg>` and hang the count gate.
  renderWait?: string;
  // The EXACT number of gated diagrams the route renders (the `renderWait` count).
  renderCount?: number;
}

// Starlight chrome roots (unchanged coverage): header + main + sidebar + footer,
// everywhere the `--dk-*→--sl-*` bridge tokens apply (F2 fix widened this past
// header + main). The TOC is intentionally NOT guarded — Starlight omits it on
// heading-less pages, so requiring it would be flaky; axe still covers it wherever
// it renders.
export const CHROME_ROOT = 'header.header';
export const CONTENT_ROOT = 'main';
export const SIDEBAR_ROOT = 'nav.sidebar';
export const FOOTER_ROOT = 'footer';
const STARLIGHT_GUARD_ROOTS = [
  CHROME_ROOT,
  CONTENT_ROOT,
  SIDEBAR_ROOT,
  FOOTER_ROOT,
] as const;

// Deck surfaces (the deck's real, rendered structure — see DeckLayout.astro): the
// labelled `main.reveal` region, the `.slides` container, at least one rendered
// slide `<section>` (the transform's output), and the labelled nav `<button>`s.
export const DECK_MAIN_ROOT = 'main.reveal';
export const DECK_SLIDES_ROOT = '.reveal .slides';
export const DECK_SECTION_ROOT = '.reveal .slides section';
export const DECK_NAV_BUTTON_ROOT = 'nav.dk-deck-controls button';
const DECK_GUARD_ROOTS = [
  DECK_MAIN_ROOT,
  DECK_SLIDES_ROOT,
  DECK_SECTION_ROOT,
  DECK_NAV_BUTTON_ROOT,
] as const;

// The rendered-diagram non-vacuity root (WP06 F3): the client render's output — a
// `<figure class="dk-diagram">` whose `<svg>` carries `aria-labelledby`. Added to a
// diagram route's `guardRoots` so the scan's own non-vacuity contract covers a
// RENDERED diagram, not just the page chrome. `guardRoots` uses instantaneous
// `.count()` with NO auto-wait, so this must be evaluated AFTER the `renderWait`
// gate (axe.spec.ts orders the gate first) or it would read zero before the render.
export const DIAGRAM_SVG_ROOT = 'figure.dk-diagram svg[aria-labelledby]';
const STARLIGHT_DIAGRAM_GUARD_ROOTS = [
  ...STARLIGHT_GUARD_ROOTS,
  DIAGRAM_SVG_ROOT,
] as const;

// The deck's diagram-slide axe entry (below, Renata's finding) additionally
// guards the rendered diagram `<svg>` root, on top of the plain deck surfaces —
// so that scan's own non-vacuity contract covers a RENDERED deck diagram, not
// just the deck chrome.
const DECK_DIAGRAM_SLIDE_GUARD_ROOTS = [...DECK_GUARD_ROOTS, DIAGRAM_SVG_ROOT] as const;

// Glossary non-vacuity (WP09 T033 / R-1, FR-014 — the M5 vacuous-green lesson).
// A `:term` link is BYTE-IDENTICAL to an auto-link, so a bare `a[data-glossary-term]`
// count proves NEITHER half distinctly (a pure auto-link page would satisfy it
// vacuously). So the glossary route's guardRoots pin TWO selectors a link-free (or
// `:term`-less) page cannot satisfy, evaluated by axe.spec's `.count()` gate BEFORE
// the scan:
//   1. an AUTO-LINK discriminator — `cargo` is a single-context term, so an
//      `a[data-glossary-term="cargo"]` can ONLY have come from the auto-linker; and
//   2. a `:term`-ONLY discriminator — the scanned page's own `glossary_context` is
//      NOT `hr`, so an `a[data-glossary-context="hr"]` pointing at `/glossary/hr/#policy`
//      can ONLY have come from an explicit `:term[policy]{context=hr}` (an unresolved
//      `policy` collision would be plain text). A link-free page FAILS the gate.
export const GLOSSARY_AUTOLINK_ROOT = 'a[data-glossary-term="cargo"]';
export const GLOSSARY_TERM_ROOT =
  'a[data-glossary-context="hr"][href*="/glossary/hr/#policy"]';
const STARLIGHT_GLOSSARY_GUARD_ROOTS = [
  ...STARLIGHT_GUARD_ROOTS,
  GLOSSARY_AUTOLINK_ROOT,
  GLOSSARY_TERM_ROOT,
] as const;

// Markua non-vacuity (WP10 — the M5/glossary vacuous-green lesson). A Markua-free
// page renders NONE of these, so a construct-free / preset-off regression makes
// the `.count()` gate fail RED instead of reporting a clean zero. Three DISTINCT
// render paths are pinned so a single broken path is caught, not masked:
//   1. the NATIVE mapped path — a `T>` yields `starlight-aside--tip` ONLY when the
//      markua plugins run before Starlight's remarkAsides (the ordering lock);
//   2. the THEME-hast path — a `D>` yields `dk-callout--discussion` (proves the
//      theme emitter, not a vacuous aside);
//   3. the FIGURE path — `figure.dk-figure` (proves the image→figure rehype ran).
export const MARKUA_ASIDE_TIP_ROOT = 'aside.starlight-aside--tip';
export const MARKUA_THEME_DISCUSSION_ROOT = 'aside.dk-callout--discussion';
export const MARKUA_FIGURE_ROOT = 'figure.dk-figure';
const STARLIGHT_MARKUA_GUARD_ROOTS = [
  ...STARLIGHT_GUARD_ROOTS,
  MARKUA_ASIDE_TIP_ROOT,
  MARKUA_THEME_DISCUSSION_ROOT,
  MARKUA_FIGURE_ROOT,
] as const;
// The malformed page has no native tip (its tip carries an unknown icon → theme
// `dk-callout--tip`) and a `dk-figure`; pin those two so its scan is non-vacuous.
export const MARKUA_MALFORMED_TIP_ROOT = 'aside.dk-callout--tip';
const STARLIGHT_MARKUA_MALFORMED_GUARD_ROOTS = [
  ...STARLIGHT_GUARD_ROOTS,
  MARKUA_MALFORMED_TIP_ROOT,
  MARKUA_FIGURE_ROOT,
] as const;

// Markua-capable DECK non-vacuity (#47, WP04). On a deck every mapped callout
// name (including `caution`, the `W>` fold target) is FORCED through the theme
// hast (`forceTheme`, markua-callouts.internal.ts) rather than the native
// Starlight aside — DeckLayout links no `starlight-aside` CSS — so the deck's
// own construct roots are theme classes, not the Starlight-mapped root the
// in-frame Markua pages pin above.
export const MARKUA_DECK_CAUTION_ROOT = 'aside.dk-callout--caution';
export const MARKUA_DECK_ASIDE_ROOT = 'aside.dk-callout--aside';
const DECK_MARKUA_GUARD_ROOTS = [
  ...DECK_GUARD_ROOTS,
  MARKUA_DECK_CAUTION_ROOT,
  MARKUA_DECK_ASIDE_ROOT,
  MARKUA_FIGURE_ROOT,
] as const;

// The axe coverage set: the four in-frame Starlight surfaces + the diagram
// demonstrator (WP06 T020) + the out-of-frame showcase deck, each run in BOTH
// colour modes. The diagram routes (demonstrator + deck) carry a `renderWait` gate
// (awaited before axe scans) and a `guardRoots` extended with the rendered `<svg>`.
export const AXE_PAGES: ReadonlyArray<AxePage> = [
  { name: 'Persona (/context/audience/example-persona/)', path: ROUTES.persona, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Hub (/context/)', path: ROUTES.hub, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Prose (/guides/getting-started/)', path: ROUTES.prose, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Blocks demonstrator (/architecture/blocks-demonstrator/)', path: ROUTES.blocks, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  // WP06 T020 — the demonstrator renders TWO metadata-carrying diagrams, so the
  // gate waits for count 2 before axe scans (both modes).
  {
    name: 'Diagram demonstrator (/architecture/diagram-demonstrator/)',
    path: ROUTES.diagram,
    shell: 'starlight',
    guardRoots: STARLIGHT_DIAGRAM_GUARD_ROOTS,
    renderWait: DIAGRAM_SVG_ROOT,
    renderCount: 2,
  },
  // WP09 T033 — the context-free glossary demonstrator, scanned in BOTH modes.
  // No `renderWait`: glossary links are build-time SSR (not a client render), so
  // the two non-vacuity guardRoots are present the moment the page serves and are
  // checked by the `.count()` gate directly. A link-free page fails that gate.
  {
    name: 'Glossary demonstrator (/glossary-demo/cargo-and-collisions/)',
    path: ROUTES.glossaryDemo,
    shell: 'starlight',
    guardRoots: STARLIGHT_GLOSSARY_GUARD_ROOTS,
  },
  // WP06 T020 — the showcase deck was ALREADY scanned here. WP02 (deck-layout-
  // polish) reshaped the title slide to a plain h1 + hero image so it carries
  // NO diagram: the first `## Out-of-frame deck pipeline` diagram moved to
  // slide 2. Deck diagrams render LAZILY on `slidechanged` (INV-SCOPE,
  // diagram-render.client) — a diagram on a not-yet-visited slide is simply
  // not in the DOM — so the view axe actually scans here (the load-time title
  // slide) now renders ZERO diagrams. A `renderWait`/`renderCount` gate would
  // therefore either read 0 (vacuous) or HANG waiting for a load-time `<svg>`
  // that never appears. So this entry drops both: `guardRoots` uses the plain
  // `DECK_GUARD_ROOTS` (no rendered-svg root — there is nothing to guard for
  // at load), and there is no render-gate at all. The per-slide diagram
  // render + accessible-name/geometry/theme-token coverage for ALL THREE deck
  // diagrams (slide 2, slide 3, and the inner-stack leaf) is owned by
  // diagram.spec.ts, which navigates the live deck before asserting — not
  // here.
  {
    name: 'Deck (/presentations/showcase-deck/)',
    path: ROUTES.deck,
    shell: 'deck',
    guardRoots: DECK_GUARD_ROOTS,
  },
  // Renata's pre-PR finding (deck-layout-polish squad): the bare-deck entry
  // above deliberately drops the render-gate (see its comment) because the
  // load-time title slide renders zero diagrams — but that means the axe lane
  // no longer covers a RENDERED deck diagram's enhanced DOM at all. This
  // SECOND deck entry deep-links to `#/1` (the 'Out-of-frame deck pipeline'
  // slide, the first slide carrying a diagram) so `gotoDeckInMode` lands there
  // on load — reveal's `hash:true` config reads the URL hash at `initialize()`,
  // so the deck opens directly on that slide (verified: the diagram's `<svg
  // aria-labelledby>` is already in the DOM immediately after `.reveal.ready`,
  // no `slidechanged` navigation needed) — and the render-gate below waits for
  // it before axe scans. `guardRoots` extends the plain deck surfaces with the
  // rendered-svg root so the scan is non-vacuous for the diagram too.
  {
    name: 'Deck — diagram slide (#/1)',
    path: `${ROUTES.deck}#/1`,
    shell: 'deck',
    guardRoots: DECK_DIAGRAM_SLIDE_GUARD_ROOTS,
    renderWait: DIAGRAM_SVG_ROOT,
    renderCount: 1,
  },
  // WP10 (markua) — the showcase corpus, scanned in BOTH modes. No `renderWait`:
  // asides/callouts/figures/ids are build-time SSR (not a client render), so the
  // three non-vacuity guardRoots (native tip, theme discussion, figure) are
  // present the moment the page serves and are checked by the `.count()` gate. A
  // Markua-free (or preset-off-regressed) page fails that gate.
  {
    name: 'Markua showcase (/guides/markua-showcase/)',
    path: ROUTES.markuaShowcase,
    shell: 'starlight',
    guardRoots: STARLIGHT_MARKUA_GUARD_ROOTS,
  },
  // WP10 (markua) — the graceful-degradation page: the degraded output (icon-less
  // theme tip + a `dk-figure`) must clear WCAG too. Guarded on those two surfaces.
  {
    name: 'Markua graceful degradation (/guides/markua-malformed/)',
    path: ROUTES.markuaMalformed,
    shell: 'starlight',
    guardRoots: STARLIGHT_MARKUA_MALFORMED_GUARD_ROOTS,
  },
  // markua-decks (#47, WP04) — the Markua-capable OUT-OF-FRAME deck. No
  // `renderWait`: the callouts/wrapper/attribute/figure constructs are build-time
  // SSR (not a client render), so the guardRoots are present the moment the
  // route serves and are checked by the `.count()` gate directly.
  {
    name: 'Markua-capable deck (/presentations/markua-deck/)',
    path: ROUTES.markuaDeck,
    shell: 'deck',
    guardRoots: DECK_MARKUA_GUARD_ROOTS,
  },
  // ars-rethorica-example (WP09 T035) — the rhetoric hub, an in-frame Starlight
  // Hub-layout landing. Same chrome pattern as the sibling prose/hub routes; no
  // `renderWait` (no client render). Scanned in BOTH colour modes.
  {
    name: 'Rhetoric hub (/rhetoric/)',
    path: ROUTES.rhetoricHub,
    shell: 'starlight',
    guardRoots: STARLIGHT_GUARD_ROOTS,
  },
  // ars-rethorica-example (WP09 T035) — Book I chapter 1, the corpus's densest
  // prose page: footnote apparatus (`class="footnotes"`) + a `{blurb}` callout
  // (`dk-callout`). Same in-frame Starlight chrome pattern as the sibling prose
  // routes; no client render, so no `renderWait`. Scanned in BOTH colour modes.
  {
    name: 'Rhetoric chapter (/rhetoric/book-one/chapter-01/)',
    path: ROUTES.rhetoricChapter,
    shell: 'starlight',
    guardRoots: STARLIGHT_GUARD_ROOTS,
  },
];

// axe tag set — includes wcag22aa (SC-002 / NFR-001).
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;
