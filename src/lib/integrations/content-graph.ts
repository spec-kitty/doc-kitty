/** The always-on content-graph route integration. Imports nothing from `config.ts`. */
import type { AstroIntegration } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';

/** The virtual module the injected route reads its options from. */
export const CONTENT_GRAPH_MODULE_ID = 'virtual:doc-kitty/content-graph';

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
const CONTENT_GRAPH_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/content-graph-injected';

/**
 * Inject `/api/content-graph.json` (#176, FR-010) on every site, so no adopter adds
 * a page file and `_links.contentGraph` never dangles. Appended unconditionally by
 * `defineDocKittyIntegrations` (no `DocKittyOptions` toggle). `prerender` keeps the
 * route static when a site sets `output: 'server'`.
 */
export function contentGraphIntegration(
  docsDir: string,
  indexBasename: IndexBasenameOption | undefined,
): AstroIntegration {
  return {
    name: 'doc-kitty:content-graph',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        const resolved = `\0${CONTENT_GRAPH_MODULE_ID}`;
        const options = { docsDir, ...(indexBasename !== undefined ? { indexBasename } : {}) };
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:content-graph-options',
                resolveId: (id: string) => (id === CONTENT_GRAPH_MODULE_ID ? resolved : null),
                load: (id: string) =>
                  id === resolved ? `export const contentGraphOptions = ${JSON.stringify(options)};\n` : null,
              },
            ],
          },
        });
        injectRoute({
          pattern: '/api/content-graph.json',
          entrypoint: CONTENT_GRAPH_ENTRYPOINT,
          prerender: true,
        });
      },
    },
  };
}
