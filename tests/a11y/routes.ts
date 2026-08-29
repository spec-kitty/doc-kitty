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
const DECK_DIAGRAM_GUARD_ROOTS = [...DECK_GUARD_ROOTS, DIAGRAM_SVG_ROOT] as const;

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
  // WP06 T020 — the showcase deck was ALREADY scanned here; it is UPDATED (not
  // duplicated) with the render-gate for its new first-slide diagram (title +
  // description → one gated `<svg>`). Adding a second deck entry would be the trap.
  {
    name: 'Deck (/presentations/showcase-deck/)',
    path: ROUTES.deck,
    shell: 'deck',
    guardRoots: DECK_DIAGRAM_GUARD_ROOTS,
    renderWait: DIAGRAM_SVG_ROOT,
    // KEEP THIS AT 1 (WP05 T024 / D2). The load-time render count is the
    // TITLE-SLIDE diagram ONLY: the slide-2 and inner-stack diagrams WP04 added
    // are `display:none` at deck-ready and render only on their `slidechanged`
    // (INV-SCOPE, diagram-render.client), so they add NOTHING to the load-time
    // count axe gates on. A naive bump to 2 would make `expect(...).toHaveCount(2)`
    // wait for a second load-time `<svg>` that never appears — HANGING the axe
    // gate forever. The per-slide render of those nodes is locked in
    // diagram.spec.ts (T019/T020), not here.
    renderCount: 1,
  },
];

// axe tag set — includes wcag22aa (SC-002 / NFR-001).
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;
