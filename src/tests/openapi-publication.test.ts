/**
 * The `DK_OPENAPI` handoff is a file path, not JSON: a publication with
 * thousands of operations must not push one env string past the kernel's
 * 128 KiB limit (E2BIG on every later `execve`).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DK_OPENAPI_ENV } from '../lib/internal-env.mjs';
import { readPublication, writePublication, type OpenApiPublication } from '../lib/openapi/publication.js';

function bigPublication(operations: number): OpenApiPublication {
  return {
    section: 'reference/api',
    llmsOperations: true,
    versions: [
      {
        label: 'v1',
        released: true,
        ext: 'yaml',
        sha256: 'a'.repeat(64),
        title: 'Big API',
        apiVersion: '1.0.0',
        rawRoute: '/reference/api/v1/openapi.yaml',
        operations: Array.from({ length: operations }, (_, index) => ({
          method: 'GET',
          path: `/resources/${index}/with/a/rather/long/path/segment`,
          summary: `Summary of operation number ${index}`,
          operationId: `operation${index}`,
          slug: `operations/operation${index}`,
        })),
      },
    ],
  };
}

describe('the publication file handoff', () => {
  let dir: string;
  const previous = process.env[DK_OPENAPI_ENV];

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'dk-publication-test-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    if (previous === undefined) delete process.env[DK_OPENAPI_ENV];
    else process.env[DK_OPENAPI_ENV] = previous;
  });

  it('round-trips a publication through the file', () => {
    const publication = bigPublication(3);
    const file = writePublication(dir, publication);
    expect(path.isAbsolute(file)).toBe(true);
    expect(readPublication(file)).toEqual(publication);
  });

  it('names the file by the content, so the same publication lands at the same path', () => {
    const first = writePublication(dir, bigPublication(5));
    expect(writePublication(dir, bigPublication(5))).toBe(first);
    expect(writePublication(dir, bigPublication(6))).not.toBe(first);
  });

  it('is undefined for an absent handoff, a missing file and malformed content', () => {
    expect(readPublication(undefined)).toBeUndefined();
    expect(readPublication('')).toBeUndefined();
    expect(readPublication(path.join(dir, 'missing.json'))).toBeUndefined();
    const garbage = path.join(dir, 'garbage.json');
    writeFileSync(garbage, '{nope');
    expect(readPublication(garbage)).toBeUndefined();
    const wrongShape = path.join(dir, 'wrong-shape.json');
    writeFileSync(wrongShape, '{"section":1}');
    expect(readPublication(wrongShape)).toBeUndefined();
  });

  it('reads and parses a file once per path', () => {
    const file = writePublication(dir, bigPublication(2));
    const first = readPublication(file);
    // Content-addressed paths never change content; a rewrite here proves the
    // second call does not read the disk again.
    writeFileSync(file, '{nope');
    expect(readPublication(file)).toBe(first);
  });

  it('keeps the env string short for a 2000-operation publication, and a child still spawns', () => {
    const publication = bigPublication(2000);
    expect(JSON.stringify(publication).length).toBeGreaterThan(128 * 1024);
    const file = writePublication(dir, publication);
    process.env[DK_OPENAPI_ENV] = file;
    expect(process.env[DK_OPENAPI_ENV]!.length).toBeLessThan(1024);
    expect(readFileSync(file, 'utf8').length).toBeGreaterThan(128 * 1024);
    const child = spawnSync(process.execPath, ['-e', 'process.stdout.write("ok")'], { encoding: 'utf8' });
    expect(child.error).toBeUndefined();
    expect(child.stdout).toBe('ok');
    expect(readPublication(process.env[DK_OPENAPI_ENV])?.versions[0]?.operations).toHaveLength(2000);
  });
});
