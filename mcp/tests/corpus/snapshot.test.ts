/**
 * Snapshot loader semantics (T010): handshake, buildId compare-all, gating
 * detection, sections tolerance, and the pinned page identity/projection.
 * Driven over the committed fixtures through the fs adapter.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BuildIdentityMismatchError,
  MalformedCorpusError,
  UnknownContractMajorError,
} from '../../src/errors.js';
import { FsCorpusSource } from '../../src/corpus/fs-source.js';
import { loadSnapshot, siteSlugFor } from '../../src/corpus/snapshot.js';
import { collectEvents, fixture, ofKind } from './helpers.js';

const load = (name: string, events?: ReturnType<typeof collectEvents>) =>
  loadSnapshot(new FsCorpusSource(fixture(name)), { logger: events?.logger });

describe('loadSnapshot over the example fixture (fs adapter)', () => {
  it('materializes every index-listed page with metadata', async () => {
    const index = JSON.parse(readFileSync(`${fixture('example')}/api/index.json`, 'utf8'));
    const snapshot = await load('example');
    expect(snapshot.pages).toHaveLength(index.count);
    expect(snapshot.siteTitle).toBe('DocKitty Example');
    expect(snapshot.contractVersion).toBe('3');
    expect(snapshot.buildId).toBe(index.buildId);
    expect(snapshot.pagesGated).toBe(false);
    expect(snapshot.baseUrl).toBe(fixture('example'));
  });

  it('identifies the home page by artifact ref (empty slug -> id "home")', async () => {
    const snapshot = await load('example');
    const home = snapshot.pages.find((p) => p.record.slug === '')!;
    expect(home.id).toBe('home');
    expect(home.ref).toBe('https://spec-kitty.github.io/doc-kitty/api/pages/home.json');
    expect(home.markdown.startsWith('# DocKitty Example')).toBe(true);
  });

  it('keeps slashes in nested page ids and maps sections from records', async () => {
    const snapshot = await load('example');
    const nested = snapshot.pages.find((p) => p.record.slug === 'context/audience')!;
    expect(nested.id).toBe('context/audience');
    expect(nested.section).toBe('context');
  });

  it('maps the legacy home-record empty section value onto the synthesized site root section', async () => {
    const snapshot = await load('example');
    const home = snapshot.pages.find((p) => p.record.slug === '')!;
    expect(home.section).toBe('');
    expect(snapshot.sections[0]).toEqual({ id: '', label: '', order: 0 });
    // registry order preserved afterwards
    expect(snapshot.sections.slice(1).map((s) => s.id)).toEqual([
      'context',
      'architecture',
      'adr',
      'plans',
      'behaviour',
      'guides',
      'rhetoric',
      'presentations',
      'glossary',
      'changelog',
    ]);
  });

  it('projects keywords from the per-page artifact, not the index record', async () => {
    const snapshot = await load('example');
    const page = snapshot.pages.find((p) => p.id === 'guides/getting-started')!;
    const artifact = JSON.parse(readFileSync(`${fixture('example')}/api/pages/guides/getting-started.json`, 'utf8'));
    expect(page.keywords).toEqual(artifact.keywords);
    expect(Array.isArray(page.keywords)).toBe(true);
  });

  it('loads the linked scenarios surface', async () => {
    const snapshot = await load('example');
    expect(snapshot.scenarios).toBeDefined();
    expect(snapshot.scenarios!.artifact.features.length).toBeGreaterThan(0);
    expect(snapshot.scenarios!.artifact.buildId).toBe(snapshot.buildId);
  });
});

describe('contract version handshake (FR-005, NFR-005)', () => {
  it('rejects an unknown contract major', async () => {
    await expect(load('unknown-major')).rejects.toThrow(UnknownContractMajorError);
    await expect(load('unknown-major')).rejects.toMatchObject({ code: 'UNKNOWN_CONTRACT_MAJOR' });
  });

  it('rejects a version string with no numeric major', async () => {
    await expect(load('non-numeric-version')).rejects.toMatchObject({
      code: 'UNKNOWN_CONTRACT_MAJOR',
      message: expect.stringContaining("'beta'"),
    });
  });
});

describe('buildId compare-all (FR-008)', () => {
  it('refuses a torn corpus with BUILD_IDENTITY_MISMATCH naming both artifacts', async () => {
    const error = await load('torn-build').then(
      () => undefined,
      (e) => e as BuildIdentityMismatchError,
    );
    expect(error).toBeInstanceOf(BuildIdentityMismatchError);
    expect(error!.code).toBe('BUILD_IDENTITY_MISMATCH');
    expect(error!.message).toContain('api/pages/context/audience.json');
    expect(error!.message).toContain('api/index.json');
  });

  it('loads a pre-FR-008 corpus with a warning instead of refusing (migration allowance)', async () => {
    const events = collectEvents();
    const snapshot = await load('pre-buildid', events);
    expect(snapshot.buildId).toBeUndefined();
    expect(snapshot.pages).toHaveLength(3);
    const messages = ofKind(events.events, 'warning').map((e) => e.message);
    expect(messages.some((m) => m?.includes('migration allowance'))).toBe(true);
  });
});

describe('pages gating (pinned rule: records without _links.self)', () => {
  it('loads degraded, marks the snapshot pages-gated, keeps scenarios', async () => {
    const events = collectEvents();
    const snapshot = await load('gated-pages', events);
    expect(snapshot.pagesGated).toBe(true);
    expect(snapshot.pages).toHaveLength(0);
    expect(snapshot.scenarios).toBeDefined();
    const messages = ofKind(events.events, 'warning').map((e) => e.message);
    expect(messages.some((m) => m?.includes('PAGES_LINKS_GATED'))).toBe(true);
  });
});

describe('sections tolerance', () => {
  it('tolerates an absent sections[] (pre-WP01 corpus) without touching record sections', async () => {
    const snapshot = await load('pre-buildid');
    expect(snapshot.pages.find((p) => p.record.slug === 'context/audience')!.section).toBe('context');
    // Root section still synthesized for the home record (id '').
    expect(snapshot.sections[0]).toEqual({ id: '', label: '', order: 0 });
    expect(snapshot.sections).toHaveLength(1);
  });
});

describe('shape guards (MALFORMED_CORPUS with path + offending key)', () => {
  it('names the record key that failed validation', async () => {
    await expect(load('malformed-title')).rejects.toMatchObject({
      code: 'MALFORMED_CORPUS',
      message: expect.stringContaining('pages[0].title'),
    });
    await expect(load('malformed-title')).rejects.toThrow(MalformedCorpusError);
  });
});

describe('siteSlugFor (contract-pinned rule)', () => {
  it('lowercases, drops scheme and trailing slash, collapses non-alphanumerics', () => {
    expect(siteSlugFor('https://spec-kitty.github.io/doc-kitty')).toBe('spec-kitty-github-io-doc-kitty');
    expect(siteSlugFor('https://Example.COM:8443/Base/')).toBe('example-com-8443-base');
    expect(siteSlugFor('http://localhost:4321')).toBe('localhost-4321');
  });
});
