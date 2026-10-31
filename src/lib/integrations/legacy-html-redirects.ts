/**
 * The legacy `.html` redirects integration (issue #249, ADR-0068).
 *
 * - `astro:config:setup`: validates `legacyHtmlRedirects` and refuses Astro
 *   `redirects` keys ending in `.html` (Astro writes them as a folder, and a
 *   `/x/index.html` key replaces the live page `/x/`).
 * - `astro:server:setup`: `astro dev` answers each legacy URL with a 302 to its
 *   target, so the map can be tried before a build.
 * - `astro:build:done`: writes each legacy redirect as a flat stub file at
 *   `<dist>/<source>` (see `legacy-html-redirects.mjs`). This runs after every
 *   page, the sitemap and the `llms.txt` / agent-API routes have been
 *   generated, so the stubs are in none of them.
 *
 * With `DK_PUBLISH_DRAFTS` off, an entry whose target is a draft page is left
 * out, like a directory redirect into a draft (FR-015): the old URL returns 404
 * until its target is published, and the build log names it.
 *
 * Always on; with no map and no `.html` keys it does nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';
import {
  flattenLegacyChains,
  normalizeLegacyHtmlRedirects,
  refuseAstroHtmlRedirects,
  writeLegacyHtmlStubs,
} from '../legacy-html-redirects.mjs';
import { publishDraftsInForce, routeOfTarget } from '../draft-publication.mjs';
import { normalizeBasePrefix, siteDraftRoutes } from './shared.js';

/** Old `.html` URL -> new URL, both without the site base. */
export type LegacyHtmlRedirects = Record<string, string>;

/** @internal An internal seam the toolkit's own tests use; not supported API. */
export function legacyHtmlRedirectsIntegration(
  map: LegacyHtmlRedirects | undefined,
  docsDir: string,
  indexBasename?: IndexBasenameOption,
): AstroIntegration {
  // Validated eagerly, so a bad map fails at config time, before any hook.
  const entries = flattenLegacyChains(normalizeLegacyHtmlRedirects(map));
  let base = '/';
  let site: string | undefined;
  return {
    name: 'doc-kitty:legacy-html-redirects',
    hooks: {
      'astro:config:setup': ({ config }) => {
        refuseAstroHtmlRedirects(config?.redirects as Record<string, unknown> | undefined);
      },
      'astro:config:done': ({ config }) => {
        base = config.base ?? '/';
        site = config.site;
      },
      'astro:server:setup': ({ server }) => {
        if (entries.length === 0) return;
        const prefix = normalizeBasePrefix(base);
        const byFrom = new Map(entries.map((e) => [e.from, e.to]));
        server.middlewares.use((req, res, next) => {
          const pathname = decodeURIComponent((req.url ?? '').replace(/[?#].*$/, ''));
          const route = prefix && pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
          const to = byFrom.get(route);
          if (to === undefined) return next();
          res.statusCode = 302;
          res.setHeader('Location', /^([a-z][a-z0-9+.-]*:)?\/\//i.test(to) ? to : `${prefix}${to}`);
          res.end();
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        if (entries.length === 0) return;
        let publish = entries;
        if (!publishDraftsInForce()) {
          const drafts = siteDraftRoutes(docsDir, indexBasename);
          const withheld = entries.filter((e) => {
            const route = routeOfTarget(e.to);
            return route !== null && drafts.has(route);
          });
          if (withheld.length > 0) {
            logger.warn(
              `${withheld.length} legacy .html redirect(s) lead to a draft page, which is not built while ` +
                `DK_PUBLISH_DRAFTS is off; they are left out, so these URLs return 404 until the target is ` +
                `published: ${withheld.map((e) => `${e.from} -> ${e.to}`).join(', ')}`,
            );
            publish = entries.filter((e) => !withheld.includes(e));
          }
        }
        const outDir = path.resolve(fileURLToPath(dir));
        const { written, servedByPage } = writeLegacyHtmlStubs(outDir, publish, { base, site });
        logger.info(
          `wrote ${written.length} legacy .html redirect stub(s)` +
            (servedByPage.length > 0 ? `; ${servedByPage.length} index.html URL(s) are served by their own page` : ''),
        );
      },
    },
  };
}
