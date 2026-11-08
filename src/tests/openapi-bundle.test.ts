/**
 * The bundler, the Swagger 2 source and the `$ref` gate (mission
 * openapi-second-slice-01M6WXJ4, WP09; FR-019, FR-020, FR-022, FR-028, C-006).
 *
 * A multi-file definition (any external `$ref`) is bundled by
 * `@readme/openapi-parser` behind a synchronous pre-walk that fails closed on
 * every FR-028 ref bound BEFORE the parser runs: folder escape, non-file
 * schemes, absolute paths, encoded separators, symlink escapes, unresolvable
 * targets, external cycles (naming the chain) and the count/depth limits. The
 * positive cases prove the bundled artefact: deterministic serialisation, the
 * bytes and their sha256 written through the shared cache writer, internal
 * cycles preserved, and — for a Swagger 2.0 document — the ORIGINAL bytes
 * published with the conversion left to the renderer (FR-020).
 *
 * The rejected rows mirror the seam suite's: fixtures under
 * `fixtures/openapi/rejected/`, an in-process `materialiseOpenApiSpecs` call on
 * a chdir-free throwaway site. The bundler child is also run DIRECTLY, without
 * the parent's pre-walk, to prove its own fail-closed defences: the network
 * resolver off and the containment re-check on every file it opens. The
 * two-build compare runs real `astro build`s
 * of the `multi-file` fixture (NFR-001: the bundled bytes a site publishes
 * must not drift between two cold builds).
 *
 * Every case is titled `[WP09]`: red until this work package lands.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIXTURES,
  removeOpenApiFixtureBuilds,
  twoBuilds,
} from './helpers/openapi-build';
import { materialiseOpenApiSpecs } from '../lib/openapi/materialise.mjs';
import { normaliseOpenApiOptions, parseDocument } from '../lib/openapi/options.mjs';
import { MAX_REF_COUNT, MAX_REF_DEPTH } from '../lib/openapi/limits.mjs';

const sha = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/** The renderer factory the option requires; never called for a rejected input. */
const renderer = () => ({});

type Spec = ReturnType<typeof materialiseOpenApiSpecs>[number];

let cwd: string;
let site: string;

beforeAll(() => {
  cwd = process.cwd();
  site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-bundle-'));
  mkdirSync(path.join(site, 'docs'), { recursive: true });
  cpSync(path.join(FIXTURES, 'multi-file'), path.join(site, 'openapi'), { recursive: true });
  mkdirSync(path.join(site, 'openapi', 'swagger2'), { recursive: true });
  cpSync(path.join(FIXTURES, 'swagger2'), path.join(site, 'openapi', 'swagger2'), { recursive: true });
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(site, { recursive: true, force: true });
  removeOpenApiFixtureBuilds();
});

/** Materialise one spec entry (default: the multi-file fixture's entry.yaml). */
const materialised = (over: Record<string, unknown> = {}): Spec[] =>
  materialiseOpenApiSpecs(
    normaliseOpenApiOptions(
      { renderer, specs: [{ path: 'openapi/entry.yaml', label: 'v1', released: true }], ...over },
      { siteRoot: site },
    ),
    { siteRoot: site, offline: false, cacheDir: path.join(site, '.cache') },
  );

/** Resolve a JSON pointer into a parsed document (fixed, known-safe segments). */
const pointer = (doc: unknown, ref: string): unknown =>
  ref
    .split('/')
    .slice(1)
    .reduce<unknown>((node, segment) => (node as Record<string, unknown> | undefined)?.[segment], doc);

describe('bundling and Swagger 2 (FR-019, FR-020)', () => {
  it('[WP09] bundles a multi-file definition: origin, bytes, sha256 and a cached renderPath', () => {
    const specs = materialised();
    expect(specs).toHaveLength(1);
    const spec = specs[0]!;
    expect(spec.label).toBe('v1');
    expect(spec.released).toBe(true);
    expect(spec.origin).toBe('bundle');
    expect(spec.ext).toBe('yaml');
    expect(spec.title).toBe('Multi-file pets API');
    expect(spec.apiVersion).toBe('1.0.0');
    expect(spec.sha256).toBe(sha(spec.bytes));
    // The renderer's input is the cache entry the bundled bytes were written to.
    expect(spec.renderPath).toBe(path.join(site, '.cache', `${spec.sha256}.yaml`));
    expect(readFileSync(spec.renderPath).equals(spec.bytes)).toBe(true);
    expect(spec.operations.map((o) => [o.method, o.path, o.operationId])).toEqual([['GET', '/pets', 'listPets']]);
  });

  it('[WP09] inlines every external $ref and preserves internal cycles', () => {
    const doc = parseDocument(materialised()[0]!.bytes.toString('utf8'));
    const refs: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (key === '$ref' && typeof value === 'string') refs.push(value);
          else walk(value);
        }
      }
    };
    walk(doc);
    // Every remaining $ref is an internal pointer: no file reference survives.
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((ref) => ref.startsWith('#/'))).toBe(true);
    // The self-referencing list item stays an internal cycle…
    expect(pointer(doc, '/components/schemas/PetList/properties/self')).toEqual({
      $ref: '#/components/schemas/PetList',
    });
    // …and the schema from schemas/pet.yaml is inlined where it was referenced.
    expect(pointer(doc, '/components/schemas/PetList/properties/first/required')).toEqual(['id', 'name']);
  });

  it('[WP09] serialises deterministically: two materialisations give identical bundled bytes', () => {
    const first = materialised()[0]!;
    const second = materialised()[0]!;
    expect(second.bytes.equals(first.bytes)).toBe(true);
    expect(second.sha256).toBe(first.sha256);
  });

  it('[WP09] accepts a Swagger 2.0 document with its original bytes (FR-020)', () => {
    const specs = materialised({
      specs: [{ path: 'openapi/swagger2/petstore.json', label: 'v2', released: true }],
    });
    const spec = specs[0]!;
    expect(spec.origin).toBe('swagger2');
    expect(spec.ext).toBe('json');
    // Original bytes, original file: any conversion happens in memory only.
    expect(spec.bytes.equals(readFileSync(path.join(site, 'openapi', 'swagger2', 'petstore.json')))).toBe(true);
    expect(spec.sha256).toBe(sha(spec.bytes));
    expect(spec.renderPath).toBe(path.join(site, 'openapi', 'swagger2', 'petstore.json'));
    expect(spec.title).toBe('Swagger 2 petstore');
    expect(spec.apiVersion).toBe('1.0.0');
    expect(spec.operations.map((o) => [o.method, o.path, o.operationId])).toEqual([['GET', '/pets', 'listPets']]);
  });
});

describe('Swagger 2.0 documents must be self-contained (FR-022, ADR-0078 s3)', () => {
  const swagger = (schema: Record<string, unknown>) =>
    JSON.stringify({
      swagger: '2.0',
      info: { title: 'S2', version: '1.0.0' },
      paths: { '/pets': { get: { operationId: 'listPets', responses: { 200: { description: 'ok', schema } } } } },
      definitions: { Pet: { type: 'object' } },
    });
  const run = (body: string) => {
    mkdirSync(path.join(site, 'openapi', 'swagger2'), { recursive: true });
    writeFileSync(path.join(site, 'openapi', 'swagger2', 'gate.json'), body);
    return materialised({ specs: [{ path: 'openapi/swagger2/gate.json', label: 'v2', released: true }] });
  };

  it('rejects a ../ ref naming the spec, the ref and the remedy', () => {
    expect(() => run(swagger({ $ref: '../../outside.yaml#/Pet' }))).toThrow(
      /specs\[0\][\s\S]*\.\.\/\.\.\/outside\.yaml#\/Pet[\s\S]*Swagger 2\.0 \/ remote specs must be self-contained; inline the ref or bundle the document locally/,
    );
  });

  it('rejects an https ref', () => {
    expect(() => run(swagger({ $ref: 'https://example.com/pet.json' }))).toThrow(/self-contained/);
  });

  it('still accepts internal #/definitions refs', () => {
    const specs = run(swagger({ $ref: '#/definitions/Pet' }));
    expect(specs[0]!.origin).toBe('swagger2');
  });
});

describe('the $ref gate (FR-022, FR-028)', () => {
  /** A valid minimal spec, for rows whose setup writes a target file. */
  const MINIMAL_SPEC = `${[
    'openapi: 3.1.0',
    'info:',
    '  title: Generated fixture API',
    '  version: 1.0.0',
    'paths:',
    '  /things:',
    '    get:',
    '      operationId: listThings',
    '      summary: List things',
    '      responses:',
    "        '200':",
    '          description: The things.',
  ].join('\n')}\n`;

  interface GateRow {
    /** Directory under `src/tests/fixtures/openapi/rejected/`. */
    case: string;
    /** The spec file inside it, as `openapi/<file>`. */
    file: string;
    /** The cause text after `[dk-openapi] specs[0] "v1": `. */
    cause: RegExp;
    /** Extra artifacts to write into the row's site before the call. */
    setup?: (rowSite: string) => void;
  }

  const ROWS: GateRow[] = [
    {
      case: 'ref-escapes-folder',
      file: 'api.yaml',
      cause: /escapes the definition folder: the \$ref '\.\.\/outside\.yaml#\/Outside'/,
    },
    {
      case: 'ref-non-file-scheme',
      file: 'api.yaml',
      cause: /scheme in the \$ref 'ftp:\/\/specs\.example\.test\/pet\.yaml#\/Pet' is not allowed: a \$ref must be a relative file reference/,
    },
    {
      case: 'ref-absolute-file',
      file: 'api.yaml',
      cause: /ref 'file:\/\/\/etc\/passwd#\/Pet' is not a relative file reference: absolute paths and the file, http and https schemes are not allowed/,
    },
    {
      case: 'ref-unresolvable',
      file: 'api.yaml',
      cause: /cannot resolve the \$ref '\.\/missing-local\.yaml#\/Pet'/,
    },
    {
      case: 'ref-cycle-external',
      file: 'a.yaml',
      cause: /cycle of external \$refs: a\.yaml -> b\.yaml -> a\.yaml/,
    },
    {
      case: 'ref-symlink-escape',
      file: 'api.yaml',
      cause: /escapes the definition folder: the \$ref 'link\.yaml#\/Pet'/,
      setup: (rowSite) => {
        // A symlink target outside the site root; the encoded-separator ref
        // in the same fixture has its own row below.
        const outside = `${rowSite}-outside.yaml`;
        writeFileSync(outside, MINIMAL_SPEC);
        symlinkSync(outside, path.join(rowSite, 'openapi', 'link.yaml'));
      },
    },
    {
      case: 'ref-encoded-separator',
      file: 'api.yaml',
      cause: /escapes the definition folder: the \$ref '\.\.%2fout\.yaml#\/Pet'/,
      setup: (rowSite) => {
        // The target exists one level up: only decoding `..%2f` before the
        // containment check can stop it.
        writeFileSync(path.join(rowSite, 'out.yaml'), MINIMAL_SPEC);
      },
    },
    {
      case: 'ref-http-scheme',
      file: 'api.yaml',
      cause:
        /ref 'https:\/\/specs\.example\.test\/pet\.yaml#\/Pet' is not a relative file reference: absolute paths and the file, http and https schemes are not allowed/,
    },
    {
      case: 'ref-absolute-path',
      file: 'api.yaml',
      cause:
        /ref '\/etc\/passwd#\/Pet' is not a relative file reference: absolute paths and the file, http and https schemes are not allowed/,
    },
    {
      case: 'ref-directory',
      file: 'api.yaml',
      cause: /cannot resolve the \$ref '\.\/subdir#\/Pet': not a regular file/,
    },
    {
      case: 'ref-limit',
      file: 'bomb.yaml',
      cause: new RegExp(`ref limit exceeded: more than ${MAX_REF_COUNT} \\$ref entries`),
      setup: (rowSite) => {
        const lines = [
          'openapi: 3.1.0',
          'info:',
          '  title: Ref bomb',
          '  version: 1.0.0',
          'paths: {}',
          'components:',
          '  schemas:',
          '    Base: { type: object }',
        ];
        for (let i = 0; i <= MAX_REF_COUNT; i += 1) lines.push(`    S${i}: { $ref: '#/components/schemas/Base' }`);
        writeFileSync(path.join(rowSite, 'openapi', 'bomb.yaml'), `${lines.join('\n')}\n`);
      },
    },
  ];

  /** One row on its own throwaway site, like the seam suite's rejected rows. */
  const rejects = (row: GateRow): void => {
    const rowSite = mkdtempSync(path.join(tmpdir(), 'dk-openapi-gate-'));
    mkdirSync(path.join(rowSite, 'docs'), { recursive: true });
    cpSync(path.join(FIXTURES, 'rejected', row.case), path.join(rowSite, 'openapi'), { recursive: true });
    row.setup?.(rowSite);
    const option = normaliseOpenApiOptions(
      { renderer, specs: [{ path: `openapi/${row.file}`, label: 'v1', released: true }] },
      { siteRoot: rowSite },
    );
    try {
      expect(() =>
        materialiseOpenApiSpecs(option, {
          siteRoot: rowSite,
          offline: false,
          cacheDir: path.join(rowSite, '.cache'),
        }),
      ).toThrow(new RegExp(`^\\[dk-openapi\\] specs\\[0\\] "v1": ${row.cause.source}`));
    } finally {
      rmSync(rowSite, { recursive: true, force: true });
    }
  };

  for (const row of ROWS) {
    it(`[WP09] ${row.case} is rejected, naming the entry and the cause`, () => rejects(row));
  }

  it(`[WP09] rejects a $ref chain deeper than ${MAX_REF_DEPTH} files`, () => {
    const rowSite = mkdtempSync(path.join(tmpdir(), 'dk-openapi-gate-'));
    mkdirSync(path.join(rowSite, 'openapi'), { recursive: true });
    // entry.yaml -> chain-1.yaml -> … -> chain-110.yaml: 111 files deep.
    const total = MAX_REF_DEPTH + 10;
    for (let i = 1; i <= total; i += 1) {
      const next = i < total ? `{ $ref: './chain-${i + 1}.yaml#/x' }` : '{ type: object }';
      writeFileSync(path.join(rowSite, 'openapi', `chain-${i}.yaml`), `x: ${next}\n`);
    }
    writeFileSync(
      path.join(rowSite, 'openapi', 'entry.yaml'),
      `openapi: 3.1.0\ninfo: {title: T, version: "1"}\npaths: {}\nx: { $ref: './chain-1.yaml#/x' }\n`,
    );
    const option = normaliseOpenApiOptions(
      { renderer, specs: [{ path: 'openapi/entry.yaml', label: 'v1', released: true }] },
      { siteRoot: rowSite },
    );
    try {
      expect(() =>
        materialiseOpenApiSpecs(option, {
          siteRoot: rowSite,
          offline: false,
          cacheDir: path.join(rowSite, '.cache'),
        }),
      ).toThrow(new RegExp(`ref limit exceeded: .*deeper than ${MAX_REF_DEPTH} files`));
    } finally {
      rmSync(rowSite, { recursive: true, force: true });
    }
  });
});

describe('the bundler child fails closed on its own (FR-028, T043)', () => {
  const BUNDLER = fileURLToPath(new URL('../lib/openapi/bundle.mjs', import.meta.url));

  interface ChildAnswer {
    ok: boolean;
    message?: string;
  }

  /** Run the bundler child on one entry, the way the parent's `bundleInChild` does. */
  const runChild = (entry: string): ChildAnswer => {
    const res = spawnSync(process.execPath, [BUNDLER, '--bundle', entry], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(res.status, `bundler child output:\n${res.stdout}\n${res.stderr}`).toBe(0);
    return JSON.parse(res.stdout.trim().split('\n').pop() ?? '') as ChildAnswer;
  };

  /**
   * A throwaway site holding `openapi/entry.yaml` plus extra files beside it.
   * The child is run directly, with no parent pre-walk: what is tested is the
   * child's own defence, not the gate's.
   */
  const childSite = (files: Record<string, string>): { site: string; entry: string } => {
    const site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-child-'));
    mkdirSync(path.join(site, 'openapi'), { recursive: true });
    for (const [rel, contents] of Object.entries(files)) {
      writeFileSync(path.join(site, rel), contents);
    }
    return { site, entry: path.join(site, 'openapi', 'entry.yaml') };
  };

  const ENTRY_HEAD = 'openapi: 3.1.0\ninfo: {title: T, version: "1"}\npaths: {}\n';

  it('[WP09] keeps the network resolver off: an http(s) ref fails on the disabled fetch, not by DNS luck', () => {
    const { site, entry } = childSite({
      'openapi/entry.yaml': `${ENTRY_HEAD}x: { $ref: 'https://specs.example.test/pet.yaml#/x' }\n`,
    });
    try {
      const answer = runChild(entry);
      expect(answer.ok).toBe(false);
      expect(answer.message).toMatch(/network access is disabled/);
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });

  it('[WP09] re-checks containment: an escaping ref the walk never saw still fails in the child', () => {
    const { site, entry } = childSite({
      'openapi/entry.yaml': `${ENTRY_HEAD}x: { $ref: '../outside.yaml#/x' }\n`,
      'outside.yaml': 'x: { type: object }\n',
    });
    try {
      const answer = runChild(entry);
      expect(answer.ok).toBe(false);
      // The parser's resolver wrapper names the file it refused to read.
      expect(answer.message).toMatch(/outside\.yaml/);
      expect(answer.message).not.toMatch(/type: object/);
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});

describe('two-build byte identity of the bundled output (NFR-001)', () => {
  let pair: ReturnType<typeof twoBuilds>;

  beforeAll(() => {
    pair = twoBuilds({
      fixture: 'multi-file',
      openapi: { specs: [{ path: 'openapi/entry.yaml', label: 'v1', released: true }] },
    });
    for (const build of [pair.first, pair.second]) {
      expect(build.status, `astro build output:\n${build.output}`).toBe(0);
    }
  }, 600_000);

  it('[WP09] publishes the bundled bytes and their sha256, byte-identical across two cold builds', () => {
    const raw = 'reference/api/v1/openapi.yaml';
    const first = pair.a.get(raw);
    expect(first, `${raw} exists in the first build`).toBeDefined();
    expect(pair.b.get(raw)!.equals(first!), `${raw} is byte-identical`).toBe(true);
    // The sidecar is `sha256sum -c` format and matches the published bytes.
    expect(pair.a.get(`${raw}.sha256`)!.toString('utf8')).toBe(`${sha(first!)}  openapi.yaml\n`);
    expect(pair.b.get(`${raw}.sha256`)!.equals(pair.a.get(`${raw}.sha256`)!)).toBe(true);
    // The published bytes are the bundled document, not any single source file.
    expect(first!.equals(readFileSync(path.join(site, 'openapi', 'entry.yaml')))).toBe(false);
  });
});
