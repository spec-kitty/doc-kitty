/**
 * The `doc-kitty:tom-annex` integration (#401): it serves the evidence index
 * at `/api/tom-annex.json`, but only on a site with a published classified page
 * (ADR-0080). A site with no classified pages gains no route, no `_links` entry
 * and no failure (FR-012). Evidence index, not the contractual annex.
 *
 * The decision is made at `astro:config:setup`, from a build-free frontmatter
 * scan with the site's own walk and draft rule (`tom-annex/scan.mjs`): a
 * prerendered static endpoint cannot be skipped at render time. The served-
 * surfaces detection sees the injected route, so `api/index.json` links it
 * exactly when it is served.
 */
import path from 'node:path';
import process from 'node:process';
import type { AstroIntegration } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';
import { hasPublishedClassifiedPages } from '../tom-annex/scan.mjs';

export const TOM_ANNEX_MODULE_ID = 'virtual:doc-kitty/tom-annex';

const TOM_ANNEX_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/tom-annex-injected';

export function tomAnnexIntegration(docsDir: string, indexBasename: IndexBasenameOption | undefined): AstroIntegration {
  return {
    name: 'doc-kitty:tom-annex',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        const docsRoot = path.resolve(process.cwd(), docsDir);
        if (!hasPublishedClassifiedPages(docsRoot, indexBasename)) return;
        const resolved = `\0${TOM_ANNEX_MODULE_ID}`;
        const options = { docsDir, ...(indexBasename !== undefined ? { indexBasename } : {}) };
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:tom-annex-options',
                resolveId: (id: string) => (id === TOM_ANNEX_MODULE_ID ? resolved : null),
                load: (id: string) =>
                  id === resolved ? `export const tomAnnexOptions = ${JSON.stringify(options)};\n` : null,
              },
            ],
          },
        });
        injectRoute({ pattern: '/api/tom-annex.json', entrypoint: TOM_ANNEX_ENTRYPOINT, prerender: true });
      },
    },
  };
}
