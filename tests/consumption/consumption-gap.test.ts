/**
 * consumption-gap.test.ts — the packaging-gap FAIL-CLOSED self-test (contract
 * C-2 / C-4, INV-15, E-06; FR-006/FR-007; mission consumption-test-01M22ZF2, WP05).
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * The consumption test's whole value is that it FAILS when the published toolkit
 * tarball is missing a file a real consumer statically imports (an `exports`-mapped
 * `.ts`/`.astro`/`.css` that is in the package `files` allowlist). A gate that can
 * only ever pass is worthless (anti-scaffolding). So we prove the fail-closed
 * property by construction, as a TWO-ARM differential:
 *
 *   ARM 1 (positive control, T021): a CRAFTED COPY of the consumer fixture, built
 *     from the freshly packed + installed toolkit tarball, builds GREEN. This
 *     proves the harness is sound — it is not an always-failing rig.
 *   ARM 2 (fail-closed, T022): from that SAME crafted install we remove exactly
 *     ONE toolkit file that is (a) genuinely imported by the fixture, (b) actually
 *     present in the packed `files` allowlist, and (c) statically imported via an
 *     `exports` subpath — then rebuild. The build MUST fail with a message NAMING
 *     that specifier.
 *
 * The removed file is DERIVED programmatically (T023) from the real fixture imports
 * ∩ the real packed file list, so the test tracks reality rather than a hand-invented
 * path. It is NEVER the favicon: the favicon is resolved lazily at `astro:build:done`
 * and a missing favicon only WARNS (contract C-2 carve-out; that omission is covered
 * by WP04's favicon-output check instead).
 *
 * NO STANDING RED GATE: the failing case is constructed inside a throwaway temp dir
 * and torn down; the TEST itself passes (it asserts that an internal build fails).
 * The committed fixture is never mutated — we operate on a copy.
 *
 * Mirrors the crafted-fixture failure-mode pattern of `src/tests/redirect-coverage.test.ts`.
 *
 * HARNESS NOTES (environment, not weakening):
 *  - The crafted copy is created on the same filesystem as the pnpm store (under
 *    ~/.cache when available) so a frozen `--prefer-offline` install reuses the
 *    content-addressable store with no network — the same command still downloads
 *    cache-misses in CI.
 *  - The crafted copy is given Astro's passthrough (noop) image service. `sharp`'s
 *    native binary is not reliably resolvable from Astro's build-time dynamic import
 *    under pnpm's strict node_modules, and image optimization is ORTHOGONAL to
 *    packaging-gap module resolution (what ARM 2 proves). Astro's own MissingSharp
 *    hint recommends exactly this. Applied identically to both arms, so the only
 *    difference between green and red is the removed module.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── repository layout (derived from this file's location) ────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url)); // tests/consumption
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SRC_DIR = path.join(REPO_ROOT, 'src'); // the @commondocs-kitty/toolkit package
const FIXTURE_DIR = path.join(HERE, 'consumer-fixture');
const TOOLKIT_PKG = JSON.parse(readFileSync(path.join(SRC_DIR, 'package.json'), 'utf8'));
const TOOLKIT_NAME: string = TOOLKIT_PKG.name; // '@commondocs-kitty/toolkit'

// Static-import module kinds that MUST fail closed when absent (contract C-2).
const STATIC_KINDS = ['.ts', '.astro', '.css'];

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a command, capturing combined stdout+stderr. */
function capture(
  cmd: string,
  args: string[],
  opts: { cwd?: string } = {},
): { status: number; output: string } {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) return { status: 1, output: String(res.error.message) };
  return { status: res.status ?? 1, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

/**
 * The REAL packed file list of the toolkit (paths relative to the package root),
 * from `npm pack --dry-run --json` — i.e. exactly what the `files` allowlist ships.
 */
function packedFiles(): string[] {
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: SRC_DIR,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${res.stderr}`);
  }
  const parsed = JSON.parse(res.stdout);
  return (parsed[0].files as Array<{ path: string }>).map((f) => f.path);
}

/**
 * Resolve a toolkit `exports` subpath (e.g. 'routes', 'layouts/DeckLayout.astro')
 * to a package-relative file path (e.g. 'lib/routes/index.ts') using the real
 * `exports` map — exact keys first, then `./prefix/*` wildcards.
 */
function resolveExport(exportsMap: Record<string, string>, subpath: string): string | null {
  const key = `./${subpath}`;
  if (typeof exportsMap[key] === 'string') {
    return exportsMap[key].replace(/^\.\//, '');
  }
  for (const [pattern, target] of Object.entries(exportsMap)) {
    if (!pattern.endsWith('/*') || typeof target !== 'string') continue;
    const prefix = pattern.slice(0, -1); // './layouts/'
    if (key.startsWith(prefix)) {
      const remainder = key.slice(prefix.length); // 'DeckLayout.astro'
      return target.replace('*', remainder).replace(/^\.\//, '');
    }
  }
  return null;
}

/**
 * Scan the fixture's AUTHORED source (never node_modules/dist) for STATIC imports
 * of `${TOOLKIT_NAME}/<subpath>`, returning subpath → count of distinct importing
 * files. Only static `import ... from '...'` / `import '...'` forms are matched
 * (dynamic `import(...)` is deliberately excluded).
 */
function fixtureStaticImports(): Map<string, number> {
  const roots = ['astro.config.mjs', 'src', 'docs']
    .map((p) => path.join(FIXTURE_DIR, p))
    .filter((p) => existsSync(p));
  const files: string[] = [];
  const walk = (p: string) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const child of readdirSync(p)) walk(path.join(p, child));
    } else if (/\.(ts|tsx|astro|mjs|js)$/.test(p)) {
      files.push(p);
    }
  };
  for (const r of roots) walk(r);

  // `import ... from 'SPEC'` and side-effect `import 'SPEC'` (static only).
  const spec = TOOLKIT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `import(?:[^'"\`]*?from\\s*)?['"](${spec})/([^'"]+)['"]`,
    'g',
  );
  const counts = new Map<string, number>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const subpath = m[2];
      if (!seen.has(subpath)) {
        seen.add(subpath);
        counts.set(subpath, (counts.get(subpath) ?? 0) + 1);
      }
    }
  }
  return counts;
}

interface GapCandidate {
  subpath: string; // e.g. 'routes'
  specifier: string; // e.g. '@commondocs-kitty/toolkit/routes'
  file: string; // package-relative, e.g. 'lib/routes/index.ts'
  importerCount: number;
}

/**
 * DERIVE the fail-closed target (T023): the set of files that are
 *   (fixture-imported)  ∩  (in the packed `files` allowlist)  ∩  (static kind)
 * minus the favicon carve-out. Choose deterministically the one imported by the
 * MOST fixture files (tie-break: lexicographic), so the omission is maximally
 * observable and the choice is reproducible.
 */
function deriveGapCandidate(): { chosen: GapCandidate; all: GapCandidate[] } {
  const imports = fixtureStaticImports();
  const packed = new Set(packedFiles());
  const exportsMap = TOOLKIT_PKG.exports as Record<string, string>;

  const all: GapCandidate[] = [];
  for (const [subpath, importerCount] of imports) {
    const file = resolveExport(exportsMap, subpath);
    if (!file) continue; // not an exports-mapped subpath
    if (!STATIC_KINDS.includes(path.extname(file))) continue; // not a static kind
    if (/favicon/i.test(file)) continue; // C-2 carve-out: favicon warns, never fails
    if (!packed.has(file)) continue; // must really ship in the tarball
    all.push({ subpath, specifier: `${TOOLKIT_NAME}/${subpath}`, file, importerCount });
  }

  all.sort((a, b) => b.importerCount - a.importerCount || a.file.localeCompare(b.file));
  if (all.length === 0) {
    throw new Error(
      'no fail-closed candidate: no fixture import resolves to a packed, statically-imported toolkit module',
    );
  }
  return { chosen: all[0], all };
}

// ── crafted-fixture lifecycle ────────────────────────────────────────────────

/**
 * A base dir on the SAME filesystem as the pnpm store, so an offline/prefer-offline
 * frozen install reuses the content-addressable store (hardlinks, no network).
 * Falls back to the system temp dir if ~/.cache is unavailable.
 */
function tempBase(): string {
  const cache = path.join(homedir(), '.cache');
  try {
    mkdirSync(cache, { recursive: true });
    return cache;
  } catch {
    return tmpdir();
  }
}

let craftRoot = '';
let craftFixture = '';
let derived: { chosen: GapCandidate; all: GapCandidate[] };

/** Copy the committed fixture into a temp dir, excluding install/build artifacts. */
function craftFixtureCopy(): string {
  craftRoot = mkdtempSync(path.join(tempBase(), 'dk-consumption-gap-'));
  const dest = path.join(craftRoot, 'consumer-fixture');
  cpSync(FIXTURE_DIR, dest, {
    recursive: true,
    filter: (src) => {
      const b = path.basename(src);
      if (b === 'node_modules' || b === 'dist' || b === '.astro' || b === '.git') return false;
      if (b.endsWith('.tgz')) return false;
      return true;
    },
  });
  return dest;
}

/** Give the crafted copy Astro's passthrough image service (harness note above). */
function useNoopImageService(fixtureDir: string): void {
  const configPath = path.join(fixtureDir, 'astro.config.mjs');
  let text = readFileSync(configPath, 'utf8');
  const anchor = 'export default defineConfig({';
  if (!text.includes(anchor)) throw new Error('crafted astro.config.mjs missing defineConfig anchor');
  text = text.replace(
    anchor,
    `${anchor}\n  image: { service: { entrypoint: 'astro/assets/services/noop' } },`,
  );
  writeFileSync(configPath, text);
}

/** Pack the toolkit into the crafted fixture as the stable `toolkit.tgz`. */
function packToolkit(fixtureDir: string): void {
  const res = spawnSync('npm', ['pack', '--json', '--pack-destination', fixtureDir], {
    cwd: SRC_DIR,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`npm pack failed:\n${res.stderr}`);
  const packed = readdirSync(fixtureDir).find((f) => f.endsWith('.tgz') && f !== 'toolkit.tgz');
  if (!packed) throw new Error('npm pack produced no tarball');
  const target = path.join(fixtureDir, 'toolkit.tgz');
  if (existsSync(target)) rmSync(target);
  cpSync(path.join(fixtureDir, packed), target);
  rmSync(path.join(fixtureDir, packed));
}

/** Install the crafted fixture in isolation, reusing the store where possible. */
function installFixture(fixtureDir: string): { status: number; output: string } {
  return capture(
    'pnpm',
    [
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
      '--ignore-workspace',
      '--config.dangerouslyAllowAllBuilds=true',
    ],
    { cwd: fixtureDir },
  );
}

/** Build the crafted fixture via its LOCAL astro binary (bypasses pnpm's deps-status recheck). */
function buildFixture(fixtureDir: string): { status: number; output: string } {
  const distDir = path.join(fixtureDir, 'dist');
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  const astroBin = path.join(fixtureDir, 'node_modules', '.bin', 'astro');
  if (!existsSync(astroBin)) return { status: 1, output: `astro binary missing at ${astroBin}` };
  return capture(astroBin, ['build'], { cwd: fixtureDir });
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('consumption packaging-gap self-test (C-2/C-4, INV-15) — two-arm', () => {
  beforeAll(() => {
    derived = deriveGapCandidate();
    craftFixture = craftFixtureCopy();
    useNoopImageService(craftFixture);
    packToolkit(craftFixture);
    const install = installFixture(craftFixture);
    if (install.status !== 0) {
      throw new Error(
        `crafted-fixture install failed (offline store may be incomplete); ` +
          `two-arm logic is intact but cannot self-verify here:\n${install.output}`,
      );
    }
  }, 600_000);

  afterAll(() => {
    if (craftRoot && existsSync(craftRoot)) rmSync(craftRoot, { recursive: true, force: true });
  });

  it('T023: derives a really-imported ∩ allowlisted ∩ statically-imported module (never the favicon)', () => {
    const { chosen, all } = derived;
    // The chosen target is one the fixture genuinely, statically imports…
    expect(fixtureStaticImports().has(chosen.subpath)).toBe(true);
    expect(chosen.importerCount).toBeGreaterThanOrEqual(1);
    // …resolves through the toolkit `exports` to a static-import kind…
    expect(STATIC_KINDS).toContain(path.extname(chosen.file));
    // …that is actually present in the packed `files` allowlist…
    expect(packedFiles()).toContain(chosen.file);
    // …and is NEVER the favicon (its warn-path does not fail the build — C-2).
    expect(chosen.file).not.toMatch(/favicon/i);
    // The candidate is DERIVED (not hand-invented): the set is non-empty and every
    // member satisfies the same three-way intersection.
    expect(all.length).toBeGreaterThanOrEqual(1);
    for (const c of all) {
      expect(packedFiles()).toContain(c.file);
      expect(STATIC_KINDS).toContain(path.extname(c.file));
    }
  });

  it('T021 (ARM 1 — positive control): the unmodified crafted fixture builds GREEN', () => {
    const build = buildFixture(craftFixture);
    expect(build.status, `positive-control build must succeed:\n${build.output}`).toBe(0);
    expect(existsSync(path.join(craftFixture, 'dist'))).toBe(true);
    // A real consumer artifact proves the toolkit routes actually ran.
    expect(existsSync(path.join(craftFixture, 'dist', 'api', 'index.json'))).toBe(true);
  }, 600_000);

  it('T022 (ARM 2 — fail-closed): removing the derived module FAILS the build, naming the specifier', () => {
    const { chosen } = derived;
    const toolkitRoot = realpathSync(
      path.join(craftFixture, 'node_modules', TOOLKIT_NAME),
    );
    const victim = path.join(toolkitRoot, chosen.file);
    // Sanity: it was really shipped/installed before we remove it.
    expect(existsSync(victim), `expected installed toolkit to contain ${chosen.file}`).toBe(true);
    rmSync(victim); // remove exactly ONE file from the installed tarball contents

    const build = buildFixture(craftFixture);

    // Fail-closed: a non-zero exit…
    expect(build.status, `fail-closed build must NOT succeed:\n${build.output}`).not.toBe(0);
    // …with a message NAMING the unresolved specifier (contract C-2/C-4).
    expect(build.output).toContain(chosen.specifier);
  }, 600_000);
});
