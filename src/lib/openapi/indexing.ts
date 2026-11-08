/**
 * Holding an unreleased spec version out of the sitemap and the search index
 * (mission openapi-second-slice-01M6WXJ4, WP05; FR-013, FR-015; research R2).
 *
 * Two decisions, one per surface, both registered through the seams WP02 ships
 * (plan.md's parallel-edit registry) and both pushed from `adapters.ts`:
 *
 *  - **Search** — {@link openApiPagefind} is a `pagePropsHooks` entry, so its
 *    value lands in the frontmatter `patchPageProps` splices into the pinned
 *    renderer's `getPageProps`. Starlight writes `data-pagefind-body` only when
 *    that frontmatter value is not `false`, and Pagefind indexes just the pages
 *    carrying the marker (once any page does), so an unreleased version's pages
 *    get no fragment. The page's version is the last segment of the renderer's
 *    `config.base` (`<section>/<label>`, set by `openApiRendererConfig`), and its
 *    released flag comes from the `DK_OPENAPI` handoff the build publishes once
 *    at config time — the same handoff the `llms.txt` route reads, and the only
 *    one reachable from a module the renderer loads itself.
 *  - **Sitemap** — {@link openApiSitemapPredicate} is a `sitemapPredicates`
 *    entry, ANDed onto `sitemapDraftFilter` by `composeSitemapPredicates`, so
 *    every URL under an unreleased version's route is dropped.
 *
 * Released versions are untouched on both surfaces, so each released operation
 * stays its own search result and its own sitemap entry (FR-013): the paired
 * control in `openapi-indexing.test.ts` proves both halves on one dist.
 *
 * Arm A: both hooks are pushed from `adapters.ts`, which only reaches this
 * module for a site that renders reference pages, and the hook itself falls back
 * to Starlight's default (indexed) when no versions were published — a site
 * without the `openapi` option builds exactly what it did before.
 */
import { readPublication } from '../integrations/openapi-publish.js';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import { routeOfSlug } from '../vocabulary-core.mjs';

/** One spec version, as these two decisions read it. */
export interface IndexingVersion {
  label: string;
  released: boolean;
}

/** The renderer's `getPageProps` schema argument, as far as the label needs it. */
export interface IndexingSchema {
  config?: { base?: string };
}

/**
 * The version label a rendered page belongs to: the last path segment of the
 * renderer's `config.base` (`<section>/<label>`). `undefined` when the renderer
 * gave no usable base.
 */
function versionLabel(schema: IndexingSchema | undefined): string | undefined {
  const base = schema?.config?.base ?? '';
  return base
    .split('/')
    .filter((segment) => segment !== '')
    .pop();
}

/**
 * Whether a rendered page belongs to a released version. A page whose label is
 * not a configured version stays indexed: Starlight's default is what a site
 * gets without this hook, so only an explicit `released: false` holds a page
 * back.
 */
export function isReleasedPage(
  schema: IndexingSchema | undefined,
  versions: readonly IndexingVersion[],
): boolean {
  const label = versionLabel(schema);
  if (label === undefined) return true;
  return versions.find((version) => version.label === label)?.released !== false;
}

/**
 * The versions the build published: the `DK_OPENAPI` handoff
 * `defineDocKittyIntegrations` sets at config time (`toPublication`), read the
 * way `lib/routes/llms-txt.ts` reads it. Empty when the option is unset or the
 * handoff is malformed, which keeps every page on Starlight's default.
 */
export function publishedVersions(): IndexingVersion[] {
  return readPublication(process.env[DK_OPENAPI_ENV])?.versions ?? [];
}

/**
 * The `pagefind` value for a rendered page's frontmatter — the WP05
 * `pagePropsHooks` entry. `patchPageProps` calls it with the renderer's own
 * `getPageProps` arguments, so the unused `title` keeps the positional shape of
 * the sibling hooks (and of the description splice).
 */
export function openApiPagefind(_title: string, schema?: IndexingSchema): boolean {
  return isReleasedPage(schema, publishedVersions());
}

/**
 * The sitemap predicate that holds an unreleased version's pages back (FR-015).
 * `page` is the absolute URL `@astrojs/sitemap` hands its filter.
 *
 * The URL is matched on its `/<section>/<label>/` chain without stripping the
 * site base: the sitemap emits the base, and that chain is unique in a route (an
 * authored page under it is refused at config time as a route collision), so the
 * chain identifies the version whether the site ships at `/` or under
 * `/doc-kitty/`. A version marked `released: true` contributes no chain, and a
 * site with every version released registers no predicate at all.
 */
export function openApiSitemapPredicate(
  section: string,
  versions: readonly IndexingVersion[],
): (page: string) => boolean {
  const unreleased = versions
    .filter((version) => !version.released)
    .map((version) => routeOfSlug(`${section}/${version.label}/index`));
  return (page: string): boolean => {
    let pathname: string;
    try {
      pathname = new URL(page).pathname;
    } catch {
      // A relative URL (a filter called in a test, not by the sitemap).
      pathname = page;
    }
    const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return !unreleased.some((route) => normalized.includes(route));
  };
}
