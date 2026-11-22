import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DEFAULT_MEASURES_PATH,
  DEFAULT_MEASURES_SOURCE,
  clearMeasuresCatalogCache,
  loadMeasuresCatalog,
  readMeasuresCatalog,
} from '../lib/measures-loader.mjs';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/measures/${name}/docs`, import.meta.url));

beforeEach(() => clearMeasuresCatalogCache());

describe('the shipped default catalog', () => {
  it('holds the 17 Annex II headings with unique ids and no problems', () => {
    const { records, problems, isDefault, source } = readMeasuresCatalog(fixture('no-catalog'));
    expect(problems).toEqual([]);
    expect(isDefault).toBe(true);
    expect(source).toBe(DEFAULT_MEASURES_SOURCE);
    expect(records).toHaveLength(17);
    expect(new Set(records.map((r) => r.id)).size).toBe(17);
    expect(records.map((r) => r.id)).toEqual(expect.arrayContaining(['transmission-protection', 'events-logging']));
    expect(records.map((r) => r.frameworks.find((f) => f.framework === 'eu-scc-2021-914-annex-ii')?.ref)).toEqual(
      Array.from({ length: 17 }, (_, i) => String(i + 1)),
    );
    const gdpr = records.flatMap((r, i) => (r.frameworks.some((f) => f.framework === 'eu-gdpr') ? [i + 1] : []));
    expect(gdpr).toEqual([1, 2, 3, 4]);
    for (const r of records) expect(r.dpv).toMatch(/^https:\/\/w3id\.org\/dpv#[A-Za-z]+$/);
  });

  it('resolves from the module, not from the working directory', () => {
    expect(path.basename(DEFAULT_MEASURES_PATH)).toBe('measures.default.yaml');
    expect(path.isAbsolute(DEFAULT_MEASURES_PATH)).toBe(true);
  });
});

describe('loadMeasuresCatalog', () => {
  it('replaces the default wholesale with a consumer file', () => {
    const { index, isDefault, source } = loadMeasuresCatalog(fixture('consumer'));
    expect(isDefault).toBe(false);
    expect([...index.keys()]).toEqual(['a-5-15-access-control', 'a-8-24-cryptography']);
    expect(index.has('transmission-protection')).toBe(false);
    expect(source).toMatch(/consumer\/docs\/_meta\/measures\.yaml$/);
  });

  it('falls back to the default when the docs root has no catalog', () => {
    const { index, isDefault } = loadMeasuresCatalog(fixture('no-catalog'));
    expect(isDefault).toBe(true);
    expect(index.size).toBe(17);
  });

  it('reports every problem of a malformed consumer catalog and throws on load', () => {
    const { problems } = readMeasuresCatalog(fixture('bad-catalog'));
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/bad-catalog\/docs\/_meta\/measures\.yaml: dup: duplicate id$/);
    expect(problems[1]).toMatch(/odd-nature: "nature" must be one of/);
    expect(() => loadMeasuresCatalog(fixture('bad-catalog'))).toThrow(/duplicate id/);
  });

  it('parses each docs root once per process', () => {
    const first = loadMeasuresCatalog(fixture('consumer'));
    expect(loadMeasuresCatalog(fixture('consumer'))).toBe(first);
    clearMeasuresCatalogCache();
    expect(loadMeasuresCatalog(fixture('consumer'))).not.toBe(first);
  });
});
