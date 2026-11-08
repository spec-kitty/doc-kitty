/**
 * The synthetic OpenAPI entries through the MCP corpus loader (mission
 * openapi-second-slice-01M6WXJ4, WP03): a real `astro build` of the toolkit's
 * two-versions OpenAPI fixture must produce an agent API the loader accepts —
 * every shape guard (assertIndexShape / assertPageShape), the version
 * handshake, the buildId compare-all and the page-id derivation all hold for
 * the synthetic records exactly as they do for docs pages.
 *
 * The build is self-contained on purpose: it copies the fixture site from
 * `src/tests/fixtures/openapi/` (never importing src test helpers — that would
 * break this package's tsc rootDir), builds it through `example/`'s own astro
 * shim the way `src/tests/helpers/openapi-build.ts` does, and loads the dist
 * through FsCorpusSource + loadSnapshot, the real adapter/loader pair.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsCorpusSource } from '../../src/corpus/fs-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import { assertIndexShape, assertPageShape, parseArtifact } from '../../src/corpus/source.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'openapi');
/** This suite's own build root (unique among the `example/.dk-test-openapi/` roots). */
const ROOT = path.join(REPO_ROOT, 'example', '.dk-test-openapi', 'mcp-corpus-openapi-entries');
/**
 * The build runs through pnpm's `node_modules/.bin/astro` shim, not astro's
 * bin directly: the OpenAPI pages pull `satteri`'s native binding into the
 * prerender bundle, and it is only resolvable through the NODE_PATH the shim
 * exports (see src/tests/helpers/openapi-build.ts for the full rationale).
 */
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', '.bin', 'astro');

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/** The build environment: this request's values, not the caller's (DK_* cleaned). */
function buildEnv(): NodeJS.ProcessEnv {
  // Annotated: the object-literal spread of `process.env` drops the index
  // signature, which would make the `delete clean[name]` loop below a TS7053.
  const clean: NodeJS.ProcessEnv = { ...process.env, CI: '' };
  for (const name of Object.keys(clean)) {
    if (name.startsWith('DK_') || ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'].includes(name)) {
      delete clean[name];
    }
  }
  return {
    ...clean,
    DK_PUBLISH_DRAFTS: 'on',
    DK_TEST_OPTIONS: JSON.stringify({
      openapi: {
        specs: [
          { path: 'openapi/v1.yaml', label: 'v1', released: true },
          { path: 'openapi/v2.yaml', label: 'v2', released: false },
        ],
      },
    }),
    DK_OUTDIR: 'dist',
  };
}

describe('the corpus the two-versions OpenAPI fixture builds (mission openapi-second-slice-01M6WXJ4, WP03)', () => {
  let dist = '';

  beforeAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
    cpSync(path.join(FIXTURES, 'site'), ROOT, { recursive: true });
    cpSync(path.join(FIXTURES, 'astro.config.mjs'), path.join(ROOT, 'astro.config.mjs'));
    cpSync(path.join(FIXTURES, 'two-versions'), path.join(ROOT, 'openapi'), { recursive: true });
    const run = spawnSync(ASTRO_BIN, ['build'], { cwd: ROOT, encoding: 'utf8', env: buildEnv() });
    expect(
      run.status,
      `astro build output:\n${stripVTControlCharacters(`${run.stdout}\n${run.stderr}`)}`,
    ).toBe(0);
    dist = path.join(ROOT, 'dist');
  }, 600_000);

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('the index passes the shape guard, with both synthetic entries after the docs records', () => {
    const index = parseArtifact(readFileSync(path.join(dist, 'api', 'index.json'), 'utf8'), 'api/index.json');
    assertIndexShape(index);
    expect(index.version).toBe('3');
    expect(index.count).toBe(4);
    expect(index.pages.map((record) => record.slug)).toEqual([
      '',
      'guides',
      'reference/api/v1',
      'reference/api/v2',
    ]);
  });

  it('each synthetic page artifact passes the page guard and carries the raw document identity', () => {
    for (const [label, title, keywords] of [
      ['v1', 'Parcels API v1', ['Delete a parcel', 'List parcels']],
      ['v2', 'Parcels API v2 (unreleased)', ['Get a parcel', 'List parcels']],
    ] as const) {
      const artifactPath = `api/pages/reference/api/${label}.json`;
      const page = parseArtifact(readFileSync(path.join(dist, artifactPath), 'utf8'), artifactPath);
      assertPageShape(page, artifactPath);
      expect(page.title).toBe(title);
      expect(page.keywords).toEqual([...keywords]);
      // The summary heading is `<title> <label>`; the unreleased marker lives
      // in the record title and the `- Released: no` line, not the heading.
      expect(page.markdown).toContain(`# Parcels API ${label}\n`);
      const synthetic = page as typeof page & { released: boolean; rawDocumentUrl: string; sha256: string };
      expect(synthetic.released).toBe(label === 'v1');
      expect(synthetic.rawDocumentUrl).toBe(`/reference/api/${label}/openapi.yaml`);
      // The record describes the SERVED bytes at rawDocumentUrl.
      expect(synthetic.sha256).toBe(sha256(readFileSync(path.join(dist, 'reference', 'api', label, 'openapi.yaml'))));
      expect(synthetic.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('loadSnapshot loads the whole corpus, synthetic pages included', async () => {
    const snapshot = await loadSnapshot(new FsCorpusSource(dist));
    expect(snapshot.contractVersion).toBe('3');
    expect(snapshot.pagesGated).toBe(false);
    expect(snapshot.pages.map((page) => page.id)).toEqual([
      'home',
      'guides',
      'reference/api/v1',
      'reference/api/v2',
    ]);
    const v1 = snapshot.pages.find((page) => page.id === 'reference/api/v1')!;
    expect(v1.section).toBe('reference');
    expect(v1.title).toBe('Parcels API v1');
    expect(v1.docStatus).toBe('active');
    expect(v1.markdown).toContain('# Parcels API v1\n');
    expect(v1.markdown).toContain('- GET /parcels: List parcels\n');
    // The unreleased version is a full citizen of the corpus (FR-015 excludes
    // it from the sitemap and search, never from the agent surfaces).
    const v2 = snapshot.pages.find((page) => page.id === 'reference/api/v2')!;
    expect(v2.title).toBe('Parcels API v2 (unreleased)');
    expect(v2.keywords).toEqual(['Get a parcel', 'List parcels']);
    // buildId compare-all covered every artifact, synthetic ones included.
    expect(v1.artifact.buildId).toBe(snapshot.buildId);
    expect(v2.artifact.buildId).toBe(snapshot.buildId);
  });
});
