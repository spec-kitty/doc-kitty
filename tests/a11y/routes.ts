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

// Chrome + content roots the doc-kitty toolkit owns. axe is scoped to these so the
// gate measures this mission's surface (and so an empty/mismatched scope fails the
// non-vacuity guard rather than reporting a clean zero against nothing).
export const CHROME_ROOT = 'header.header';
export const CONTENT_ROOT = 'main';
