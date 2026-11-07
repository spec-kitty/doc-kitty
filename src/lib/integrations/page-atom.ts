/** The per-page Atom route integration (FR-020). Imports nothing from `config.ts`. */
import type { AstroIntegration } from 'astro';

/** The virtual module the injected route reads its options from. */
export const PAGE_ATOM_MODULE_ID = 'virtual:doc-kitty/page-atom';

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
const PAGE_ATOM_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/page-atom-injected';

/**
 * Inject `/api/pages/[...slug].atom.xml` on every site that sets `site`, unless `pageFormats.atom` is
 * false (`defineDocKittyIntegrations` decides). `prerender` keeps it static under
 * `output: 'server'`. Registered before served-surface detection, which reads routes.
 */
export function pageAtomIntegration(siteTitle: string): AstroIntegration {
  return {
    name: 'doc-kitty:page-atom',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig, logger }) => {
        // An Atom `id` must be a stable absolute IRI, and without `site` the only
        // absolute URL is a localhost one, which is false. So: no entries, no links.
        if (!config?.site) {
          logger.warn('No Atom entries: set `site` in astro.config so entry ids are absolute. Per-page Atom is off.');
          return;
        }
        const resolved = `\0${PAGE_ATOM_MODULE_ID}`;
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:page-atom-options',
                resolveId: (id: string) => (id === PAGE_ATOM_MODULE_ID ? resolved : null),
                load: (id: string) =>
                  id === resolved ? `export const pageAtomOptions = ${JSON.stringify({ siteTitle })};\n` : null,
              },
            ],
          },
        });
        injectRoute({ pattern: '/api/pages/[...slug].atom.xml', entrypoint: PAGE_ATOM_ENTRYPOINT, prerender: true });
      },
    },
  };
}
