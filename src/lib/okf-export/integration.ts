import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { AstroIntegration } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';
import { exportOkfToDisk } from './disk.mjs';

/**
 * Write the OKF bundle to `dist/okf/` (#178, FR-018) on every build. It reads the
 * graph file `doc-kitty:content-graph` already wrote and the docs tree; it never
 * rebuilds relations (C-010). Appended unconditionally by `defineDocKittyIntegrations`,
 * after `sitemapOrderIntegration()`, with no option to turn it off. Drafts are not in
 * the graph, so they are not in the bundle.
 */
export function okfExportIntegration(
  docsDir: string,
  indexBasename: IndexBasenameOption | undefined,
): AstroIntegration {
  let base = '';
  let siteUrl = '';
  return {
    name: 'doc-kitty:okf-export',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base ?? '';
        siteUrl = config.site ?? '';
      },
      'astro:build:done': ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const bundle = exportOkfToDisk({
          graphFile: path.join(distDir, 'api', 'content-graph.json'),
          docsDir,
          outDir: path.join(distDir, 'okf'),
          options: { indexBasename, base, siteUrl },
        });
        logger.info(`wrote ${bundle.size} file(s) to okf/`);
      },
    },
  };
}
