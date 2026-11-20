/** The print-route integration (ADR-0081, #380): injection, sitemap, collisions, manifest records. */
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PRINT_ROUTE_PATTERN,
  printCollisionMessage,
  printRouteIntegrations,
  printSitemapPredicate,
  readPrintDocument,
} from '../lib/integrations/print-route.js';
import { composeSitemapPredicates } from '../lib/openapi/materialise.mjs';

const docsRoot = () => mkdtempSync(path.join(tmpdir(), 'dk-print-route-'));
const base = { siteTitle: 'Site', siteDescription: undefined, base: '/doc-kitty' };

describe('printRouteIntegration', () => {
  it('injects the route and hides it from the sitemap when a document exists', () => {
    const routes: Array<{ pattern: string; entrypoint: string; prerender?: boolean }> = [];
    const [integration] = printRouteIntegrations({ ...base, docsRoot: docsRoot(), enabled: true });
    integration.hooks['astro:config:setup']!({
      config: { site: 'https://x.org' },
      injectRoute: (r: (typeof routes)[number]) => routes.push(r),
      updateConfig: () => {},
    } as never);
    expect(routes).toEqual([
      { pattern: PRINT_ROUTE_PATTERN, entrypoint: '@spec-kitty/doc-toolkit/routes/print-injected', prerender: true },
    ]);
    const filter = composeSitemapPredicates(() => true);
    expect(filter('https://x.org/doc-kitty/print/architecture/')).toBe(false);
    expect(filter('https://x.org/doc-kitty/guides/print/')).toBe(true);
  });

  it('builds no print route, and says why, on a site without `site`', () => {
    const [integration] = printRouteIntegrations({ ...base, docsRoot: docsRoot(), enabled: true });
    const injected: unknown[] = [];
    const warnings: string[] = [];
    integration.hooks['astro:config:setup']!({
      config: {},
      injectRoute: (r: unknown) => injected.push(r),
      updateConfig: () => {},
      logger: { warn: (m: string) => warnings.push(m) },
    } as never);
    expect(injected).toEqual([]);
    expect(warnings[0]).toMatch(/set `site`/);
  });

  it('adds nothing, and drops its sitemap predicate, on a site without PDFs', () => {
    printRouteIntegrations({ ...base, docsRoot: docsRoot(), enabled: true });
    expect(printRouteIntegrations({ ...base, docsRoot: docsRoot(), enabled: false })).toEqual([]);
    expect(composeSitemapPredicates(() => true)('https://x.org/doc-kitty/print/architecture/')).toBe(true);
  });

  it('refuses a docs tree that owns /print/', () => {
    const root = docsRoot();
    expect(printCollisionMessage(root)).toBeUndefined();
    mkdirSync(path.join(root, 'Print'));
    expect(printCollisionMessage(root), 'slugs are lower case').toMatch(/"Print".*\/print\/ is reserved/);
    expect(() => printRouteIntegrations({ ...base, docsRoot: root, enabled: true })).toThrow(/reserved/);
    // A site without PDFs keeps its folder.
    expect(() => printRouteIntegrations({ ...base, docsRoot: root, enabled: false })).not.toThrow();
  });
});

describe('printSitemapPredicate', () => {
  it('drops only the print routes under the base', () => {
    const keep = printSitemapPredicate('/doc-kitty/');
    expect(keep('https://x.org/doc-kitty/print/')).toBe(false);
    expect(keep('https://x.org/doc-kitty/printing/')).toBe(true);
    expect(keep('not a url')).toBe(true);
  });
});

describe('readPrintDocument', () => {
  it('reads the document record from the built page', () => {
    const html =
      '<html lang="nl"><body><div class="dk-print-document" data-dk-print-name="site" data-dk-print-title="A &amp; B" ' +
      'data-dk-print-pages="12" data-dk-print-title-level="3" data-dk-print-titles="[&quot;One&quot;]"></div></body></html>';
    expect(readPrintDocument(html, '/doc-kitty/print/')).toEqual({
      name: 'site',
      route: '/doc-kitty/print/',
      title: 'A & B',
      lang: 'nl',
      titleLevel: 3,
      pages: 12,
      titles: ['One'],
    });
    expect(readPrintDocument('<html></html>', '/x/')).toBeUndefined();
  });
});
