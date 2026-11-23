import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
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

  it('is the shipped default when no catalog exists, and is deep-frozen', async () => {
    const { DEFAULT_MEASURES } = await import('../lib/measures-default.mjs');
    expect(readMeasuresCatalog(fixture('no-catalog')).records).toEqual(DEFAULT_MEASURES);
    expect(Object.isFrozen(DEFAULT_MEASURES)).toBe(true);
    // Deep: a caller cannot mutate a shared default record or its framework refs.
    for (const record of DEFAULT_MEASURES) {
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(record.frameworks)).toBe(true);
      for (const ref of record.frameworks) expect(Object.isFrozen(ref)).toBe(true);
    }
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

// A docs root in a temp dir with the given _meta/measures.yaml text.
function rootWith(text: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-measures-'));
  mkdirSync(path.join(root, '_meta'));
  writeFileSync(path.join(root, '_meta', 'measures.yaml'), text);
  return root;
}

const RECORD = '- id: a-b\n  label: X\n  nature: technical\n  frameworks: [{ framework: f, ref: "1" }]\n';

describe('consumer catalog parsing', () => {
  it('accepts a file that opens with the YAML document marker', () => {
    const { records, problems } = readMeasuresCatalog(rootWith(`---\n${RECORD}`));
    expect(problems).toEqual([]);
    expect(records.map((r) => r.id)).toEqual(['a-b']);
  });

  it('rejects a second YAML document instead of dropping its records', () => {
    const { problems } = readMeasuresCatalog(rootWith(`${RECORD}---\n${RECORD.replace('a-b', 'c-d')}`));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/cannot be parsed/);
  });

  it('reads a file with a UTF-8 byte order mark', () => {
    const { records, problems } = readMeasuresCatalog(rootWith(`\uFEFF${RECORD}`));
    expect(problems).toEqual([]);
    expect(records).toHaveLength(1);
  });

  it('names an unquoted numeric ref plainly', () => {
    const { problems } = readMeasuresCatalog(rootWith(RECORD.replace('ref: "1"', 'ref: 32')));
    expect(problems).toEqual([expect.stringContaining('"ref" must be a string; quote numbers such as "32"')]);
  });

  it('reloads the catalog when the file changes, so a dev server sees edits', () => {
    const root = rootWith(RECORD);
    expect([...loadMeasuresCatalog(root).index.keys()]).toEqual(['a-b']);
    const file = path.join(root, '_meta', 'measures.yaml');
    writeFileSync(file, RECORD.replace('a-b', 'c-d'));
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    expect([...loadMeasuresCatalog(root).index.keys()]).toEqual(['c-d']);
  });
});
