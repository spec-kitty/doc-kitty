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
  // Slide deck — the published showcase reveal.js deck (WP05, AX-1/AX-2). This is
  // the OUT-OF-FRAME deck route (ADR-0021/0022): a COMPLETE standalone HTML
  // document, NOT the Starlight article shell — `main.reveal > .slides > section`,
  // a labelled `<nav>` of real `<button>`s, and NO header/sidebar/footer chrome.
  // Its axe coverage therefore rides the `deck` shell below, whose non-vacuity
  // guard asserts the deck's OWN surfaces (the Starlight chrome roots do not exist
  // here) — adding it to AXE_PAGES is exactly what finally scans it.
  deck: `${BASE}/presentations/showcase-deck/`,
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

// The axe coverage set: the four in-frame Starlight surfaces + the out-of-frame
// showcase deck, each run in BOTH colour modes.
export const AXE_PAGES: ReadonlyArray<AxePage> = [
  { name: 'Persona (/context/audience/example-persona/)', path: ROUTES.persona, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Hub (/context/)', path: ROUTES.hub, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Prose (/guides/getting-started/)', path: ROUTES.prose, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Blocks demonstrator (/architecture/blocks-demonstrator/)', path: ROUTES.blocks, shell: 'starlight', guardRoots: STARLIGHT_GUARD_ROOTS },
  { name: 'Deck (/presentations/showcase-deck/)', path: ROUTES.deck, shell: 'deck', guardRoots: DECK_GUARD_ROOTS },
];

// axe tag set — includes wcag22aa (SC-002 / NFR-001).
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;
