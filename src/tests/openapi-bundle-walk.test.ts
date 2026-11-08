/**
 * The bundle walk's file handling: an oversized referenced file is refused
 * from its stat, before it is read, and containment checks compare path
 * segments, so a sibling named `..shared.yaml` is a valid file name.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const reads: string[] = [];
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: ((file: unknown, ...rest: unknown[]) => {
      reads.push(String(file));
      return (actual.readFileSync as (...args: unknown[]) => unknown)(file, ...rest);
    }) as typeof actual.readFileSync,
  };
});

const { materialiseOpenApiSpecs } = await import('../lib/openapi/materialise.mjs');
const { normaliseOpenApiOptions } = await import('../lib/openapi/options.mjs');
const { MAX_SPEC_BYTES } = await import('../lib/openapi/limits.mjs');

const renderer = () => ({});
const entryYaml = (ref: string) =>
  `${[
    'openapi: 3.1.0',
    'info:',
    '  title: Walk',
    '  version: 1.0.0',
    'paths: {}',
    'components:',
    '  schemas:',
    '    Pet:',
    `      $ref: '${ref}'`,
  ].join('\n')}\n`;

let site: string;
beforeAll(() => {
  site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-walk-'));
  mkdirSync(path.join(site, 'docs'), { recursive: true });
  mkdirSync(path.join(site, 'openapi'), { recursive: true });
});
afterAll(() => rmSync(site, { recursive: true, force: true }));

const run = (ref: string) => {
  writeFileSync(path.join(site, 'openapi', 'entry.yaml'), entryYaml(ref));
  const options = normaliseOpenApiOptions(
    { renderer, specs: [{ path: 'openapi/entry.yaml', label: 'v1', released: true }] },
    { siteRoot: site },
  );
  return materialiseOpenApiSpecs(options, { siteRoot: site, offline: false, cacheDir: path.join(site, '.cache') });
};

describe('bundle walk file handling', () => {
  it('refuses an oversized referenced file from its stat, without reading it', () => {
    const big = path.join(site, 'openapi', 'big.yaml');
    writeFileSync(big, '');
    truncateSync(big, MAX_SPEC_BYTES + 1);
    reads.length = 0;
    expect(() => run('./big.yaml#/Pet')).toThrow(/10 MB limit exceeded/);
    expect(reads.filter((file) => file.endsWith('big.yaml'))).toEqual([]);
  });

  it('accepts a sibling file whose name starts with two dots', () => {
    writeFileSync(path.join(site, 'openapi', '..shared.yaml'), 'Pet:\n  type: object\n');
    const [spec] = run('./..shared.yaml#/Pet');
    expect(spec!.origin).toBe('bundle');
  });

  it('still rejects a ../ ref that leaves the definition folder', () => {
    writeFileSync(path.join(site, 'x.yaml'), 'Pet:\n  type: object\n');
    expect(() => run('../x.yaml#/Pet')).toThrow(/escapes the definition folder/);
  });
});
