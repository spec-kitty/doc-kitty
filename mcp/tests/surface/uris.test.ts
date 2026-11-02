/**
 * uris.ts (T012): the canonical site-slug rule, launch-mode derivation
 * (fs mode mints from the index-declared origin, never the local dir), and
 * the page/section URI minting functions - pure, unit-level.
 */
import { describe, expect, it } from 'vitest';
import type { LaunchConfiguration } from '../../src/cli.js';
import type { CorpusSnapshot, SnapshotPage } from '../../src/corpus/snapshot.js';
import { siteSlugFor } from '../../src/corpus/snapshot.js';
import { corpusSiteSlug, pageUri, sectionUri, siteSlug } from '../../src/surface/uris.js';
import { loadFsCorpus, surfaceFixture } from './helpers.js';

function fsConfig(dir: string): LaunchConfiguration {
  return { source: { kind: 'fs', dir }, resourceListingThreshold: 1000, siteSlug: siteSlugFor(dir) };
}

/** Minimal page-shaped carrier for negative-path tests (only id/ref are read on the derivation path). */
function pageWithRef(id: string, ref: string): SnapshotPage {
  return { id, ref } as unknown as SnapshotPage;
}

function snapshotWithPages(pages: SnapshotPage[]): CorpusSnapshot {
  return {
    siteTitle: 'Synthetic',
    baseUrl: '/tmp/synthetic',
    contractVersion: '3',
    sections: [],
    pages,
    pagesGated: false,
    loadedAt: '2026-11-01T00:00:00.000Z',
  };
}

describe('siteSlug (canonical rule)', () => {
  it('lowercases, drops scheme and trailing slash, collapses non-alphanumerics', () => {
    expect(siteSlug('HTTPS://Spec-Kitty.GitHub.IO/doc-kitty/')).toBe('spec-kitty-github-io-doc-kitty');
  });

  it('collapses ports and punctuation into the same alphabet', () => {
    expect(siteSlug('https://example.com:8443/docs/')).toBe('example-com-8443-docs');
  });

  it('is the same function the corpus loader uses (one rule, one definition)', () => {
    expect(siteSlug).toBe(siteSlugFor);
  });
});

describe('corpusSiteSlug (launch-mode derivation)', () => {
  it('https mode slugs the launch base verbatim', () => {
    const snapshot = snapshotWithPages([pageWithRef('home', 'https://docs.example.com/x/api/pages/home.json')]);
    const config: LaunchConfiguration = {
      source: { kind: 'https', url: 'HTTPS://Docs.Example.COM/surface/' },
      resourceListingThreshold: 1000,
      siteSlug: siteSlugFor('https://docs.example.com/surface/'),
    };
    expect(corpusSiteSlug(snapshot, config)).toBe('docs-example-com-surface');
  });

  it('fs mode derives from the index-declared origin, never the local dir', async () => {
    const { snapshot, config } = await loadFsCorpus('surface');
    expect(corpusSiteSlug(snapshot, config)).toBe('docs-example-com-surface');
    // The local directory would mint something else entirely - that is exactly what must not leak.
    expect(corpusSiteSlug(snapshot, config)).not.toBe(config.siteSlug);
  });

  it('fs mode follows an explicit --link-base (content names the override origin)', async () => {
    const { snapshot, config } = await loadFsCorpus('surface', { linkBase: 'http://localhost:4321/mirror' });
    expect(corpusSiteSlug(snapshot, config)).toBe('localhost-4321-mirror');
  });

  it('fs mode on a pageless (fully gated) corpus refuses instead of slugging the dir', () => {
    const gated = { ...snapshotWithPages([]), pagesGated: true };
    try {
      corpusSiteSlug(gated, fsConfig('/tmp/nowhere'));
      expect.unreachable();
    } catch (error) {
      expect((error as { code: string }).code).toBe('MALFORMED_CORPUS');
      expect((error as Error).message).toContain('never mint docs:// identities from a local directory path');
      expect((error as Error).message).not.toContain('/tmp/nowhere'); // client-facing: no local path
    }
  });

  it('fs mode on a ref outside the pinned <base>/api/pages/<id>.json shape is a named corpus violation', () => {
    const odd = snapshotWithPages([pageWithRef('home', 'https://docs.example.com/elsewhere/home.json')]);
    expect(() => corpusSiteSlug(odd, fsConfig('/tmp/anywhere'))).toThrowError(/api\/index\.json: _links\.self\.href 'https:\/\/docs\.example\.com\/elsewhere\/home\.json' does not decompose/);
  });

  it('two servers over the same site mint the same slug whether launched https or fs', async () => {
    const { snapshot, config } = await loadFsCorpus('surface');
    const viaFs = corpusSiteSlug(snapshot, config);
    const viaHttpsConfig: LaunchConfiguration = {
      source: { kind: 'https', url: 'https://docs.example.com/surface' },
      resourceListingThreshold: 1000,
      siteSlug: siteSlugFor('https://docs.example.com/surface'),
    };
    expect(corpusSiteSlug(snapshot, viaHttpsConfig)).toBe(viaFs);
  });
});

describe('pageUri / sectionUri', () => {
  it('mints the contract-pinned shapes', () => {
    expect(pageUri('docs-example-com-surface', 'guides/alpha')).toBe('docs://docs-example-com-surface/pages/guides/alpha');
    expect(sectionUri('docs-example-com-surface', 'guides')).toBe('docs://docs-example-com-surface/sections/guides');
  });

  it('keeps the home page id and the empty root-section id verbatim', () => {
    expect(pageUri('s', 'home')).toBe('docs://s/pages/home');
    expect(sectionUri('s', '')).toBe('docs://s/sections/');
  });
});

describe('docs:// identities on the wire (smoke)', () => {
  it('surface fixture lives under the declared origin (fixture sanity)', () => {
    expect(surfaceFixture('surface')).toContain('tests/surface/fixtures/surface');
  });
});
