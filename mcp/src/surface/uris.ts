/**
 * docs:// URI minting (T012; scheme pinned in contracts/mcp-surface.md):
 *
 *   docs://<site-slug>/pages/<pageId>       one page artifact
 *   docs://<site-slug>/sections/<sectionId> one section metadata document
 *
 * <site-slug> follows the ONE canonical rule so two servers over the same
 * site mint identical identities: lowercase the launch base, drop scheme and
 * trailing slash, collapse non-alphanumerics to '-'. The rule's single
 * definition lives with the corpus loader (`siteSlugFor` in
 * corpus/snapshot.ts); this module re-exports it under the surface name and
 * adds the launch-mode-aware corpus derivation:
 *
 *   - https mode: the slug of the launch base (the site URL).
 *   - fs mode: the slug of the site's DECLARED origin - recovered from the
 *     snapshot's page artifact refs, which the fs adapter re-origines to the
 *     index-declared base by default (FR-007) - NEVER from the local
 *     directory path. With an explicit --link-base the refs carry the
 *     rewrite target, and identity follows it (the served content names that
 *     base).
 *
 * Tools mint `uri` through this module UNCONDITIONALLY - the contract
 * requires the field with or without the resources surface (WP04).
 */
import type { LaunchConfiguration } from '../cli.js';
import { siteSlugFor } from '../corpus/snapshot.js';
import type { CorpusSnapshot } from '../corpus/snapshot.js';
import { MalformedCorpusError } from '../errors.js';

/** The URI scheme pinned by the contract. */
const DOCS_URI_SCHEME = 'docs';

/** The canonical site-slug rule (single definition: the corpus loader's). */
export const siteSlug: (launchBase: string) => string = siteSlugFor;

/**
 * The launch-mode-aware slug of the loaded corpus. Throws MALFORMED_CORPUS
 * only when a caller requests an identity an fs corpus cannot support: a
 * pageless (fully pages-gated) filesystem snapshot has no refs to derive
 * from. That state never reaches here from the tools - a pageless snapshot
 * has no pages to mint URIs for - so the throw is the load-bearing refusal,
 * not a silent fallback to the local directory.
 */
export function corpusSiteSlug(snapshot: CorpusSnapshot, config: LaunchConfiguration): string {
  if (config.source.kind === 'https') {
    return siteSlug(config.source.url);
  }
  const base = declaredBaseFromSnapshot(snapshot);
  if (base === undefined) {
    throw new MalformedCorpusError(
      'launch config: site slug - cannot derive the index-declared origin of a pageless filesystem corpus ' +
        `(source dir '${config.source.dir}'); never mint docs:// identities from a local directory path`,
    );
  }
  return siteSlug(base);
}

/**
 * Recover the declared (or FR-007 re-origined) site base from a snapshot
 * page's artifact ref: every ref is the pinned `<base>/api/pages/<id>.json`.
 * A ref that does not decompose on that pinned shape is a corpus violation,
 * named with the index path where the ref was read.
 */
function declaredBaseFromSnapshot(snapshot: CorpusSnapshot): string | undefined {
  const first = snapshot.pages[0];
  if (first === undefined) return undefined;
  const suffix = `/api/pages/${first.id}.json`;
  if (!first.ref.endsWith(suffix)) {
    throw new MalformedCorpusError(
      `api/index.json: _links.self.href '${first.ref}' does not decompose as '<base>${suffix}' - page refs are the pinned identity`,
    );
  }
  return first.ref.slice(0, -suffix.length);
}

/** `docs://<slug>/pages/<pageId>` - pure; the home page id is 'home'. */
export function pageUri(slug: string, pageId: string): string {
  return `${DOCS_URI_SCHEME}://${slug}/pages/${pageId}`;
}

/**
 * `docs://<slug>/sections/<sectionId>` - pure. The site-root section carries
 * the well-known empty id (snapshot resolveSections); its URI ends with a
 * bare trailing slash segment by construction, never special-cased.
 */
export function sectionUri(slug: string, sectionId: string): string {
  return `${DOCS_URI_SCHEME}://${slug}/sections/${sectionId}`;
}
