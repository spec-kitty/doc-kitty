/**
 * Locale alternates on a paged hub's listing pages (#342; the operator's Q9
 * ruling, 2026-11-25: drop the missing alternates).
 *
 * Each locale's hub pages by its own child count, so English can build
 * `missions/page/4/` while French stops at `fr/missions/page/3/`. Starlight
 * links every configured locale's version of a page, built or not, from two
 * places: the hreflang `<link rel="alternate">`s in the head (one per locale
 * plus `x-default`) and the language picker's `<option>`s (desktop and mobile).
 * On a listing page that would send readers and crawlers to a page that does not
 * exist.
 *
 * The picker takes its options straight from the locale config, not from route
 * data, and the toolkit's components map is fixed at its six carriers
 * (ADR-0015), so neither can be filtered while the page renders. The
 * route-shaping integration rewrites the built listing pages instead, in
 * `astro:build:done`, when every built page is known: an alternate whose target
 * is a listing URL (`<hub>/page/<n>`, n ≥ 2) that was not built is removed.
 * Nothing else is touched, and a site with no paged hub is never read.
 */

/** A listing page's route: `<hub>/page/<n>`, with n from 2 (page 1 is the hub itself). */
const LISTING_ROUTE = /(?:^|\/)page\/([1-9]\d*)$/;
const HREFLANG_LINK = /<link rel="alternate" hreflang="[^"]*" href="([^"]*)"\s*\/?>\n?/g;
const LANG_SELECT = /<starlight-lang-select>[\s\S]*?<\/starlight-lang-select>/g;
const PICKER_OPTION = /<option value="([^"]*)"[^>]*>[^<]*<\/option>/g;

/** The route of `href` (absolute, or a root-relative path) under `base`, or null outside it. */
function routeOf(href: string, base: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(href, 'http://dk.invalid').pathname);
  } catch {
    return null;
  }
  const prefix = base.replace(/\/+$/, '');
  if (prefix !== '') {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
    pathname = pathname.slice(prefix.length);
  }
  return pathname.replace(/^\/+|\/+$/g, '');
}

/** Whether `route` is a listing page route (`…/page/<n>`, n ≥ 2). */
function isListingRoute(route: string): boolean {
  const match = LISTING_ROUTE.exec(route);
  return match !== null && Number(match[1]) >= 2;
}

/** Whether an alternate pointing at `href` names a listing page that was not built. */
function unbuilt(href: string, base: string, built: ReadonlySet<string>): boolean {
  const route = routeOf(href, base);
  return route !== null && isListingRoute(route) && !built.has(route);
}

/**
 * `html` with every hreflang link and language-picker option removed whose
 * target is a listing page not in `built` (routes without slashes, no base).
 */
export function dropUnbuiltListingAlternates(html: string, base: string, built: ReadonlySet<string>): string {
  return html
    .replace(HREFLANG_LINK, (tag: string, href: string) => (unbuilt(href, base, built) ? '' : tag))
    .replace(LANG_SELECT, (block) =>
      block.replace(PICKER_OPTION, (tag: string, value: string) => (unbuilt(value, base, built) ? '' : tag)),
    );
}

/** Every hreflang and language-picker target of `html`, as routes, in document order (head first). */
export function listingAlternateTargets(html: string, base: string): string[] {
  const links = [...html.matchAll(HREFLANG_LINK)].map((m) => m[1]!);
  const options = [...html.matchAll(LANG_SELECT)].flatMap((block) => [...block[0].matchAll(PICKER_OPTION)].map((m) => m[1]!));
  return [...links, ...options].map((href) => routeOf(href, base)).filter((route): route is string => route !== null);
}

/** The built-HTML check: the listing routes `html` links as alternates that are not built, once each. */
export function unbuiltListingAlternates(html: string, base: string, built: ReadonlySet<string>): string[] {
  return [...new Set(listingAlternateTargets(html, base).filter((route) => isListingRoute(route) && !built.has(route)))];
}
