/**
 * The tagged-release archive input (mission openapi-second-slice-01M6WXJ4,
 * WP08; FR-018, FR-023, FR-028).
 *
 * `openapi.archive: { glob, labelPattern, released }` turns a site-root-relative
 * glob into spec versions: one per regular file whose name the label pattern's
 * single capturing group labels. The scanner is a `specSources` source (WP02's
 * seam), so every case here drives it through `materialiseOpenApiSpecs` exactly
 * as `config.ts` does.
 *
 * Ordering is FR-023: the explicit `specs` in config order first, then the
 * archive's matches sorted by POSIX relative path in code-point order.
 *
 * Fail-closed (FR-028): the glob stays inside the site root, every match is
 * realpath-contained there and a regular file, the archive holds at most
 * `MAX_ARCHIVE_MATCHES` matches, a derived label is non-empty and route-safe,
 * and no label collides with an explicit spec or another match. Each refusal is
 * a `[dk-openapi] archive "<glob>"` error naming the file where one exists.
 *
 * Labels are route segments. The pinned renderer drops dots from its slugs
 * (`v1.1` → `v11`), so a derived label containing a dot is refused rather than
 * published as a dead link; the WP01 release fixtures are therefore copied to
 * hyphenated names here, as the example's own archive is.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const materialise = await import('../lib/openapi/materialise.mjs');
const { normaliseOpenApiOptions } = await import('../lib/openapi/options.mjs');
const { MAX_ARCHIVE_MATCHES } = await import('../lib/openapi/limits.mjs');

const FIXTURES = fileURLToPath(new URL('./fixtures/openapi', import.meta.url));

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const renderer = () => ({});

/** Every throwaway site this file made, removed in `afterAll`. */
const ROOTS: string[] = [];

afterAll(() => {
  for (const root of ROOTS) rmSync(root, { recursive: true, force: true });
});

/** Writes `files` (site-relative POSIX keys) under `root`, creating parents. */
function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
}

/** A minimal valid throwaway site (the options resolve `path`s against it). */
function makeSite(files: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-openapi-archive-'));
  ROOTS.push(root);
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  writeFiles(root, files);
  return root;
}

/** A minimal valid spec, one `GET /parcels` operation. */
function specText(title: string, version: string): string {
  return [
    'openapi: 3.1.0',
    'info:',
    `  title: ${title}`,
    `  version: ${version}`,
    'paths:',
    '  /parcels:',
    '    get:',
    '      operationId: listParcels',
    '      summary: List parcels',
    '      responses:',
    "        '200':",
    '          description: The parcels.',
    '',
  ].join('\n');
}

/** The WP01 three-release fixture, copied to route-safe (hyphenated) file names. */
const RELEASE_VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];

function releaseSite(): string {
  const root = makeSite();
  const dir = path.join(root, 'openapi', 'releases');
  mkdirSync(dir, { recursive: true });
  for (const version of RELEASE_VERSIONS) {
    cpSync(
      path.join(FIXTURES, 'archive', 'releases', `api-v${version}.yaml`),
      path.join(dir, `api-v${version.replaceAll('.', '-')}.yaml`),
    );
  }
  return root;
}

/** The archive option the release-site cases share. */
const RELEASES = { glob: 'openapi/releases/*.yaml', labelPattern: 'api-(v\\d+-\\d+-\\d+)\\.yaml' };

/** Normalise an option exactly as `config.ts` does, then materialise it. */
function materialised(root: string, over: Record<string, unknown>) {
  return materialise.materialiseOpenApiSpecs(
    normaliseOpenApiOptions({ renderer, ...over }, { siteRoot: root }),
    { siteRoot: root, offline: false, cacheDir: path.join(root, '.cache') },
  );
}

/**
 * Hand `materialiseOpenApiSpecs` an already-normalised option, to exercise the
 * scanner's own defensive guards (the static checks normally run first).
 */
function scanned(root: string, archive: Record<string, unknown>) {
  return materialise.materialiseOpenApiSpecs(
    {
      renderer,
      section: 'reference/api',
      specs: [],
      archive,
      llmsOperations: false,
      offline: false,
    },
    { siteRoot: root, offline: false, cacheDir: path.join(root, '.cache') },
  );
}

const v1 = { path: 'openapi/v1.yaml', label: 'v1', released: true };

describe('archive ordering (FR-018, FR-023)', () => {
  it('[WP08] one version per matched file, appended after the explicit specs in path order', () => {
    const root = releaseSite();
    writeFiles(root, { 'openapi/v1.yaml': specText('Parcels API', '1.0.0') });
    const specs = materialised(root, { specs: [v1], archive: { ...RELEASES } });
    expect(specs.map((s) => s.label)).toEqual(['v1', 'v1-0-0', 'v1-1-0', 'v2-0-0']);
    expect(specs.map((s) => s.origin)).toEqual(['file', 'archive', 'archive', 'archive']);
  });

  it('[WP08] sorts matches by POSIX relative path in code-point order, not version order', () => {
    const root = makeSite({
      'openapi/api-v2.yaml': specText('Archive API', '2.0.0'),
      'openapi/api-v10.yaml': specText('Archive API', '10.0.0'),
    });
    const specs = materialised(root, { archive: { glob: 'openapi/api-v*.yaml', labelPattern: 'api-(v\\d+)' } });
    expect(specs.map((s) => s.label)).toEqual(['v10', 'v2']);
  });

  it('[WP08] lists the same order on every run (three files to three versions)', () => {
    const root = releaseSite();
    const option = { archive: { ...RELEASES } };
    expect(materialised(root, option).map((s) => s.label)).toEqual(
      materialised(root, option).map((s) => s.label),
    );
  });
});

describe('archive match materialisation', () => {
  it("[WP08] carries the file's bytes, sha256, renderPath, statistics and operations", () => {
    const root = releaseSite();
    const [first] = materialised(root, { archive: { ...RELEASES } });
    expect(first).toBeDefined();
    const file = path.join(root, 'openapi', 'releases', 'api-v1-0-0.yaml');
    const bytes = readFileSync(file);
    expect(first!.bytes.equals(bytes)).toBe(true);
    expect(first!.sha256).toBe(sha256(bytes));
    expect(first!.renderPath).toBe(file);
    expect(first!.ext).toBe('yaml');
    expect(first!.title).toBe('Archive API');
    expect(first!.apiVersion).toBe('1.0.0');
    expect(first!.operations.map((op: { method: string; path: string }) => [op.method, op.path])).toEqual([
      ['GET', '/parcels'],
    ]);
  });

  it('[WP08] derives the label from the capturing group and lower-cases it', () => {
    const root = makeSite({
      'openapi/api-vBETA.yaml': specText('Beta API', '2.0.0'),
      'openapi/api-v1.yaml': specText('One API', '1.0.0'),
    });
    const specs = materialised(root, { archive: { glob: 'openapi/api-*.yaml', labelPattern: 'api-(.+)\\.yaml' } });
    expect(specs.map((s) => s.label)).toEqual(['v1', 'vbeta']);
  });

  it('[WP08] archives are released by default, and the option can mark them unreleased', () => {
    const root = releaseSite();
    expect(materialised(root, { archive: { ...RELEASES } }).every((s) => s.released)).toBe(true);
    expect(
      materialised(root, { archive: { ...RELEASES, released: false } }).every((s) => s.released === false),
    ).toBe(true);
  });

  it('[WP08] accepts yml and json matches', () => {
    const root = makeSite({ 'openapi/api-v1.yml': specText('Yml API', '1.0.0') });
    expect(materialised(root, { archive: { glob: 'openapi/*.yml', labelPattern: 'api-(.+)\\.yml' } })[0]!.ext).toBe('yml');
  });

  it('[WP08] accepts a symlink whose real target stays inside the site root', () => {
    const root = makeSite({ 'openapi/targets/api-v3-0-0.yaml': specText('Linked API', '3.0.0') });
    mkdirSync(path.join(root, 'openapi', 'releases'), { recursive: true });
    symlinkSync(
      path.join(root, 'openapi', 'targets', 'api-v3-0-0.yaml'),
      path.join(root, 'openapi', 'releases', 'api-v3-0-0.yaml'),
    );
    const [spec] = materialised(root, { archive: { ...RELEASES } });
    const target = path.join(root, 'openapi', 'targets', 'api-v3-0-0.yaml');
    expect(spec!.label).toBe('v3-0-0');
    expect(spec!.renderPath).toBe(target);
    expect(spec!.bytes.equals(readFileSync(target))).toBe(true);
  });

  it('[WP08] ignores a directory the glob happens to match (regular files only)', () => {
    const root = releaseSite();
    mkdirSync(path.join(root, 'openapi', 'releases', 'api-v9-9-9.yaml'));
    const specs = materialised(root, { archive: { ...RELEASES } });
    expect(specs.map((s) => s.label)).toEqual(['v1-0-0', 'v1-1-0', 'v2-0-0']);
  });
});

describe('archive fail-closed (FR-022, FR-028)', () => {
  it('[WP08] refuses a glob that matches no file', () => {
    const root = makeSite({
      'openapi/api.yaml': specText('Parcels API', '1.0.0'),
      'openapi/v1.yaml': specText('Parcels API v1', '1.0.0'),
    });
    expect(() =>
      materialised(root, { specs: [v1], archive: { glob: 'openapi/none/*.yaml', labelPattern: 'api-(v.+)' } }),
    ).toThrow(/^\[dk-openapi\] archive "openapi\/none\/\*\.yaml": no files match/);
  });

  it('[WP08] refuses a glob whose files the label pattern does not match', () => {
    const root = makeSite({ 'openapi/other.yaml': specText('Other API', '1.0.0') });
    expect(() => materialised(root, { archive: { glob: 'openapi/*.yaml', labelPattern: 'api-(v\\d+)' } })).toThrow(
      /no files match the label pattern/,
    );
  });

  it('[WP08] refuses an empty derived label, naming the file', () => {
    const root = makeSite({ 'openapi/api-v-.yaml': specText('Empty API', '1.0.0') });
    expect(() => materialised(root, { archive: { glob: 'openapi/api-v*.yaml', labelPattern: 'api-v-(\\d*)' } })).toThrow(
      /^\[dk-openapi\] archive "openapi\/api-v\*\.yaml": empty label.*api-v-\.yaml/,
    );
  });

  it('[WP08] refuses a derived label containing a dot, because the renderer drops dots from routes', () => {
    const root = makeSite({ 'openapi/api-v1.0.0.yaml': specText('Dotted API', '1.0.0') });
    expect(() =>
      materialised(root, { archive: { glob: 'openapi/*.yaml', labelPattern: 'api-(v[\\d.]+)\\.yaml' } }),
    ).toThrow(/derived label "v1\.0\.0" contains "\.".*api-v1\.0\.0\.yaml/);
  });

  it('refuses a derived label of "index", which routes as the section page', () => {
    const root = makeSite({ 'openapi/api-Index.yaml': specText('Index API', '1.0.0') });
    expect(() =>
      materialised(root, { archive: { glob: 'openapi/*.yaml', labelPattern: 'api-(.+)\\.yaml' } }),
    ).toThrow(/derived label "index" is reserved.*api-Index\.yaml/);
  });

  it('[WP08] refuses a derived label with characters a route segment cannot carry', () => {
    const root = makeSite({ 'openapi/api-v1 beta.yaml': specText('Space API', '1.0.0') });
    expect(() => materialised(root, { archive: { glob: 'openapi/*.yaml', labelPattern: 'api-(v1 beta)' } })).toThrow(
      /derived label "v1 beta" must use only/,
    );
  });

  it('[WP08] refuses a duplicate label against an explicit spec', () => {
    const root = makeSite({
      'openapi/api.yaml': specText('Parcels API', '1.0.0'),
      'openapi/api-v1.yaml': specText('Archive API', '1.0.0'),
    });
    expect(() =>
      materialised(root, {
        specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
        archive: { glob: 'openapi/api-v*.yaml', labelPattern: 'api-(v\\d+)' },
      }),
    ).toThrow(/archive "openapi\/api-v\*\.yaml": duplicate label "v1".*explicit spec.*api-v1\.yaml/);
  });

  it('[WP08] refuses a duplicate label between two archive matches, naming both', () => {
    const root = makeSite({
      'openapi/a-v1.yaml': specText('A API', '1.0.0'),
      'openapi/b-v1.yaml': specText('B API', '1.0.0'),
    });
    expect(() => materialised(root, { archive: { glob: 'openapi/*.yaml', labelPattern: '(v\\d+)' } })).toThrow(
      /duplicate label "v1": openapi\/a-v1\.yaml and openapi\/b-v1\.yaml/,
    );
  });

  it(`[WP08] refuses more than ${MAX_ARCHIVE_MATCHES} matches, naming the limit`, () => {
    const root = makeSite();
    const files: Record<string, string> = {};
    for (let i = 0; i <= MAX_ARCHIVE_MATCHES; i += 1) files[`openapi/releases/api-v${i}-0-0.yaml`] = specText('Many API', '1.0.0');
    writeFiles(root, files);
    expect(() => materialised(root, { archive: { ...RELEASES } })).toThrow(
      new RegExp(`archive glob matches ${MAX_ARCHIVE_MATCHES + 1} files, over the limit of ${MAX_ARCHIVE_MATCHES}`),
    );
  });

  it(`[WP08] accepts exactly ${MAX_ARCHIVE_MATCHES} matches`, () => {
    const root = makeSite();
    const files: Record<string, string> = {};
    for (let i = 0; i < MAX_ARCHIVE_MATCHES; i += 1) files[`openapi/releases/api-v${i}-0-0.yaml`] = specText('Many API', '1.0.0');
    writeFiles(root, files);
    expect(materialised(root, { archive: { ...RELEASES } })).toHaveLength(MAX_ARCHIVE_MATCHES);
  });

  it('[WP08] refuses a matched file whose extension would publish an unknown raw document', () => {
    const root = makeSite({ 'openapi/api-v1.txt': specText('Text API', '1.0.0') });
    expect(() => materialised(root, { archive: { glob: 'openapi/*.txt', labelPattern: 'api-(.+)\\.txt' } })).toThrow(
      /must end in \.yaml, \.yml or \.json/,
    );
  });

  it('[WP08] refuses a match that realpaths outside the site root through a symlink', () => {
    const root = makeSite();
    const outside = `${root}-outside.yaml`;
    ROOTS.push(outside);
    writeFileSync(outside, specText('Outside API', '1.0.0'));
    mkdirSync(path.join(root, 'openapi', 'releases'), { recursive: true });
    symlinkSync(outside, path.join(root, 'openapi', 'releases', 'api-v3-0-0.yaml'));
    expect(() => materialised(root, { archive: { ...RELEASES } })).toThrow(
      /archive "openapi\/releases\/\*\.yaml": .*escapes the site root.*api-v3-0-0\.yaml/,
    );
  });

  it('[WP08] refuses an absolute glob if the static check is bypassed', () => {
    const root = makeSite();
    expect(() => scanned(root, { glob: '/etc/*.yaml', labelPattern: '(.+)', released: true })).toThrow(
      /^\[dk-openapi\] archive "\/etc\/\*\.yaml": archive glob must be relative/,
    );
  });

  it('[WP08] refuses a glob with a ".." segment if the static check is bypassed', () => {
    const root = makeSite();
    expect(() => scanned(root, { glob: '../outside/*.yaml', labelPattern: '(.+)', released: true })).toThrow(
      /archive glob must be relative to the site root and stay inside it/,
    );
  });

  it('[WP08] refuses an invalid label pattern if the static check is bypassed', () => {
    const root = makeSite();
    expect(() => scanned(root, { glob: 'openapi/*.yaml', labelPattern: '(', released: true })).toThrow(
      /labelPattern must compile as a regular expression/,
    );
  });

  it('[WP08] refuses a label pattern without a capturing group if the static check is bypassed', () => {
    const root = makeSite();
    expect(() => scanned(root, { glob: 'openapi/*.yaml', labelPattern: 'api-v\\d+', released: true })).toThrow(
      /labelPattern must have exactly one capturing group/,
    );
  });
});
