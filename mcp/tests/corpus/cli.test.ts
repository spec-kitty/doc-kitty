/**
 * CLI (T010): exit codes 0 clean / 2 launch-or-config failure, named errors on
 * stderr, the WP03 serve seam, and the shipped shebang. run() is exercised
 * in-process with captured io; direct `node dist/cli.js` execution (enoent the
 * ENOEXEC class) is asserted on the built artifact when dist/ exists, and the
 * hard end-to-end form lands with the packed-tarball consumption test (WP06
 * T025).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/cli.js';
import type { LaunchConfiguration } from '../../src/cli.js';
import type { CorpusSnapshot } from '../../src/corpus/snapshot.js';
import { captureIo, fixture } from './helpers.js';

describe('doc-kitty-mcp CLI', () => {
  it('loads the example corpus from --dir and hands the snapshot to the serve seam', async () => {
    const io = captureIo();
    let served: { snapshot: CorpusSnapshot; config: LaunchConfiguration } | undefined;
    const code = await run(['--dir', fixture('example'), '--resource-threshold', '250'], io, (snapshot, config) => {
      served = { snapshot, config };
      return Promise.resolve();
    });
    expect(code).toBe(0);
    expect(served!.snapshot.pages.length).toBeGreaterThan(60);
    expect(served!.config).toMatchObject({
      source: { kind: 'fs', dir: fixture('example') },
      resourceListingThreshold: 250,
      siteSlug: expect.any(String),
    });
    expect(served!.snapshot.buildId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('defaults the resource threshold to 1000', async () => {
    const io = captureIo();
    let config: LaunchConfiguration | undefined;
    const code = await run(['--dir', fixture('example')], io, (_s, c) => {
      config = c;
    });
    expect(code).toBe(0);
    expect(config!.resourceListingThreshold).toBe(1000);
  });

  it('exits 2 with UNKNOWN_CONTRACT_MAJOR on an unknown contract major', async () => {
    const io = captureIo();
    const code = await run(['--dir', fixture('unknown-major')], io);
    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('UNKNOWN_CONTRACT_MAJOR');
  });

  it('exits 2 with UNKNOWN_CONTRACT_MAJOR on a non-numeric version', async () => {
    const io = captureIo();
    const code = await run(['--dir', fixture('non-numeric-version')], io);
    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('UNKNOWN_CONTRACT_MAJOR');
  });

  it('exits 2 with BUILD_IDENTITY_MISMATCH on a torn corpus', async () => {
    const io = captureIo();
    const code = await run(['--dir', fixture('torn-build')], io);
    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('BUILD_IDENTITY_MISMATCH');
  });

  it('exits 0 with a warning on a pre-FR-008 corpus (migration allowance)', async () => {
    const io = captureIo();
    const code = await run(['--dir', fixture('pre-buildid')], io);
    expect(code).toBe(0);
    expect(io.err.join('\n')).toContain('migration allowance');
  });

  it('exits 2 with usage on config mistakes (no source / both sources / bad threshold / link-base with --site)', async () => {
    for (const argv of [
      [],
      ['--site', 'https://example.com', '--dir', fixture('example')],
      ['--dir', fixture('example'), '--resource-threshold', '0'],
      ['--site', 'https://example.com', '--link-base', 'http://localhost:4321'],
      ['--site', 'not a url'],
      ['--frobnicate'],
    ]) {
      const io = captureIo();
      const code = await run(argv, io);
      expect(code, JSON.stringify(argv)).toBe(2);
      expect(io.err.join('\n'), JSON.stringify(argv)).toContain('Usage:');
    }
  });

  it('exits 2 on a missing --dir directory', async () => {
    const io = captureIo();
    const code = await run(['--dir', '/nonexistent/doc-kitty-fixture'], io);
    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('does not exist');
  });

  it('prints usage on stdout and exits 0 for --help', async () => {
    const io = captureIo();
    const code = await run(['--help'], io);
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('Usage:');
    expect(io.err).toEqual([]);
  });

  it('src/cli.ts starts with the shebang (tsc preserves it, never creates it)', () => {
    const src = path.join(path.dirname(fixture('.')), '..', '..', 'src', 'cli.ts');
    expect(readFileSync(src, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true);
  });

  it('dist/cli.js keeps the shebang on the FIRST line after tsc emit', { skip: !distExists() }, () => {
    const dist = path.join(path.dirname(fixture('.')), '..', '..', 'dist', 'cli.js');
    const firstLine = readFileSync(dist, 'utf8').split('\n', 1)[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });
});

function distExists(): boolean {
  const dist = path.join(path.dirname(fixture('.')), '..', '..', 'dist', 'cli.js');
  return existsSync(dist);
}
