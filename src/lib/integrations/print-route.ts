/** The print-route integration (ADR-0081, #380). Imports nothing from `config.ts`. */
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { registerSitemapPredicate, unregisterSitemapPredicate } from '../openapi/materialise.mjs';

/** The virtual module the injected route reads its options from. */
export const PRINT_ROUTE_MODULE_ID = 'virtual:doc-kitty/print-route';

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
const PRINT_ROUTE_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/print-injected.astro';

/** The route pattern: `/print/` (whole site) and `/print/<section>/`. */
export const PRINT_ROUTE_PATTERN = '/print/[...name]';

/** The sitemap predicate's key in the shared registry. */
const SITEMAP_KEY = 'print:routes';

/** What the injected route needs that only the config knows. */
export interface PrintRouteOptions {
  siteTitle: string;
  siteDescription: string | undefined;
}

/** One built print document, as `dist/print/manifest.json` lists it (data-model.md). */
export interface PrintManifestDocument {
  name: string;
  route: string;
  title: string;
  lang: string;
  titleLevel: number;
  pages: number;
  /** The printed page titles, in order: the outline entries the PDF gate expects. */
  titles: string[];
}

/**
 * A sitemap predicate that drops every print route. The print documents repeat pages
 * the sitemap already lists, and are `noindex`.
 */
export function printSitemapPredicate(base: string): (page: string) => boolean {
  const prefix = `${base.replace(/\/+$/, '')}/print/`;
  return (page: string): boolean => {
    try {
      return !new URL(page).pathname.startsWith(prefix);
    } catch {
      return true;
    }
  };
}

/** The error text when a docs folder already owns `/print/` (ADR-0050). */
export function printCollisionMessage(docsRoot: string): string | undefined {
  for (const candidate of ['print', 'print.md', 'print.mdx']) {
    if (existsSync(path.join(docsRoot, candidate))) {
      return (
        `[dk-config] the docs tree has "${candidate}", but /print/ is reserved for the print documents ` +
        `(ADR-0081); rename it, or turn the PDFs off`
      );
    }
  }
  return undefined;
}

const ATTR = (name: string) => new RegExp(`${name}="([^"]*)"`);

/** Read a built print page's document record from its root element and `<html lang>`. */
export function readPrintDocument(html: string, route: string): PrintManifestDocument | undefined {
  const root = html.match(/<[^>]*\bdata-dk-print-name="[^"]*"[^>]*>/)?.[0];
  if (!root) return undefined;
  const unescape = (text: string) =>
    text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return {
    name: unescape(root.match(ATTR('data-dk-print-name'))![1]),
    route,
    title: unescape(root.match(ATTR('data-dk-print-title'))?.[1] ?? ''),
    lang: html.match(/<html[^>]*\blang="([^"]+)"/)?.[1] ?? 'en',
    titleLevel: Number(root.match(ATTR('data-dk-print-title-level'))?.[1] ?? 2),
    pages: Number(root.match(ATTR('data-dk-print-pages'))?.[1] ?? 0),
    titles: JSON.parse(unescape(root.match(ATTR('data-dk-print-titles'))?.[1] ?? '[]')),
  };
}

/**
 * The print-route integration, as a list: empty on a site without print documents, so
 * that site's integration list is unchanged. With documents, it injects `/print/[...name]`. The route renders
 * the documents `pdfOptions()` lists; this integration hides them from the sitemap,
 * refuses a docs folder that would own `/print/`, and writes `dist/print/manifest.json`
 * after the build for the PDF command. Registered only when a document exists, so a
 * site without PDFs is unchanged.
 */
export function printRouteIntegrations(
  options: PrintRouteOptions & { base: string; docsRoot: string; enabled: boolean },
): AstroIntegration[] {
  if (!options.enabled) {
    // A config evaluated earlier in this process may have registered the predicate.
    unregisterSitemapPredicate(SITEMAP_KEY);
    return [];
  }
  const collision = printCollisionMessage(options.docsRoot);
  if (collision) throw new Error(collision);
  registerSitemapPredicate(SITEMAP_KEY, printSitemapPredicate(options.base));
  const resolved = `\0${PRINT_ROUTE_MODULE_ID}`;
  const payload: PrintRouteOptions = { siteTitle: options.siteTitle, siteDescription: options.siteDescription };
  return [{
    name: 'doc-kitty:print-route',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig, logger }) => {
        // A print document rewrites every link to an absolute site URL, and a PDF has no
        // other way to point at the site. Without `site` the links would carry the local
        // print server's address, so no print route is built (as with the per-page Atom
        // route); the print gate then reports the missing documents.
        if (!config?.site) {
          logger?.warn('No print documents: set `site` in astro.config, because print documents link to absolute site URLs. The PDFs are off.');
          return;
        }
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:print-route-options',
                resolveId: (id: string) => (id === PRINT_ROUTE_MODULE_ID ? resolved : null),
                load: (id: string) => (id === resolved ? `export const printRouteOptions = ${JSON.stringify(payload)};\n` : null),
              },
            ],
          },
        });
        injectRoute({ pattern: PRINT_ROUTE_PATTERN, entrypoint: PRINT_ROUTE_ENTRYPOINT, prerender: true });
      },
      'astro:build:done': async ({ dir }) => {
        const printDir = path.join(fileURLToPath(dir), 'print');
        if (!existsSync(printDir)) return;
        const base = options.base.replace(/\/+$/, '');
        const documents: PrintManifestDocument[] = [];
        const candidates = [
          ['', path.join(printDir, 'index.html')],
          ...(await readdir(printDir, { withFileTypes: true }))
            .filter((d) => d.isDirectory())
            .map((d) => [`${d.name}/`, path.join(printDir, d.name, 'index.html')]),
        ];
        for (const [sub, file] of candidates) {
          if (!existsSync(file)) continue;
          const doc = readPrintDocument(await readFile(file, 'utf8'), `${base}/print/${sub}`);
          if (doc) documents.push(doc);
        }
        documents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        await writeFile(path.join(printDir, 'manifest.json'), `${JSON.stringify({ version: 1, documents }, null, 2)}\n`);
      },
    },
  }];
}
