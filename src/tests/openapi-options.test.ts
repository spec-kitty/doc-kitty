/**
 * The `openapi` option (FR-001, FR-007, FR-010): fail-closed validation and the
 * renderer option.
 *
 * Proven here:
 *  - every bad shape is refused with a `[dk-openapi]` message that names the entry
 *    (index and label) and, for a file problem, the file;
 *  - a valid two-spec option normalises to the expected shape, and a valid 3.0
 *    document passes;
 *  - `renderer` is required and must be a function (the adopter imports the peer);
 *  - the toolkit imports neither peer anywhere under `lib/`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseOpenApiOptions } from '../lib/openapi/options.mjs';

const PKG_DIR = fileURLToPath(new URL('../', import.meta.url));

const V31 = 'openapi: 3.1.0\ninfo: { title: T, version: "1" }\npaths: {}\n';
const V30 = 'openapi: 3.0.3\ninfo: { title: T, version: "1" }\npaths: {}\n';

let root: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-openapi-'));
  mkdirSync(path.join(root, 'openapi'));
  const put = (name: string, text: string) => writeFileSync(path.join(root, 'openapi', name), text);
  put('v1.yaml', V31);
  put('v0.yml', V30);
  put('main.json', JSON.stringify({ openapi: '3.1.0', info: {}, paths: {} }));
  put('empty.yaml', '  \n');
  put('swagger.yaml', 'swagger: "2.0"\ninfo: {}\npaths: {}\n');
  put('v2.yaml', 'openapi: 2.1.0\ninfo: {}\npaths: {}\n');
  put('noinfo.yaml', 'openapi: 3.1.0\npaths: {}\n');
  put('nopaths.yaml', 'openapi: 3.1.0\ninfo: {}\n');
  put(
    'multi.yaml',
    'openapi: 3.1.0\ninfo: {}\npaths:\n  /a:\n    get:\n      responses:\n        "200":\n          $ref: "./other.yaml#/R"\n',
  );
  put(
    'internal.yaml',
    'openapi: 3.1.0\ninfo: {}\npaths: {}\ncomponents:\n  schemas:\n    A: { $ref: "#/components/schemas/B" }\n    B: { type: string }\n',
  );
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
      specs: [spec({ label: 'V1.2.0' }), spec({ path: 'openapi/main.json', label: 'main', released: false })],
    });
    expect(out).toEqual({
      renderer,
      section: 'reference/api',
      specs: [
        { path: 'openapi/v1.yaml', absPath: path.join(root, 'openapi/v1.yaml'), label: 'v1.2.0', released: true, ext: 'yaml' },
        { path: 'openapi/main.json', absPath: path.join(root, 'openapi/main.json'), label: 'main', released: false, ext: 'json' },
      ],
    });
  });

  it('accepts a 3.0 document, a .yml file and a custom nested section', () => {
    const out = run({ section: 'docs/rest-api', specs: [spec({ path: 'openapi/v0.yml' })] });
    expect(out.section).toBe('docs/rest-api');
    expect(out.specs[0].ext).toBe('yml');
  });

  it('accepts an internal $ref', () => {
    expect(() => runSpec({ path: 'openapi/internal.yaml' })).not.toThrow();
  });
});

describe('normaliseOpenApiOptions: refusals', () => {
  it('refuses a non-object option', () => {
    expect(() => run('yes')).toThrow('[dk-openapi] the openapi option must be an object');
  });

  it('refuses a missing path, naming the entry', () => {
    expect(() => runSpec({ path: undefined })).toThrow('[dk-openapi] specs[0] "v1": "path" is required');
  });

  it('refuses an unreadable file, naming entry and file', () => {
    expect(() => runSpec({ path: 'openapi/nope.yaml' })).toThrow(
      '[dk-openapi] specs[0] "v1": cannot read the file (openapi/nope.yaml)',
    );
  });

  it('refuses a directory as unreadable', () => {
    expect(() => runSpec({ path: 'openapi.yaml' })).toThrow('cannot read the file');
  });

  it('refuses an empty file', () => {
    expect(() => runSpec({ path: 'openapi/empty.yaml' })).toThrow(
      '[dk-openapi] specs[0] "v1": the file is empty (openapi/empty.yaml)',
    );
  });

  it('refuses Swagger 2 with a 3.x message', () => {
    expect(() => runSpec({ path: 'openapi/swagger.yaml' })).toThrow(/Swagger 2\.0 is not supported: OpenAPI 3\.x required/);
  });

  it('refuses a document that is not OpenAPI 3.0 or 3.1', () => {
    expect(() => runSpec({ path: 'openapi/v2.yaml' })).toThrow(/not OpenAPI 3\.0 or 3\.1.*3\.x required/);
  });

  it('refuses a document without info, or without paths/webhooks/components', () => {
    expect(() => runSpec({ path: 'openapi/noinfo.yaml' })).toThrow('"info" must be an object');
    expect(() => runSpec({ path: 'openapi/nopaths.yaml' })).toThrow(
      'one of "paths", "webhooks" or "components" must be an object',
    );
  });

  it('refuses an external $ref', () => {
    expect(() => runSpec({ path: 'openapi/multi.yaml' })).toThrow(
      /references another file \(\/paths.*\$ref -> \.\/other\.yaml#\/R\).*\(openapi\/multi\.yaml\)/,
    );
  });

  it('refuses duplicate labels, case-insensitively', () => {
    expect(() => run({ specs: [spec({ label: 'Main' }), spec({ label: 'main' })] })).toThrow(
      '[dk-openapi] specs[1] "main": duplicate label (same as specs[0], case-insensitive)',
    );
  });

  it.each(['v 1', 'v/1', 'vé', '..', 'v1!'])('refuses the unsafe label %j', (label) => {
    expect(() => runSpec({ label })).toThrow(/label may use only a-z, 0-9, "\.", "_" and "-"/);
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

  it.each([undefined, [], 'x'])('refuses specs = %j', (specs) => {
    expect(() => run({ specs })).toThrow('[dk-openapi] "specs" must list at least one version');
  });

  it.each(['Bad Section', 'a//b', '/abs', 'a/', '../x', 'a/../b', 5])('refuses the unsafe section %j', (section) => {
    expect(() => run({ section, specs: [spec()] })).toThrow(/\[dk-openapi\] section .*: /);
  });

  it.each(['api', 'api/v1'])('refuses the reserved section %j', (section) => {
    expect(() => run({ section, specs: [spec()] })).toThrow('"api/" is reserved for the agent API');
  });

  it('allows a section that only starts with "api"', () => {
    expect(run({ section: 'apis', specs: [spec()] }).section).toBe('apis');
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
