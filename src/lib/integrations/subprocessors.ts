/**
 * `doc-kitty:subprocessors` (ADR-0086 decision 4): the optional sub-processor
 * catalog, `<docsDir>/_meta/subprocessors.yaml`.
 *
 * At `astro:config:setup` it reads the file once through
 * `checkSubprocessorCatalog`, the entry point the build-free `validate-catalog.mjs`
 * gate shares, so both report the same problems in the same words.
 *
 * - **No file:** it calls no hook at all. A site without a catalog builds exactly
 *   as before.
 * - **Invalid file:** it throws ONE error listing every problem, before any page
 *   renders. That holds even when the site mounts both routes itself.
 * - **Valid file:** it hands the resolved records, the dated changes and the
 *   site title to the injected routes through a virtual module, then injects the
 *   prerendered `/api/subprocessors.json` and `/subprocessors.xml`.
 *   Served-surface detection then sees them, and the agent index links them.
 * - **Site-owned routes:** a site that mounts its own route at either path keeps
 *   it, and only the other is injected, as for the scenario index.
 *
 * Always registered, with no option: the file is the switch. A catalog created
 * while `astro dev` runs is picked up on the next restart, the same documented
 * limit as Gherkin sources; edits to an existing one restart the server.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { SUBPROCESSORS_REGISTRY_RELPATH, checkSubprocessorCatalog } from '../subprocessors-loader.mjs';
import { SUBPROCESSORS_TAG } from '../subprocessors-core.mjs';
import { ENDPOINT_EXTENSIONS } from './gherkin.js';

/** The virtual module the injected routes read their data from. */
export const SUBPROCESSORS_MODULE_ID = 'virtual:doc-kitty/subprocessors';

/** The injected routes' entrypoints, package exports so a consuming site resolves them. */
export const SUBPROCESSORS_API_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/subprocessors-api-injected';
export const SUBPROCESSORS_FEED_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/subprocessors-feed-injected';

/** Each injected route, and the site files that, when present, replace it. */
const ROUTES = [
  { pattern: '/api/subprocessors.json', entrypoint: SUBPROCESSORS_API_ENTRYPOINT, own: ['api/subprocessors.json'] },
  { pattern: '/subprocessors.xml', entrypoint: SUBPROCESSORS_FEED_ENTRYPOINT, own: ['subprocessors.xml'] },
] as const;

/**
 * The site's own endpoint for a route, as a project-root-relative POSIX path, or
 * `undefined` when it mounts none.
 */
function ownEndpoint(srcDir: string, root: string, route: string): string | undefined {
  const pages = path.join(srcDir, 'pages', ...route.split('/'));
  for (const ext of ENDPOINT_EXTENSIONS) {
    for (const candidate of [`${pages}.${ext}`, path.join(pages, `index.${ext}`)]) {
      if (existsSync(candidate)) return path.relative(root, candidate).split(path.sep).join('/');
    }
  }
  return undefined;
}

export function subprocessorsIntegration(docsDir: string, siteTitle: string): AstroIntegration {
  return {
    name: 'doc-kitty:subprocessors',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig, addWatchFile, logger }) => {
        const root = config?.root ? fileURLToPath(config.root) : process.cwd();
        const srcDir = config?.srcDir ? fileURLToPath(config.srcDir) : path.join(root, 'src');
        const docsRoot = path.resolve(root, docsDir);
        const file = path.join(docsRoot, SUBPROCESSORS_REGISTRY_RELPATH);
        const label = path.relative(root, file).split(path.sep).join('/');

        const catalog = checkSubprocessorCatalog(docsRoot, label);
        if (!catalog.present) return;
        addWatchFile(file);
        if (catalog.problems.length > 0) {
          throw new Error([`${SUBPROCESSORS_TAG} invalid sub-processor catalog:`, ...catalog.problems].join('\n'));
        }

        const data = { records: catalog.normalised, changes: catalog.changes, siteTitle };
        const resolved = `\0${SUBPROCESSORS_MODULE_ID}`;
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:subprocessors-data',
                resolveId: (id: string) => (id === SUBPROCESSORS_MODULE_ID ? resolved : null),
                load: (id: string) =>
                  id === resolved ? `export const subprocessorsData = ${JSON.stringify(data)};\n` : null,
              },
            ],
          },
        });

        for (const route of ROUTES) {
          const own = route.own.map((r) => ownEndpoint(srcDir, root, r)).find(Boolean);
          if (own) {
            logger.info(`${SUBPROCESSORS_TAG} ${own} is mounted by the site: not injecting ${route.pattern}`);
            continue;
          }
          // `prerender`: the data is read at build, so the route stays static even
          // when the site sets `output: 'server'`.
          injectRoute({ pattern: route.pattern, entrypoint: route.entrypoint, prerender: true });
        }
        logger.info(`${SUBPROCESSORS_TAG} ${catalog.records.length} sub-processor record(s) from ${label}`);
      },
    },
  };
}
