/**
 * Which surfaces a site serves (FR-002): the one source of that truth, detected from
 * the site's resolved routes with no declaration. Only the standard paths in
 * {@link SURFACE_ROUTES} are recognised, so a route at another path stays undetected.
 */
import { DK_SERVED_SURFACES_ENV } from './internal-env.mjs';

/** Each route-detected surface and the route pattern that serves it. */
const SURFACE_ROUTES = {
  llms: '/llms.txt',
  agentIndex: '/api/index.json',
  agentPages: '/api/pages/[...slug].json',
  rss: '/rss.xml',
  bibliography: '/api/bibliography.json',
  scenarios: '/api/scenarios.json',
  contentGraph: '/api/content-graph.json',
  pageAtom: '/api/pages/[...slug].atom.xml',
} as const;

export type ServedSurfaces = Record<keyof typeof SURFACE_ROUTES, boolean> & {
  /** `@astrojs/sitemap` writes nothing without `site`. */
  sitemap: boolean;
  /** Its integration is always added, and the bundle has an `okf/index.md`. */
  okf: true;
  /** The `openapi` option is set: the reference pages are served (WP02). */
  openapi: boolean;
  /**
   * The PDFs the site publishes at `/pdf/<name>.pdf` (ADR-0081): each section with its
   * own PDF, then `site` for the whole-site PDF. Unlike the rest, this comes from the
   * resolved `pdf` settings, not from the routes: the PDFs are printed after the build,
   * so nothing in the build serves them yet. Empty without `site`: no print route is
   * built then, so no PDF is printed.
   */
  pdf: string[];
};

/**
 * @param patterns the site's route patterns, without the base
 * @param siteConfigured whether `config.site` is set
 * @param openapi whether the `openapi` option is set (route detection cannot
 *   see the renderer's injected routes, so the option says it)
 */
export function detectServedSurfaces(
  patterns: string[],
  siteConfigured: boolean,
  openapi = false,
  pdf: readonly string[] = [],
): ServedSurfaces {
  const routes = new Set(patterns);
  const detected = Object.fromEntries(
    Object.entries(SURFACE_ROUTES).map(([surface, pattern]) => [surface, routes.has(pattern)]),
  ) as Record<keyof typeof SURFACE_ROUTES, boolean>;
  return { ...detected, sitemap: siteConfigured, okf: true, openapi, pdf: siteConfigured ? [...pdf] : [] };
}

let cached: { raw: string; surfaces: ServedSurfaces } | undefined;

/**
 * The detection result, or `undefined` when detection has not run, as when a route
 * is called without the integration. Carriers call it on every page, so a value is
 * parsed once.
 */
export function servedSurfaces(): ServedSurfaces | undefined {
  const raw = process.env[DK_SERVED_SURFACES_ENV];
  if (raw === undefined) return undefined;
  if (cached?.raw !== raw) cached = { raw, surfaces: JSON.parse(raw) as ServedSurfaces };
  return cached.surfaces;
}
