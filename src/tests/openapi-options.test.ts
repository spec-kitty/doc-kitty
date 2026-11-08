/**
 * The `openapi` option (FR-001, FR-007, FR-010): fail-closed validation and the
 * renderer option.
 *
 * WP02 (mission openapi-second-slice-01M6WXJ4): `normaliseOpenApiOptions` is
 * STATIC-only — every check that needs no filesystem or network. Reading,
 * parsing and the structural document checks are `materialiseOpenApiSpecs`'s
 * (openapi-materialise.test.ts). Proven here:
 *
 *  - every bad shape is refused with a `[dk-openapi]` message that names the
 *    entry (index and label);
 *  - a valid two-spec option normalises to the expected shape, and the archive
 *    and remote entries normalise with their own fields;
 *  - the flags (`llmsOperations`, `offline`) type-check and default;
 *  - `renderer` is required and must be a function (the adopter imports the peer);
 *  - `parseDocument` (the `yaml` parse behind materialisation) parses plain
 *    values and throws a MARKED error on an over-limit alias count;
 *  - the toolkit imports neither peer anywhere under `lib/`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseOpenApiOptions, parseDocument } from '../lib/openapi/options.mjs';

const PKG_DIR = fileURLToPath(new URL('../', import.meta.url));

let root: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-openapi-'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const spec = (over: Record<string, unknown> = {}) => ({
  path: 'openapi/v1.yaml',
  label: 'v1',
  released: true,
  ...over,
});
const renderer = () => ({});
const run = (option: unknown) =>
  normaliseOpenApiOptions(option && typeof option === 'object' && !('renderer' in option) ? { renderer, ...option } : option, {
    siteRoot: root,
  });
const runSpec = (over: Record<string, unknown>) => run({ specs: [spec(over)] });

describe('normaliseOpenApiOptions: valid options', () => {
  it('normalises a two-spec config, with the default section', () => {
    const out = run({
      specs: [spec({ label: 'V1-2-0' }), spec({ path: 'openapi/main.json', label: 'main', released: false })],
    });
    expect(out).toEqual({
      renderer,
      section: 'reference/api',
      specs: [
        { kind: 'file', path: 'openapi/v1.yaml', absPath: path.join(root, 'openapi/v1.yaml'), label: 'v1-2-0', released: true, ext: 'yaml' },
        { kind: 'file', path: 'openapi/main.json', absPath: path.join(root, 'openapi/main.json'), label: 'main', released: false, ext: 'json' },
      ],
      llmsOperations: false,
      offline: false,
    });
  });

  it('accepts a .yml file and a custom nested section', () => {
    const out = run({ section: 'docs/rest-api', specs: [spec({ path: 'openapi/v0.yml' })] });
    expect(out.section).toBe('docs/rest-api');
    expect(out.specs[0].ext).toBe('yml');
  });

  it('normalises a remote spec with its pinned digest, from the URL extension', () => {
    const out = runSpec({ path: undefined, url: 'https://specs.example.test/api/v2.yaml?token=x', sha256: 'a'.repeat(64) });
    expect(out.specs[0]).toEqual({
      kind: 'remote',
      label: 'v1',
      released: true,
      ext: 'yaml',
      url: 'https://specs.example.test/api/v2.yaml?token=x',
      sha256: 'a'.repeat(64),
    });
  });

  it('keeps an optional sha256 pin on a file spec, and omits it when absent', () => {
    expect(runSpec({ sha256: 'b'.repeat(64) }).specs[0].sha256).toBe('b'.repeat(64));
    expect(runSpec({}).specs[0].sha256).toBeUndefined();
  });

  it('normalises the archive option, defaulting released to true', () => {
    const out = run({ specs: [], archive: { glob: 'openapi/*.yaml', labelPattern: 'v(\\d+)' } });
    expect(out.specs).toEqual([]);
    expect(out.archive).toEqual({ glob: 'openapi/*.yaml', labelPattern: 'v(\\d+)', released: true });
  });
});

describe('normaliseOpenApiOptions: refusals', () => {
  it('refuses a non-object option', () => {
    expect(() => run('yes')).toThrow('[dk-openapi] the openapi option must be an object');
  });

  it('refuses a spec with neither path nor url, or with both', () => {
    expect(() => runSpec({ path: undefined })).toThrow(
      '[dk-openapi] specs[0] "v1": exactly one of "path" and "url" is required',
    );
    expect(() => runSpec({ url: 'https://x.test/a.yaml' })).toThrow('exactly one of "path" and "url" is required');
  });

  it('refuses duplicate labels, case-insensitively', () => {
    expect(() => run({ specs: [spec({ label: 'Main' }), spec({ label: 'main' })] })).toThrow(
      '[dk-openapi] specs[1] "main": duplicate label (same as specs[0], case-insensitive)',
    );
  });

  // ".." hits the dot branch first; both refusals are the label rule's.
  it.each(['v 1', 'v/1', 'vé', '..', 'v1!'])('refuses the unsafe label %j', (label) => {
    expect(() => runSpec({ label })).toThrow(/label may (not contain|use only)/);
  });

  it('refuses a dotted label, suggesting a hyphen (maintainer decision 2026-11-08)', () => {
    expect(() => runSpec({ label: 'v1.1' })).toThrow(
      '[dk-openapi] specs[0] "v1.1": label may not contain "." (the renderer drops dots from routes); use a hyphen instead, for example "v1-1"',
    );
    expect(() => runSpec({ label: 'V1.2.0', path: 'openapi/main.json' })).toThrow(/label may not contain "."/);
  });

  it('refuses a missing label', () => {
    expect(() => runSpec({ label: undefined })).toThrow('specs[0]: "label" is required');
  });

  it.each([undefined, 'true', 1])('refuses released = %j', (released) => {
    expect(() => runSpec({ released })).toThrow('[dk-openapi] specs[0] "v1": "released" is required and must be true or false');
  });

  it('refuses an unsupported file extension', () => {
    expect(() => runSpec({ path: 'openapi/v1.txt' })).toThrow('the file must end in .yaml, .yml or .json');
  });

  it('refuses a bad sha256 pin on a file spec', () => {
    expect(() => runSpec({ sha256: 'XYZ' })).toThrow('"sha256" must be 64 lowercase hex characters');
  });

  it.each([undefined, [], 'x'])('refuses specs = %j without an archive', (specs) => {
    expect(() => run({ specs })).toThrow(
      '[dk-openapi] "specs" must list at least one version (or set "archive")',
    );
  });

  it('refuses a non-array specs with an archive', () => {
    expect(() => run({ specs: 'x', archive: { glob: 'openapi/*.yaml', labelPattern: 'v(\\d+)' } })).toThrow(
      '[dk-openapi] "specs" must be an array',
    );
  });

  it.each(['Bad Section', 'a//b', '/abs', 'a/', '../x', 'a/../b', 5])('refuses the unsafe section %j', (section) => {
    expect(() => run({ section, specs: [spec()] })).toThrow(/\[dk-openapi\] section .*: /);
  });

  it.each(['api', 'api/v1'])('refuses the reserved section %j', (section) => {
    expect(() => run({ section, specs: [spec()] })).toThrow('"api/" is reserved for the agent API');
  });

  it('refuses a dotted section segment exactly like a dotted label, suggesting a hyphen (#259)', () => {
    expect(() => run({ section: 'docs/v1.1', specs: [spec()] })).toThrow(
      'a segment may not contain "." (the renderer drops dots from routes); use a hyphen instead, for example "v1-1"',
    );
  });

  it('still accepts a hyphenated section', () => {
    expect(run({ section: 'docs/v1-1', specs: [spec()] }).section).toBe('docs/v1-1');
  });

  it('allows a section that only starts with "api"', () => {
    expect(run({ section: 'apis', specs: [spec()] }).section).toBe('apis');
  });
});

describe('normaliseOpenApiOptions: remote specs (static checks)', () => {
  const remote = (over: Record<string, unknown> = {}) =>
    runSpec({ path: undefined, url: 'https://specs.example.test/api.yaml', ...over });

  it('refuses a url that is not a URL', () => {
    expect(() => remote({ url: 'not a url' })).toThrow('"url" must be a valid URL (not a url)');
  });

  it('refuses a non-https url, with the query string redacted', () => {
    expect(() => remote({ url: 'http://specs.example.test/api.yaml?token=secret' })).toThrow(
      'https is required for a remote spec (http://specs.example.test/api.yaml?…)',
    );
  });

  it('refuses userinfo in the url', () => {
    expect(() => remote({ url: 'https://user:pass@specs.example.test/api.yaml' })).toThrow(
      'userinfo is not allowed in a remote spec url',
    );
  });

  it('refuses a url without a known extension', () => {
    expect(() => remote({ url: 'https://specs.example.test/api.txt' })).toThrow(
      'the url must end in .yaml, .yml or .json',
    );
  });

  it('refuses a remote spec without a sha256', () => {
    expect(() => remote({ sha256: undefined })).toThrow('sha256 is required for a remote spec');
  });

  it('refuses a remote sha256 that is not 64 lowercase hex', () => {
    expect(() => remote({ sha256: 'ABC' })).toThrow('"sha256" must be 64 lowercase hex characters');
  });
});

describe('normaliseOpenApiOptions: the archive option (static checks)', () => {
  const archive = (over: Record<string, unknown> = {}) =>
    run({ specs: [], archive: { glob: 'openapi/*.yaml', labelPattern: 'v(\\d+)', ...over } });

  it('refuses a non-object archive', () => {
    expect(() => run({ specs: [spec()], archive: 'x' })).toThrow('[dk-openapi] "archive" must be an object');
  });

  it('refuses a missing glob', () => {
    expect(() => archive({ glob: undefined })).toThrow('[dk-openapi] "archive".glob is required');
  });

  it.each(['/abs/*.yaml', 'openapi/../../etc/*.yaml'])('refuses the unsafe glob %j', (glob) => {
    expect(() => archive({ glob })).toThrow(
      /archive glob must be relative to the site root and stay inside it/,
    );
  });

  it('refuses a missing labelPattern', () => {
    expect(() => archive({ labelPattern: undefined })).toThrow(
      '[dk-openapi] archive "openapi/*.yaml": "archive".labelPattern is required',
    );
  });

  it('refuses a labelPattern that does not compile', () => {
    expect(() => archive({ labelPattern: '(' })).toThrow('must compile as a regular expression');
  });

  it.each([['zero groups', 'v\\d+'], ['two groups', 'v(\\d)(\\d)']])(
    'refuses a labelPattern with %s',
    (_name, labelPattern) => {
      expect(() => archive({ labelPattern: labelPattern as string })).toThrow(
        'must have exactly one capturing group',
      );
    },
  );

  it('refuses a non-boolean released', () => {
    expect(() => archive({ released: 'yes' })).toThrow('"archive"."released" must be true or false');
  });
});

describe('the flags', () => {
  it('refuses a non-boolean llmsOperations', () => {
    expect(() => run({ specs: [spec()], llmsOperations: 'yes' })).toThrow('"llmsOperations" must be true or false');
  });

  it('refuses a non-boolean offline', () => {
    expect(() => run({ specs: [spec()], offline: 'yes' })).toThrow('"offline" must be true or false');
  });

  it('defaults llmsOperations to false and offline from DOCKITTY_OFFLINE', () => {
    expect(run({ specs: [spec()] }).llmsOperations).toBe(false);
    expect(run({ specs: [spec()], llmsOperations: true }).llmsOperations).toBe(true);
    const was = process.env.DOCKITTY_OFFLINE;
    process.env.DOCKITTY_OFFLINE = '1';
    try {
      expect(run({ specs: [spec()] }).offline).toBe(true);
    } finally {
      if (was === undefined) delete process.env.DOCKITTY_OFFLINE;
      else process.env.DOCKITTY_OFFLINE = was;
    }
    expect(run({ specs: [spec()] }).offline).toBe(false);
    expect(run({ specs: [spec()], offline: true }).offline).toBe(true);
  });
});

describe('parseDocument (the parse behind materialisation)', () => {
  it('parses YAML and JSON text to a plain value', () => {
    expect(parseDocument('a: 1\nb: [x, y]\n')).toEqual({ a: 1, b: ['x', 'y'] });
    expect(parseDocument('{"a": 1}')).toEqual({ a: 1 });
  });

  it('throws the parser error on an unparsable document', () => {
    expect(() => parseDocument('a: [unclosed\n')).toThrow();
  });

  it('throws a MARKED error over the alias limit, and passes at it', () => {
    expect(() => parseDocument('a: &x 1\nb: *x\n', { maxAliasCount: 1 })).not.toThrow();
    const lines = ['k:'];
    for (let i = 0; i < 2; i += 1) lines.push(`  a${i}: &v${i} 1`, `  b${i}: *v${i}`);
    try {
      parseDocument(`${lines.join('\n')}\n`, { maxAliasCount: 1 });
      expect.unreachable('the alias limit must throw');
    } catch (error) {
      expect((error as { dkOpenApiAliasLimit?: boolean }).dkOpenApiAliasLimit).toBe(true);
      expect((error as Error).message).toMatch(/alias/i);
    }
  });
});

describe('renderer (decision: injected by the adopter)', () => {
  const MESSAGE =
    "[dk-openapi] \"renderer\" is required: add import starlightOpenAPI from 'starlight-openapi' to astro.config and pass renderer: starlightOpenAPI";
  const raw = (over: Record<string, unknown>) => normaliseOpenApiOptions({ specs: [spec()], ...over }, { siteRoot: root });

  it('is returned unchanged', () => {
    expect(raw({ renderer }).renderer).toBe(renderer);
  });

  it.each([
    ['missing', undefined],
    ['a string', 'starlight-openapi'],
    ['an object (a namespace import)', { default: renderer }],
    ['null', null],
  ])('refuses a renderer that is %s, showing the import line', (_name, value) => {
    expect(() => raw({ renderer: value })).toThrow(MESSAGE);
  });
});

describe('the peers cost nothing without the option (FR-010)', () => {
  const PEER = /['"](?:starlight-openapi|@astrojs\/markdown-satteri)(?:\/[^'"]*)?['"]/;
  // A real import: a statement that starts with import/export ... from, a bare
  // `import 'x'`, or a call to import()/require(). Prose in an error message does not match.
  const IMPORTING = /^\s*(?:import|export)\b[^'"]*(?:from\s*)?['"]|\b(?:import|require)\s*\(/;

  function walk(dir: string, out: string[]): string[] {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|mts|mjs|js|astro)$/.test(name)) out.push(full);
    }
    return out;
  }

  it('imports neither peer anywhere under lib/', () => {
    const libDir = path.join(PKG_DIR, 'lib');
    const offenders = walk(libDir, [])
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && IMPORTING.test(line) && PEER.test(line)),
      )
      .map((file) => path.relative(libDir, file));
    expect(offenders).toEqual([]);
  });
});
