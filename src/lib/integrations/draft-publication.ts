/**
 * The draft-publication integration: resolves `DK_PUBLISH_DRAFTS` once per build
 * and publishes the result. Moved out of `config.ts` (#115); `config.ts`
 * re-exports every public symbol.
 */
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { createBuildState, type BuildState } from '../build-state.js';
import { compareCodeUnit } from '../vocabulary-core.mjs';
import {
  DK_PUBLISH_DRAFTS_ENV,
  PUBLISH_DRAFTS_DEFAULT,
  unpublishedDraftPaths,
  resolveDraftPublication,
  activeMode,
  redirectsToDrafts,
} from '../draft-publication.mjs';
import { DK_PUBLISH_DRAFTS_RESOLVED_ENV, setInternalEnv } from '../internal-env.mjs';
import type { RouteShapingOptions } from './route-shaping.js';
import { normalizeBasePrefix, siteDraftRoutes } from './shared.js';

// Astro's static redirect stub (`core/routing/3xx.js`): the same two-part shape
// `check-redirect-coverage.mjs` recognises, so only a real stub is ever removed.
const REDIRECT_STUB_RE = /<title>Redirecting to: [^<]*<\/title>[\s\S]*?<meta http-equiv="refresh"/i;

/**
 * Resolve the draft-publication setting once per build and publish the result
 * (FR-013..FR-018, research R8).
 *
 * The value comes from the process environment, else from the site's env files
 * for the build mode (`--mode <x>` when given, else `development` for `astro dev`
 * and `production` for anything else, so `.env.development` reaches the dev
 * server only), read from Vite's `envDir` when the site sets one, else `on`. An
 * invalid value throws here, which stops the build before anything is emitted.
 * A live deployment sets `off`; a build that leaves the setting unset says in
 * its log line how to turn drafts off.
 *
 * The result goes to two consumers:
 *  - the content loader and carriers, through `process.env` — the same
 *    same-process seam `DK_DOCS_ROOT` uses above — under its own name, so the
 *    user's `DK_PUBLISH_DRAFTS` is never overwritten;
 *  - sidebar shaping, as `unpublishedDirs` on the {@link BuildState} this config's
 *    route-shaping integration reads (the integration never mutates its options): with drafts off, a directory whose
 *    index page is a draft keeps its fallback label without a "missing title"
 *    warning. Every draft slug is passed; the shaping step only looks up the
 *    ones that are directories.
 *
 * Redirects into drafts: with drafts off, a configured redirect whose target is
 * a draft page would be built as a stub that leads to a 404. The integration
 * owns that case, so a site's config needs no mode logic of its own (it is
 * evaluated before Astro reports its command, and could only guess the mode).
 * It warns once, naming each such redirect, and leaves the stub out of the
 * build, so the old URL is an honest 404 until its target is published. Astro
 * has no hook that removes a configured route, so the stub is deleted from the
 * output in `astro:build:done`; the dev server still serves the redirect.
 * `check-redirect-coverage.mjs` reports the same old URLs as unpublished.
 *
 * The draft slugs are read in the hook, not in the factory, because the
 * glossary integration (earlier in the array) writes its pages in its own
 * `astro:config:setup`.
 *
 * @internal An internal seam the toolkit's own tests use; not supported API.
 */
export function draftPublicationIntegration(
  routeShaping: RouteShapingOptions,
  state: BuildState = createBuildState(),
): AstroIntegration {
  const { docsDir, base, indexBasename } = routeShaping;
  let publish: boolean = PUBLISH_DRAFTS_DEFAULT;
  let withheld: Array<{ from: string; route: string }> = [];
  return {
    name: 'doc-kitty:draft-publication',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        const root = config?.root ? fileURLToPath(config.root) : process.cwd();
        const mode = activeMode({ argv: process.argv, command });
        const resolved = resolveDraftPublication(root, mode, process.env, config?.vite?.envDir);
        publish = resolved.publish;
        setInternalEnv(DK_PUBLISH_DRAFTS_RESOLVED_ENV, publish ? 'on' : 'off');
        const drafts = publish ? new Set<string>() : siteDraftRoutes(docsDir, indexBasename);
        state.unpublishedDirs = [...drafts].map((route) => route.slice(1, -1));
        state.unpublishedPaths = unpublishedDraftPaths(
          path.resolve(process.cwd(), docsDir),
          publish,
          indexBasename,
        );
        withheld = redirectsToDrafts(config?.redirects, drafts, base);
        console.log(
          `[dk-drafts] ${DK_PUBLISH_DRAFTS_ENV}=${publish ? 'on' : 'off'} (${resolved.source}): ` +
            (publish
              ? 'draft pages are built, listed and marked noindex.' +
                (resolved.source === 'default' || resolved.source === 'set but empty'
                  ? ` Set ${DK_PUBLISH_DRAFTS_ENV}=off in a live deployment to leave them out.`
                  : '')
              : 'draft pages are not built.'),
        );
        if (withheld.length > 0) {
          console.warn(
            `[dk-drafts] ${withheld.length} redirect(s) lead to a draft page, which is not built ` +
              `while ${DK_PUBLISH_DRAFTS_ENV} is off. They are left out of the build, so these ` +
              `URLs return 404 until the target is published: ` +
              withheld.map(({ from, route }) => `${from} -> ${route}`).join(', '),
          );
        }
      },
      // A site that does not load its docs through `docKittyDocsLoader` is not
      // filtered. Say so once, rather than let "off" look like it worked.
      'astro:build:done': ({ dir, pages }) => {
        if (publish) return;
        // Remove the stub of each redirect withheld above. Both of Astro's
        // output shapes are tried (`a/b/index.html` and `a/b.html`), and only a
        // file that really is a redirect stub is deleted.
        const outDir = path.resolve(fileURLToPath(dir));
        for (const { from } of withheld) {
          const rel = from.replace(/^\/+|\/+$/g, '');
          for (const file of [path.join(outDir, rel, 'index.html'), path.join(outDir, `${rel}.html`)]) {
            if (!existsSync(file) || !REDIRECT_STUB_RE.test(readFileSync(file, 'utf8'))) continue;
            rmSync(file);
            // Drop the directories the stub leaves empty, up to the output root.
            for (let d = path.dirname(file); d !== outDir && d.startsWith(outDir); d = path.dirname(d)) {
              if (readdirSync(d).length > 0) break;
              rmdirSync(d);
            }
          }
        }
        const drafts = siteDraftRoutes(docsDir, indexBasename);
        const basePrefix = normalizeBasePrefix(base);
        const emitted = pages
          .map((page) => `/${page.pathname}`.replace(/\/*$/, '/').replace(/^\/+/, '/'))
          .map((route) =>
            basePrefix && route.startsWith(`${basePrefix}/`) ? route.slice(basePrefix.length) : route,
          )
          .filter((route) => drafts.has(route))
          .sort(compareCodeUnit);
        if (emitted.length === 0) return;
        console.warn(
          `[dk-drafts] ${DK_PUBLISH_DRAFTS_ENV} is off, but ${emitted.length} draft page(s) were ` +
            `built: ${emitted.join(', ')}. Drafts are left out where the docs collection is ` +
            `loaded; use docKittyDocsLoader() in content.config.ts for the setting to take effect.`,
        );
      },
    },
  };
}
