/**
 * openapi-optin.test.ts — consumption proof for the opt-in `openapi` option
 * (mission openapi-reference-pages-01M60GZ5, WP05; FR-007, FR-010, SC-004).
 *
 * Three arms, all on the PACKED tarball in throwaway copies of the consumer fixture
 * (see crafted-fixture.ts):
 *
 *   A. No renderer (FR-010 / SC-004): the committed fixture installs with
 *      `--frozen-lockfile`, installs NEITHER optional peer, builds, and its build
 *      output equals the output of the same fixture built from the merge-base
 *      tarball. A URL list is not enough: every output file is compared by bytes.
 *      Positive control: the compare is made to FAIL on a mutated copy of the output.
 *   B. With the renderer: `starlight-openapi@0.27.0` and `@astrojs/markdown-satteri@0.4.4`
 *      are added to a copy and one spec is configured; the build publishes the
 *      reference pages, the raw document and its `.sha256` sidecar.
 *   C. Fail closed (FR-007): a missing or wrong `renderer`, and a renderer package that
 *      is not installed, fail the build with a message that says how to fix it.
 *
 * Offline-capable the same way consumption-gap.test.ts is: installs use
 * `--prefer-offline`; the two peers (arm B) are the only packages beyond the committed
 * lockfile and come from the pnpm store or the registry.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  REPO_ROOT,
  SRC_DIR,
  buildFixture,
  capture,
  craftFixtureCopy,
  installFixture,
  makeCraftRoot,
  packToolkit,
  registryArgs,
  useNoopImageService,
} from './crafted-fixture';

const PEERS = ['starlight-openapi', '@astrojs/markdown-satteri'];
const PEER_PINS = ['starlight-openapi@0.27.0', '@astrojs/markdown-satteri@0.4.4'];
const BASE_REF = process.env.DK_CONSUMPTION_BASE_REF ?? 'main';
const VERSION = JSON.parse(readFileSync(path.join(SRC_DIR, 'package.json'), 'utf8')).version as string;

/**
 * What the comparison tolerates, and nothing else (each item is a LISTED difference):
 *  - build-time stamps: this fixture's pages have no `updated` date, so feeds, the content
 *    graph and the OKF export carry the build clock (RFC 822 and ISO 8601 times);
 *  - the toolkit version string, in any text file;
 *  - the agent-API build identity (`buildId`, FR-008) and the section listing
 *    (`sections`, FR-003) in /api/*.json: both are build-identity/compatibility
 *    fields the merge-base tarball predates, not opt-in OpenAPI behavior.
 *    A regression IN payload content or formatting must still fail: only these two
 *    fields, at the artifact top level, are masked (see maskListedJsonFields).
 * Nothing else: the OpenAPI chrome styles live in their own sheet that is added only
 * when the option is set, so even the CSS bundles (and their content hashes) are equal.
 */
const RFC822 = /\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT/g;
const ISO8601 = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

/**
 * Structural mask for the two LISTED additive agent-API fields (FR-008 build
 * identity, FR-003 section listing in index.json).
 *
 * TODO: drop this tolerance after the next release, once the merge base also
 * carries `buildId` and `sections` (then both builds emit them and nothing needs
 * masking).
 *
 * Narrow on purpose:
 *  - `buildId` is deleted at the artifact TOP LEVEL only (index.json, every
 *    pages/<id>.json, scenarios.json carry it there; no nested record does), and
 *    `sections` at the top level of api/index.json only. A stray nested `buildId`
 *    or a `sections` anywhere else still compares.
 *  - The unmasked text must first equal what the emitters write
 *    (`JSON.stringify(value, null, 2)`, plus a trailing newline for the routes
 *    that add one). A formatting regression (indent, key order, line endings)
 *    therefore is NOT masked: the text comes back unchanged and fails the compare.
 *  - The masked value is re-serialized with that same serializer, so masking
 *    cannot normalize formatting away either.
 */
function maskListedJsonFields(text: string, relpath: string): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return text; // not JSON after all: fall through to raw text compare
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return text;
  const trailer = text.endsWith('\n') ? '\n' : '';
  if (text !== JSON.stringify(value, null, 2) + trailer) return text; // emitter format drifted: compare raw
  const rec = value as Record<string, unknown>;
  delete rec['buildId'];
  if (relpath === 'api/index.json') delete rec['sections'];
  return JSON.stringify(rec, null, 2) + trailer;
}

function normalize(bytes: Buffer, versions: string[], relpath: string): string {
  let text = bytes.toString('utf8');
  for (const v of versions) text = text.split(v).join('<version>');
  text = text.replace(RFC822, '<time>').replace(ISO8601, '<time>');
  if (relpath.startsWith('api/') && relpath.endsWith('.json')) text = maskListedJsonFields(text, relpath);
  return text;
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/** Differences between two build outputs once the listed differences are removed. */
function diffDist(a: string, b: string, versions: string[] = []): string[] {
  const left = new Set(listFiles(a));
  const right = new Set(listFiles(b));
  const problems: string[] = [];
  for (const k of left) if (!right.has(k)) problems.push(`only in A: ${k}`);
  for (const k of right) if (!left.has(k)) problems.push(`only in B: ${k}`);
  for (const k of left) {
    if (!right.has(k)) continue;
    const x = normalize(readFileSync(path.join(a, k)), versions, k);
    const y = normalize(readFileSync(path.join(b, k)), versions, k);
    if (x !== y) {
      let at = 0;
      while (x[at] === y[at]) at++;
      problems.push(`bytes differ: ${k} @${at} A=${JSON.stringify(x.slice(at, at + 50))} B=${JSON.stringify(y.slice(at, at + 50))}`);
    }
  }
  return problems;
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const SPEC = `openapi: 3.0.3
info:
  title: Consumer API
  version: 1.0.0
paths:
  /widgets:
    get:
      operationId: listWidgets
      summary: List widgets
      responses:
        '200':
          description: The widgets.
`;

/** Rewrite the copy's astro.config.mjs: add an import line and an `openapi` option. */
function configureOpenapi(fixtureDir: string, opts: { importLine?: string; option: string }): void {
  const file = path.join(fixtureDir, 'astro.config.mjs');
  let text = readFileSync(file, 'utf8');
  text = text.replace("import { pressTheme }", `${opts.importLine ?? ''}\nimport { pressTheme }`);
  text = text.replace("    markua: true,", `    openapi: ${opts.option},\n    markua: true,`);
  writeFileSync(file, text);
}

// ── suite ─────────────────────────────────────────────────────────────────────

let craftRoot = '';
let headDir = '';
let baseDir = '';
/** The merge-base toolkit's version: a release PR bumps it, and the stamps differ only by it. */
let baseVersion = '';
let withDir = '';
const headConfig = { original: '' };
let withConfig = '';

function gitOk(args: string[]): string | null {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The merge-base commit with BASE_REF (or origin/BASE_REF). Throws when neither resolves. */
function resolveMergeBase(): string {
  const sha = gitOk(['merge-base', 'HEAD', BASE_REF]) ?? gitOk(['merge-base', 'HEAD', `origin/${BASE_REF}`]);
  if (!sha) {
    throw new Error(
      `cannot resolve the merge-base with "${BASE_REF}" (shallow clone? use fetch-depth: 0, or set DK_CONSUMPTION_BASE_REF)`,
    );
  }
  return sha;
}

/**
 * A copy of the HEAD fixture (same sources, same lockfile) packed with the merge-base
 * toolkit instead. Only the toolkit differs, so any output difference is the toolkit's.
 */
function craftBaseFixture(root: string, sha: string): string {
  const extractDir = path.join(root, 'base-tree');
  mkdirSync(extractDir, { recursive: true });
  const archive = spawnSync('sh', ['-c', `git archive ${sha} src | tar -x -C "${extractDir}"`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (archive.status !== 0) throw new Error(`git archive failed: ${archive.stderr}`);
  const dir = craftFixtureCopy(root, 'base-fixture');
  useNoopImageService(dir);
  baseVersion = JSON.parse(readFileSync(path.join(extractDir, 'src', 'package.json'), 'utf8')).version;
  packToolkit(dir, path.join(extractDir, 'src'));
  return dir;
}

describe('opt-in openapi option — consumption proof (FR-010, SC-004, FR-007)', () => {
  beforeAll(() => {
    craftRoot = makeCraftRoot('dk-consumption-openapi-');
    headDir = craftFixtureCopy(craftRoot, 'head-fixture');
    useNoopImageService(headDir);
    packToolkit(headDir);
    const head = installFixture(headDir);
    if (head.status !== 0) throw new Error(`head fixture install failed:\n${head.output}`);
    headConfig.original = readFileSync(path.join(headDir, 'astro.config.mjs'), 'utf8');
    baseDir = craftBaseFixture(craftRoot, resolveMergeBase());
    const base = installFixture(baseDir);
    if (base.status !== 0) throw new Error(`merge-base fixture install failed:\n${base.output}`);
  }, 900_000);

  afterAll(() => {
    if (process.env.DK_CONSUMPTION_KEEP) return; // debugging: keep the copies
    if (craftRoot && existsSync(craftRoot)) rmSync(craftRoot, { recursive: true, force: true });
  });

  describe('arm A — without the renderer', () => {
    it('installs neither optional peer, and no toolkit file imports one', () => {
      for (const peer of PEERS) {
        expect(existsSync(path.join(headDir, 'node_modules', peer)), `${peer} must not be installed`).toBe(false);
      }
      // The renderer is in no part of the install tree. (`@astrojs/markdown-satteri` is
      // not checked here: Starlight's own `@astrojs/mdx` depends on it, so it is in the
      // store without the toolkit asking for it. Only a top-level install is the adopter's.)
      const store = readdirSync(path.join(headDir, 'node_modules', '.pnpm'));
      expect(store.filter((d) => d.startsWith('starlight-openapi@'))).toEqual([]);
      // The toolkit never imports the renderer itself (renderer-loading decision).
      const grep = spawnSync('grep', ['-rlE', `^\\s*(import|export)\\b[^;]*['"](${PEERS.join('|')})['"]|import\\(\\s*['"](${PEERS.join('|')})['"]`, path.join(SRC_DIR, 'lib')], {
        encoding: 'utf8',
      });
      expect(grep.stdout.trim().split('\n').filter(Boolean)).toEqual([]);
    });

    it('builds, and its output equals the merge-base build byte for byte (SC-004)', () => {
      const head = buildFixture(headDir);
      expect(head.status, `head build must succeed:\n${head.output}`).toBe(0);
      const base = buildFixture(baseDir);
      expect(base.status, `merge-base build must succeed:\n${base.output}`).toBe(0);

      const headDist = path.join(headDir, 'dist');
      const baseDist = path.join(baseDir, 'dist');
      expect(listFiles(headDist).length).toBeGreaterThan(20);
      expect(diffDist(baseDist, headDist, [VERSION, baseVersion])).toEqual([]);
      // No route of the new feature leaks into a site that does not use it.
      expect(listFiles(headDist).filter((f) => f.startsWith('reference/api/'))).toEqual([]);
    }, 600_000);

    it('positive control: the comparison fails on a changed, a removed and an added file', () => {
      const headDist = path.join(headDir, 'dist');
      const copy = path.join(craftRoot, 'mutated-dist');
      spawnSync('cp', ['-r', headDist, copy]);
      writeFileSync(path.join(copy, 'index.html'), readFileSync(path.join(copy, 'index.html'), 'utf8') + ' ');
      rmSync(path.join(copy, '404.html'));
      writeFileSync(path.join(copy, 'extra.txt'), 'x');
      const problems = diffDist(headDist, copy);
      expect(problems.some((p) => p.startsWith('bytes differ: index.html'))).toBe(true);
      expect(problems).toEqual(expect.arrayContaining(['only in A: 404.html', 'only in B: extra.txt']));

    });
  });

  describe('arm C — fail closed without a usable renderer', () => {
    it('a renderer package that is not installed fails at the adopter import, naming the package', () => {
      configureOpenapi(headDir, {
        importLine: "import starlightOpenAPI from 'starlight-openapi';",
        option: "{ renderer: starlightOpenAPI, specs: [{ path: 'openapi/main.yaml', label: 'main', released: false }] }",
      });
      try {
        const build = buildFixture(headDir);
        expect(build.status).not.toBe(0);
        expect(build.output).toContain('starlight-openapi');
      } finally {
        writeFileSync(path.join(headDir, 'astro.config.mjs'), headConfig.original);
      }
    }, 600_000);
  });

  describe('arm B — with the renderer', () => {
    beforeAll(() => {
      // A copy of the installed head fixture, then the two pinned peers on top.
      withDir = craftFixtureCopy(craftRoot, 'with-renderer-fixture');
      useNoopImageService(withDir);
      packToolkit(withDir);
      const install = installFixture(withDir);
      if (install.status !== 0) throw new Error(`with-renderer fixture install failed:\n${install.output}`);
      const add = capture(
        'pnpm',
        ['add', '--prefer-offline', '--ignore-workspace', '--config.dangerouslyAllowAllBuilds=true', '--save-exact', ...registryArgs(), ...PEER_PINS],
        { cwd: withDir },
      );
      if (add.status !== 0) throw new Error(`adding the pinned peers failed:\n${add.output}`);
      mkdirSync(path.join(withDir, 'openapi'), { recursive: true });
      writeFileSync(path.join(withDir, 'openapi', 'main.yaml'), SPEC);
      withConfig = readFileSync(path.join(withDir, 'astro.config.mjs'), 'utf8');
    }, 900_000);

    it('builds and publishes the reference page, the raw document and its sha256 sidecar', () => {
      writeFileSync(path.join(withDir, 'astro.config.mjs'), withConfig);
      configureOpenapi(withDir, {
        importLine: "import starlightOpenAPI from 'starlight-openapi';",
        option: "{ renderer: starlightOpenAPI, specs: [{ path: 'openapi/main.yaml', label: 'main', released: false }] }",
      });
      const build = buildFixture(withDir);
      expect(build.status, `build with the renderer must succeed:\n${build.output}`).toBe(0);

      // base is /consumer-fixture; the default section is reference/api.
      const dist = path.join(withDir, 'dist');
      const versionDir = path.join(dist, 'reference', 'api', 'main');
      const files = listFiles(versionDir);
      expect(files).toContain('index.html');
      expect(files.some((f) => f.endsWith('/index.html') && /listwidgets|widgets/i.test(f))).toBe(true);
      expect(readFileSync(path.join(versionDir, 'index.html'), 'utf8')).toContain('Consumer API');

      // The chrome stylesheet ships with the option (and only with it: arm A is byte-equal).
      const sheets = listFiles(path.join(dist, '_astro')).filter((f) => f.endsWith('.css'));
      expect(sheets.some((f) => readFileSync(path.join(dist, '_astro', f), 'utf8').includes('.dk-openapi-nav'))).toBe(true);

      const raw = path.join(versionDir, 'openapi.yaml');
      expect(readFileSync(raw, 'utf8')).toBe(SPEC); // byte-identical to the input
      const sidecar = readFileSync(`${raw}.sha256`, 'utf8');
      expect(sidecar).toBe(`${sha256(raw)}  openapi.yaml\n`); // `sha256sum -c` format
    }, 600_000);

    it('a missing or wrong renderer fails the build with the import hint, publishing nothing', () => {
      const specs = "specs: [{ path: 'openapi/main.yaml', label: 'main', released: false }]";
      for (const option of [`{ ${specs} }`, `{ renderer: 'starlight-openapi', ${specs} }`]) {
        writeFileSync(path.join(withDir, 'astro.config.mjs'), withConfig);
        configureOpenapi(withDir, { option });
        const build = buildFixture(withDir);
        expect(build.status, `must fail for ${option}`).not.toBe(0);
        expect(build.output).toContain('[dk-openapi]');
        expect(build.output).toContain('"renderer" is required');
        expect(build.output).toContain("import starlightOpenAPI from 'starlight-openapi'");
        expect(existsSync(path.join(withDir, 'dist', 'reference', 'api'))).toBe(false);
      }
    }, 600_000);
  });
});
