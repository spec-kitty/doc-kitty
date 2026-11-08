/**
 * Unit tests for the shared dist link-check primitives (#285; pre-PR review
 * fold F3).
 *
 * `src/scripts/assert-no-broken-links.mjs` (the site-wide built-output gate)
 * and `src/lib/integrations/openapi-link-check.ts` (the OpenAPI section gate)
 * each carried their own copy of the same machinery: HTML walk, `<a href>`
 * extraction with entity decoding, base stripping, and route-to-dist-file
 * resolution. This module pins the ONE shared copy both gates now use
 * (`src/lib/link-check-shared.mjs`) so the two gates cannot drift apart
 * again: every primitive is tested once, here, at the intersection of both
 * gates' needs — the superset href regex (quoted and unquoted), the fuller
 * entity decoder (numeric, hex and named), the missing-dir-tolerant sorted
 * walk, the prefix-generic page route, the null-signalling base strip, and
 * the directory-route-aware dist candidates.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  SCHEME_RE,
  decodeEntities,
  extractHrefs,
  walkHtmlFiles,
  pageRouteFor,
  stripBase,
  distCandidatesFor,
  distFileExists,
} from '../lib/link-check-shared.mjs';

describe('SCHEME_RE', () => {
  it('classifies every scheme href both gates treat as non-relative', () => {
    for (const href of ['http:', 'https:', 'mailto:', 'tel:', 'javascript:', 'data:']) {
      expect(SCHEME_RE.test(href)).toBe(true);
    }
    expect(SCHEME_RE.test('/root-relative')).toBe(false);
    expect(SCHEME_RE.test('./relative')).toBe(false);
    expect(SCHEME_RE.test('#anchor')).toBe(false);
  });
});

describe('decodeEntities', () => {
  it('decodes the numeric, hex and named entities a browser decodes before classifying a URL', () => {
    expect(decodeEntities('a&b')).toBe('a&b');
    expect(decodeEntities('&#65;')).toBe('A');
    expect(decodeEntities('&#x3a;')).toBe(':');
    expect(decodeEntities('java&#x09;script:alert(2)')).toBe('java\tscript:alert(2)');
    expect(decodeEntities('a&#x0A;b')).toBe('a\nb');
  });

  it('leaves unknown entities and bare ampersands untouched', () => {
    expect(decodeEntities('&nbsp;')).toBe('&nbsp;');
    expect(decodeEntities('a&b')).toBe('a&b');
    expect(decodeEntities('plain')).toBe('plain');
  });
});

describe('extractHrefs', () => {
  it('extracts quoted hrefs in document order, entity-decoded', () => {
    const html = `<p><a href="/one/">one</a> <a href='two.md'>two</a></p>`;
    expect(extractHrefs(html)).toEqual(['/one/', 'two.md']);
  });

  it('extracts unquoted href values too (the OpenAPI gate needs them)', () => {
    const html = `<main><a href=/reference/api/>API</a></main>`;
    expect(extractHrefs(html)).toEqual(['/reference/api/']);
  });

  it('decodes entities inside the extracted value, so an encoded scheme is visible to the caller', () => {
    const html = `<a href="java&#x09;script:alert(2)">x</a>`;
    expect(extractHrefs(html)).toEqual(['java\tscript:alert(2)']);
  });

  it('returns an empty list for HTML without anchors', () => {
    expect(extractHrefs('<p>no links</p>')).toEqual([]);
  });
});

describe('walkHtmlFiles', () => {
  it('collects every .html file below dir as sorted POSIX paths relative to it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-link-shared-'));
    try {
      mkdirSync(path.join(dir, 'b', 'deep'), { recursive: true });
      writeFileSync(path.join(dir, 'b', 'deep', 'page.html'), '<html></html>');
      writeFileSync(path.join(dir, 'b', 'index.html'), '<html></html>');
      writeFileSync(path.join(dir, 'root.html'), '<html></html>');
      writeFileSync(path.join(dir, 'ignored.txt'), 'not html');
      expect(walkHtmlFiles(dir)).toEqual(['b/deep/page.html', 'b/index.html', 'root.html']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tolerates a missing directory with an empty list (the OpenAPI gate relies on this)', () => {
    expect(walkHtmlFiles(path.join(tmpdir(), 'dk-never-created-dir'))).toEqual([]);
  });
});

describe('pageRouteFor', () => {
  it('derives a based site route with the trailing-slash directory shape', () => {
    expect(pageRouteFor('index.html', '/doc-kitty')).toBe('/doc-kitty/');
    expect(pageRouteFor('architecture/overview/index.html', '/doc-kitty')).toBe('/doc-kitty/architecture/overview/');
    expect(pageRouteFor('404.html', '/doc-kitty')).toBe('/doc-kitty/404');
  });

  it('derives a base-less section route when the prefix is empty (the OpenAPI gate shape)', () => {
    expect(pageRouteFor('reference/api/index.html', '')).toBe('/reference/api/');
    expect(pageRouteFor('reference/api/v1/operations/listparcels/index.html', '')).toBe(
      '/reference/api/v1/operations/listparcels/',
    );
  });
});

describe('stripBase', () => {
  it('strips a carried base and signals a base-less path with null (not undefined)', () => {
    expect(stripBase('/doc-kitty/architecture/overview/', '/doc-kitty')).toBe('/architecture/overview/');
    expect(stripBase('/doc-kitty', '/doc-kitty')).toBe('/');
    expect(stripBase('/architecture/overview/', '/doc-kitty')).toBeNull();
  });

  it('is a no-op without a configured base', () => {
    expect(stripBase('/architecture/overview/', '')).toBe('/architecture/overview/');
  });
});

describe('distCandidatesFor', () => {
  it('maps a directory route to its index.html and a file route to itself first', () => {
    expect(distCandidatesFor('/architecture/overview/')).toEqual(['architecture/overview/index.html']);
    expect(distCandidatesFor('/')).toEqual(['index.html']);
    expect(distCandidatesFor('/rss.xml')).toEqual(['rss.xml', 'rss.xml/index.html']);
  });
});

describe('distFileExists', () => {
  it('resolves a directory route and a literal file, and rejects a missing route', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-link-shared-'));
    try {
      mkdirSync(path.join(dir, 'reference', 'api'), { recursive: true });
      writeFileSync(path.join(dir, 'reference', 'api', 'index.html'), '<html></html>');
      writeFileSync(path.join(dir, 'openapi.json'), '{}');
      expect(distFileExists(dir, '/reference/api/')).toBe(true);
      expect(distFileExists(dir, '/openapi.json')).toBe(true);
      expect(distFileExists(dir, '/never/built/')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
