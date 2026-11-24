/**
 * The evidence index's generated-section stamp (WP06, #401, ADR-0087 D1/D2/D5):
 * `source_digest` by the normative D2 algorithm, `content_hash` over the index
 * without its stamp, `at` from the inputs and never the clock, and the
 * `doc-kitty-tom-annex` ownership producer (ADR-0083).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTomAnnex, serializeTomAnnex } from '../lib/tom-annex/core.mjs';
import {
  TOM_ANNEX_PRODUCER,
  annexConfig,
  annexInputs,
  annexInstant,
  contentHash,
  evidenceSourceFiles,
  sourceDigest,
  stampAnnex,
} from '../lib/tom-annex/stamp.mjs';
import { PRODUCER_REGISTRY } from '../lib/producers.mjs';
import { isGeneratedStamp } from '../lib/generator-stamp.mjs';
import { canonical, catalog as catalogOf, classified, graph as graphOf, page, record } from './fixtures/tom-annex/graph.mjs';

const hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const SITE = new URL('https://docs.example.org');
const BASE = '/docs/';

describe('sourceDigest follows ADR-0087 D2 (T026)', () => {
  it('reproduces the ADR worked example', () => {
    expect(
      sourceDigest([
        { key: 'features/shipping.feature', sha256: '602cc601811283c683edd47f62a25fabd760959d848805bef9983c72fc0b93d4' },
        { key: 'config:doc-kitty-gherkin', sha256: '4e9ce5abbe8cb14f8719f94547084b6bd4e4d7f7a1c66e6aaa03844beaea0974' },
        { key: 'features/returns.feature', sha256: '4706fe2220c95abef8076225ef261f4ccc6ff2ecd608fb062050918aaee92a4f' },
      ]),
    ).toBe('sha256:3f1cb1c1bfbeb5922c739057e9987407df7396829d97682420aee0ea94d823d2');
  });

  it('gives the empty-payload digest for no inputs', () => {
    expect(sourceDigest([])).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('does not depend on the order the inputs are given in', () => {
    const a = { key: 'a.md', sha256: hex('a') };
    const b = { key: 'b.md', sha256: hex('b') };
    expect(sourceDigest([a, b])).toBe(sourceDigest([b, a]));
  });

  it('sorts by UTF-8 bytes, not UTF-16 code units (a key outside the BMP)', () => {
    const astral = { key: 'docs/\u{1F600}.md', sha256: hex('x') };
    const bmpHigh = { key: 'docs/�.md', sha256: hex('y') };
    // UTF-8: U+FFFD (EF BF BD) sorts before U+1F600 (F0 9F 98 80); UTF-16 would put the emoji first.
    const payload = `${bmpHigh.key}\0${bmpHigh.sha256}\n${astral.key}\0${astral.sha256}`;
    expect(sourceDigest([astral, bmpHigh])).toBe(`sha256:${hex(payload)}`);
  });

  it('refuses a duplicate key or a value that is not a lowercase 64-hex sha256', () => {
    expect(() => sourceDigest([{ key: 'a', sha256: hex('a') }, { key: 'a', sha256: hex('b') }])).toThrow(/twice/);
    expect(() => sourceDigest([{ key: 'a', sha256: 'ABC' }])).toThrow(/sha256/);
  });
});

describe('the declared inputs (T026)', () => {
  const config = annexConfig({ site: SITE, base: BASE, catalog: { records: [record('b'), record('a')], isDefault: true } });
  const pages = [
    { path: 'docs/security/audit.md', bytes: 'audit v1\n' },
    { path: 'docs/context/incidents.md', bytes: 'incidents\n' },
  ];
  const digestOf = (evidencePages: typeof pages, extra: Partial<Parameters<typeof annexInputs>[0]> = {}) =>
    sourceDigest(annexInputs({ evidencePages, config, ...extra }));

  it('one entry per evidence page, keyed by its POSIX path, plus one config entry', () => {
    const inputs = annexInputs({ evidencePages: [{ path: 'docs\\security\\audit.md', bytes: 'x' }], config });
    expect(inputs.map((i: { key: string }) => i.key).sort()).toEqual(['config:doc-kitty-tom-annex', 'docs/security/audit.md']);
  });

  it('changes when one evidence page changes, and when a page is added', () => {
    const base = digestOf(pages);
    expect(digestOf([{ ...pages[0], bytes: 'audit v2\n' }, pages[1]])).not.toBe(base);
    expect(digestOf([...pages, { path: 'docs/guides/access.md', bytes: 'access\n' }])).not.toBe(base);
  });

  it('a page listed twice (evidence for two measures) counts once', () => {
    expect(digestOf([...pages, pages[0]])).toBe(digestOf(pages));
  });

  it('changes with the site or the base, which change every evidence URL', () => {
    const other = annexConfig({ site: SITE, base: '/v2/', catalog: { records: [record('a'), record('b')], isDefault: true } });
    expect(digestOf(pages, { config: other })).not.toBe(digestOf(pages));
  });

  it('the default catalog is configuration, sorted by id, so record order does not matter', () => {
    const sorted = annexConfig({ site: SITE, base: BASE, catalog: { records: [record('a'), record('b')], isDefault: true } });
    expect(digestOf(pages, { config: sorted })).toBe(digestOf(pages));
    const changed = annexConfig({ site: SITE, base: BASE, catalog: { records: [record('a'), record('c')], isDefault: true } });
    expect(digestOf(pages, { config: changed })).not.toBe(digestOf(pages));
  });

  it('a consumer catalog is a file entry, so equal records still digest differently from the default (pinned)', () => {
    const consumer = annexConfig({ site: SITE, base: BASE, catalog: { records: [record('a'), record('b')], isDefault: false } });
    const withFile = digestOf(pages, { config: consumer, catalogFile: { path: 'docs/_meta/measures.yaml', bytes: 'measures: []\n' } });
    expect(withFile).not.toBe(digestOf(pages));
    expect(consumer.catalog).toBeNull();
  });

  it('refuses a consumer catalog without its file', () => {
    const consumer = annexConfig({ site: SITE, base: BASE, catalog: { records: [], isDefault: false } });
    expect(() => annexInputs({ evidencePages: pages, config: consumer })).toThrow(/catalog file/);
  });
});

describe('evidenceSourceFiles: only pages with a classified-as edge are inputs (T026)', () => {
  const { graph } = canonical();
  const locations = Object.fromEntries(
    graph.nodes.filter((n: { kind: string }) => n.kind === 'page').map((n: { id: string }) => [n.id, { id: n.id, file: `${n.id}.md` }]),
  );

  it('lists each evidence page source once, sorted, and leaves an unclassified page out', () => {
    const files = evidenceSourceFiles(graph, locations);
    expect(files).toEqual(['architecture/audit-logging.md', 'context/incident-handling.md', 'guides/access.md']);
    // Control: the unclassified page exists in the graph and the locations, and is still not an input.
    expect(locations['guides/unrelated']).toBeDefined();
    expect(files).not.toContain('guides/unrelated.md');
  });

  it('throws when an evidence page has no source file', () => {
    const { 'guides/access': _dropped, ...partial } = locations;
    void _dropped;
    expect(() => evidenceSourceFiles(graph, partial)).toThrow(/guides\/access/);
  });

  it('a whitespace-only change to an unclassified page does not change the digest; one to an evidence page does', () => {
    const files: Record<string, string> = Object.fromEntries(Object.values(locations).map((l) => [l.file, `${l.id}\n`]));
    const digest = (f: Record<string, string>) =>
      sourceDigest(
        annexInputs({
          evidencePages: evidenceSourceFiles(graph, locations).map((p: string) => ({ path: `docs/${p}`, bytes: f[p] })),
          config: annexConfig({ site: SITE, base: BASE, catalog: { records: [], isDefault: true } }),
        }),
      );
    const before = digest(files);
    expect(digest({ ...files, 'guides/unrelated.md': `${files['guides/unrelated.md']}  \n` })).toBe(before);
    expect(digest({ ...files, 'guides/access.md': `${files['guides/access.md']}  \n` })).not.toBe(before);
  });
});

describe('content_hash and at (T027)', () => {
  afterEach(() => vi.useRealTimers());

  const { graph, catalog } = canonical();
  const annex = buildTomAnnex(graph as never, catalog as never, { site: SITE, base: BASE });
  const inputs = [{ key: 'docs/a.md', sha256: hex('a') }];

  it('content_hash is the first 12 hex of the index serialised without generated', () => {
    const expected = `sha256:${hex(serializeTomAnnex(annex)).slice(0, 12)}`;
    expect(contentHash(annex)).toBe(expected);
    expect(contentHash(stampAnnex(annex, { inputs }))).toBe(expected);
  });

  it('content_hash changes with the body, and not when only generated differs', () => {
    const stamped = stampAnnex(annex, { inputs });
    const otherStamp = { ...stamped, generated: { ...stamped.generated, at: '2000-01-01T00:00:00Z' } };
    expect(contentHash(otherStamp)).toBe(contentHash(stamped));
    expect(contentHash({ ...annex, counsel: [...annex.counsel, 'x'] })).not.toBe(contentHash(annex));
  });

  it('at is the latest updated or verified instant of the listed evidence', () => {
    // The fixture's audit page: updated 2026-11-20, verified 2026-11-21.
    expect(annexInstant(annex)).toBe('2026-11-21T00:00:00Z');
  });

  it('at is null when no evidence carries an instant', () => {
    const bare = buildTomAnnex(
      graphOf([page('p'), { id: 'catalog:measure:a', kind: 'measure' }], [classified('p', 'a')]) as never,
      catalogOf([record('a')]) as never,
      { site: SITE, base: BASE },
    );
    expect(annexInstant(bare)).toBeNull();
  });

  it('stamps in schema position (after notice, before catalog) with by, at, source_digest, content_hash', () => {
    const stamped = stampAnnex(annex, { inputs });
    expect(Object.keys(stamped)).toEqual(['format', 'format_version', 'label', 'notice', 'generated', 'catalog', 'scopes', 'uncovered', 'counsel']);
    expect(Object.keys(stamped.generated)).toEqual(['by', 'at', 'source_digest', 'content_hash']);
    expect(stamped.generated.by).toMatch(new RegExp(`^${TOM_ANNEX_PRODUCER}/\\d+\\.\\d+\\.\\d+`));
    expect(stamped.generated.source_digest).toBe(sourceDigest(inputs));
  });

  it('never reads the clock: two calls under different faked clocks give the same bytes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const first = serializeTomAnnex(stampAnnex(annex, { inputs }));
    vi.setSystemTime(new Date('2041-06-15T12:00:00Z'));
    const second = serializeTomAnnex(stampAnnex(annex, { inputs }));
    expect(second).toBe(first);
    expect(first).not.toMatch(/2030|2041/);
  });
});

describe('the doc-kitty-tom-annex producer (T028, ADR-0083)', () => {
  it('is a registered ownership producer, and its stamp is recognised', () => {
    expect(PRODUCER_REGISTRY.ids('ownership')).toContain(TOM_ANNEX_PRODUCER);
    expect(isGeneratedStamp(`${TOM_ANNEX_PRODUCER}/1.2.3`)).toBe(true);
  });

  it('owns a stamped Hub page only inside the scope the caller narrows it to', () => {
    const data = { kind: 'Hub', generated: { by: `${TOM_ANNEX_PRODUCER}/1.2.3` } };
    const scopes = { [TOM_ANNEX_PRODUCER]: { type: 'section' as const, section: 'context', kinds: ['Hub'] } };
    expect(PRODUCER_REGISTRY.ownerOfPage('context/evidence-index/index.md', data, { scopes })).toBe(TOM_ANNEX_PRODUCER);
    expect(PRODUCER_REGISTRY.ownerOfPage('guides/evidence-index/index.md', data, { scopes })).toBeUndefined();
    // Not a Hub: outside the kinds.
    expect(PRODUCER_REGISTRY.ownerOfPage('context/evidence-index/index.md', { ...data, kind: 'Reference' }, { scopes })).toBeUndefined();
  });
});
