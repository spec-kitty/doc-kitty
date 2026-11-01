/**
 * crafted-fixture.ts — shared helpers for the consumption self-tests that build a
 * THROWAWAY copy of the consumer fixture from a packed toolkit tarball
 * (consumption-gap.test.ts, openapi-optin.test.ts). The committed fixture is never
 * mutated; every copy lives in a temp dir that the caller removes.
 *
 * Harness notes (environment, not weakening):
 *  - Copies are created on the same filesystem as the pnpm store (under ~/.cache when
 *    available) so a `--prefer-offline` install reuses the content-addressable store.
 *  - Copies get Astro's passthrough (noop) image service: `sharp`'s native binary is
 *    not reliably resolvable from Astro's build-time dynamic import under pnpm's
 *    strict node_modules, and image optimisation is orthogonal to what these tests
 *    prove. Applied identically to every copy of one test.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pinToolkitIntegrity } from './scripts/pin-toolkit-integrity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // tests/consumption
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const SRC_DIR = path.join(REPO_ROOT, 'src'); // the @spec-kitty/doc-toolkit package
export const FIXTURE_DIR = path.join(HERE, 'consumer-fixture');

/** Run a command, capturing combined stdout+stderr. */
export function capture(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): { status: number; output: string } {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) return { status: 1, output: String(res.error.message) };
  return { status: res.status ?? 1, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

/** A base dir on the SAME filesystem as the pnpm store; falls back to the system temp dir. */
export function tempBase(): string {
  const cache = path.join(homedir(), '.cache');
  try {
    mkdirSync(cache, { recursive: true });
    return cache;
  } catch {
    return tmpdir();
  }
}

/** A fresh temp root for one test file's copies. The caller removes it. */
export function makeCraftRoot(prefix: string): string {
  return mkdtempSync(path.join(tempBase(), prefix));
}

/** Copy a fixture dir (default: the committed one) into `<root>/<name>`, minus install/build artifacts. */
export function craftFixtureCopy(root: string, name = 'consumer-fixture', from = FIXTURE_DIR): string {
  const dest = path.join(root, name);
  cpSync(from, dest, {
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

/** Give a copy Astro's passthrough image service (harness note above). */
export function useNoopImageService(fixtureDir: string): void {
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

/**
 * Pack a toolkit package dir (default: this repo's `src/`) into the copy as the
 * stable `toolkit.tgz`, then point the copy's lock entry at THIS tarball: packed
 * bytes are not reproducible across machines (see scripts/pin-toolkit-integrity.mjs).
 */
export function packToolkit(fixtureDir: string, packageDir = SRC_DIR): void {
  const res = spawnSync('npm', ['pack', '--json', '--pack-destination', fixtureDir], {
    cwd: packageDir,
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
  pinToolkitIntegrity(fixtureDir);
}

/**
 * Optional registry override (`DK_CONSUMPTION_REGISTRY`) for machines whose user-level
 * npmrc points at an unreachable private registry. CI leaves it unset.
 */
export function registryArgs(): string[] {
  const registry = process.env.DK_CONSUMPTION_REGISTRY;
  return registry ? [`--registry=${registry}`] : [];
}

/** Install a copy in isolation, reusing the store where possible. */
export function installFixture(fixtureDir: string): { status: number; output: string } {
  return capture(
    'pnpm',
    [
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
      '--ignore-workspace',
      '--config.dangerouslyAllowAllBuilds=true',
      ...registryArgs(),
    ],
    { cwd: fixtureDir },
  );
}

/** Build a copy via its LOCAL astro binary (bypasses pnpm's deps-status recheck). */
export function buildFixture(fixtureDir: string): { status: number; output: string } {
  const distDir = path.join(fixtureDir, 'dist');
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  const astroBin = path.join(fixtureDir, 'node_modules', '.bin', 'astro');
  if (!existsSync(astroBin)) return { status: 1, output: `astro binary missing at ${astroBin}` };
  // Vitest's OWN process env carries a `BASE_URL` variable that, inherited by this
  // REAL `astro build`, would silently override the fixture's configured `base`.
  // Strip it so the child computes its own base (mirrors src/tests/example-adopter.test.ts).
  const childEnv = { ...process.env };
  delete childEnv.BASE_URL;
  return capture(astroBin, ['build'], { cwd: fixtureDir, env: childEnv });
}
