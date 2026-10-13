import { describe, it, expect } from 'vitest';
import { normalizeRootLoc, sortSitemapXml } from '../lib/sitemap-order.js';

// The demonstrator's emitted shape: single line, no inter-tag whitespace, each
// `<url>` carrying only `<loc>`, inside a `<urlset …>` with five xmlns attrs.
const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
  ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"' +
  ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' +
  ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' +
  ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';
const URLSET_CLOSE = '</urlset>';

const url = (loc: string, extra = '') => `<url><loc>${loc}</loc>${extra}</url>`;

describe('sortSitemapXml', () => {
  it('reorders <url> blocks by <loc> code-unit ascending', () => {
    const unsorted =
      PROLOG +
      URLSET_OPEN +
      url('https://x.test/b/') +
      url('https://x.test/a/') +
      url('https://x.test/c/') +
      URLSET_CLOSE;

    const out = sortSitemapXml(unsorted);

    expect(out).toBe(
      PROLOG +
        URLSET_OPEN +
        url('https://x.test/a/') +
        url('https://x.test/b/') +
        url('https://x.test/c/') +
        URLSET_CLOSE,
    );
  });

  it('preserves the prolog, the <urlset …> xmlns attributes, and the closing tag byte-for-byte', () => {
    const unsorted =
      PROLOG + URLSET_OPEN + url('https://x.test/z/') + url('https://x.test/a/') + URLSET_CLOSE;

    const out = sortSitemapXml(unsorted);

    expect(out.startsWith(PROLOG + URLSET_OPEN)).toBe(true);
    expect(out.endsWith(URLSET_CLOSE)).toBe(true);
    // No byte of the frame changed — only the two <url> blocks were reordered.
    expect(out).toBe(
      PROLOG + URLSET_OPEN + url('https://x.test/a/') + url('https://x.test/z/') + URLSET_CLOSE,
    );
  });

  it('is idempotent (sorting an already-sorted sitemap is a no-op)', () => {
    const unsorted =
      PROLOG +
      URLSET_OPEN +
      url('https://x.test/m/') +
      url('https://x.test/k/') +
      url('https://x.test/n/') +
      URLSET_CLOSE;

    const once = sortSitemapXml(unsorted);
    const twice = sortSitemapXml(once);

    expect(twice).toBe(once);
  });

  it('moves whole <url> blocks (extra children ride along with their block)', () => {
    const unsorted =
      PROLOG +
      URLSET_OPEN +
      url('https://x.test/b/', '<lastmod>2026-01-02</lastmod>') +
      url('https://x.test/a/', '<lastmod>2026-01-01</lastmod>') +
      URLSET_CLOSE;

    const out = sortSitemapXml(unsorted);

    expect(out).toBe(
      PROLOG +
        URLSET_OPEN +
        url('https://x.test/a/', '<lastmod>2026-01-01</lastmod>') +
        url('https://x.test/b/', '<lastmod>2026-01-02</lastmod>') +
        URLSET_CLOSE,
    );
    // the lastmod stayed attached to its own <loc>
    expect(out).toContain('<loc>https://x.test/a/</loc><lastmod>2026-01-01</lastmod>');
    expect(out).toContain('<loc>https://x.test/b/</loc><lastmod>2026-01-02</lastmod>');
  });

  it('leaves a sitemap-index (no <url> blocks) untouched', () => {
    const index =
      PROLOG +
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<sitemap><loc>https://x.test/sitemap-0.xml</loc></sitemap>' +
      '</sitemapindex>';

    expect(sortSitemapXml(index)).toBe(index);
  });
});

describe('normalizeRootLoc', () => {
  const wrap = (locs: string[]): string =>
    `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;

  it('gives the root of a based site the slash-less form whichever form the build emitted', () => {
    const withSlash = wrap(['https://example.org/kb/', 'https://example.org/kb/adr/']);
    const without = wrap(['https://example.org/kb', 'https://example.org/kb/adr/']);
    expect(normalizeRootLoc(withSlash, 'https://example.org/kb/')).toBe(without);
    expect(normalizeRootLoc(without, 'https://example.org/kb')).toBe(without);
  });

  it('leaves a site with no base path, and a build with no site URL, untouched', () => {
    const xml = wrap(['https://example.org/', 'https://example.org/adr/']);
    expect(normalizeRootLoc(xml, 'https://example.org/')).toBe(xml);
    expect(normalizeRootLoc(xml, undefined)).toBe(xml);
  });
});
