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
  // Persona fixture — the WP06 draft persona page (Marzipan the Mapmaker).
  persona: `${BASE}/personas/example-persona/`,
  // Hub page — the WP04 Hub layout.
  hub: `${BASE}/context/`,
  // Prose page — a standard Default-layout content page.
  prose: `${BASE}/guides/getting-started/`,
} as const;

// The axe coverage set: Persona fixture + Hub + prose, run in BOTH modes.
export const AXE_PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: 'Persona fixture (/personas/example-persona/)', path: ROUTES.persona },
  { name: 'Hub (/context/)', path: ROUTES.hub },
  { name: 'Prose (/guides/getting-started/)', path: ROUTES.prose },
];

// axe tag set — includes wcag22aa (SC-002 / NFR-001).
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

// axe runs over the WHOLE enumerated page (no narrowing `.include()`), so every
// doc-kitty bridge-token surface is covered — not just the header + main, but the
// sidebar, the TOC, and the footer, where the same `--dk-*→--sl-*` tokens apply
// (F2 fix: the earlier header.header + main scope missed those regions).
//
// These roots drive the NON-VACUITY guard only: before analyzing, each must exist
// on the page, so a mismatched selector / an un-rendered region fails loudly
// instead of reporting a clean zero against a page axe never really scanned. The
// TOC is intentionally NOT guarded — Starlight omits it on pages with no headings,
// so requiring it would be flaky; axe still covers it wherever it renders.
export const CHROME_ROOT = 'header.header';
export const CONTENT_ROOT = 'main';
export const SIDEBAR_ROOT = 'nav.sidebar';
export const FOOTER_ROOT = 'footer';
