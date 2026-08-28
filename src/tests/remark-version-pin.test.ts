import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Issue #21 guard. `page-processor.ts` pins `remark-gfm@4.0.1` /
 * `remark-smartypants@3.0.3` in `package.json` to the exact versions
 * Astro/Starlight's markdown pipeline (`@astrojs/markdown-remark`) resolves —
 * see the version-pin note at the top of `src/lib/glossary/page-processor.ts`.
 * That pin was, until now, enforced only by a code comment: an Astro/Starlight
 * bump that moves `@astrojs/markdown-remark`'s transitive `remark-gfm` /
 * `remark-smartypants` versions would silently re-open the defect class issue
 * #16 fixed (the render-time re-derive parsing differently from the real
 * build) with nothing failing loudly.
 *
 * This test re-derives, independently of the pinned comment, the version
 * Astro's pipeline ACTUALLY resolves today and asserts it equals the pin.
 * See `resolveViaInstalledAstroPipeline` for the primary resolution strategy
 * and `resolveViaLockfile` for its fallback. Only Node builtins are used — no
 * new dependency.
 */

const nodeRequire = createRequire(import.meta.url);
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ROOT_PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const LOCKFILE = path.join(REPO_ROOT, 'pnpm-lock.yaml');

/** The two packages `page-processor.ts` pins to Astro's resolved versions. */
const PINNED_PACKAGES = ['remark-gfm', 'remark-smartypants'] as const;
type PinnedPackage = (typeof PINNED_PACKAGES)[number];

/** Read the toolkit's own declared pin for `name` out of the repo-root `package.json`. */
function readDeclaredPin(name: PinnedPackage): string {
  let pkg: { dependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8'));
  } catch (err) {
    throw new Error(
      `remark-version-pin guard: could not read/parse ${ROOT_PACKAGE_JSON}: ${(err as Error).message}`,
      { cause: err },
    );
  }
  const pin = pkg.dependencies?.[name];
  if (typeof pin !== 'string' || pin.length === 0) {
    throw new Error(
      `remark-version-pin guard: ${ROOT_PACKAGE_JSON} has no dependencies["${name}"] pin. ` +
        `page-processor.ts (issue #16 / #21) expects this toolkit to pin an exact ` +
        `version of "${name}" to match Astro/Starlight's resolved version.`,
    );
  }
  return pin;
}

/**
 * Primary source: chain-resolve `astro` -> `@astrojs/markdown-remark` ->
 * `remark-gfm` / `remark-smartypants`, hopping one `createRequire` anchor at a
 * time so each hop only ever resolves a package that is a REAL dependency of
 * the previous one. This matters under pnpm's strict, non-hoisted
 * `node_modules` layout: `@astrojs/markdown-remark` is a transitive dependency
 * (of `astro`, a direct devDependency of this toolkit), not a direct one, so a
 * flat `require.resolve('@astrojs/markdown-remark/...')` from this test file
 * would not see it. Anchoring the resolution at `astro`'s own installed
 * location first — then at `@astrojs/markdown-remark`'s own location — replays
 * Node's module resolution the exact way the real build does it, so we read
 * the version each package actually imports rather than a declared semver range.
 */
function resolveViaInstalledAstroPipeline(): Record<PinnedPackage, string> {
  let astroPkgJsonPath: string;
  try {
    astroPkgJsonPath = nodeRequire.resolve('astro/package.json');
  } catch (err) {
    throw new Error(
      `could not resolve "astro/package.json" from this test file (astro is expected to be a ` +
        `devDependency of src/package.json): ${(err as Error).message}`,
      { cause: err },
    );
  }

  let markdownRemarkPkgJsonPath: string;
  try {
    markdownRemarkPkgJsonPath = createRequire(astroPkgJsonPath).resolve(
      '@astrojs/markdown-remark/package.json',
    );
  } catch (err) {
    throw new Error(
      `could not resolve "@astrojs/markdown-remark/package.json" from astro's installed ` +
        `location (${astroPkgJsonPath}): ${(err as Error).message}`,
      { cause: err },
    );
  }

  const anchorRequire = createRequire(markdownRemarkPkgJsonPath);
  const versions = {} as Record<PinnedPackage, string>;
  for (const name of PINNED_PACKAGES) {
    let resolvedPkgJsonPath: string;
    try {
      resolvedPkgJsonPath = anchorRequire.resolve(`${name}/package.json`);
    } catch (err) {
      throw new Error(
        `could not resolve "${name}/package.json" from @astrojs/markdown-remark's installed ` +
          `location (${markdownRemarkPkgJsonPath}): ${(err as Error).message}`,
        { cause: err },
      );
    }
    const resolvedPkg = JSON.parse(readFileSync(resolvedPkgJsonPath, 'utf8'));
    if (typeof resolvedPkg.version !== 'string' || resolvedPkg.version.length === 0) {
      throw new Error(`${resolvedPkgJsonPath} has no string "version" field.`);
    }
    versions[name] = resolvedPkg.version;
  }
  return versions;
}

/**
 * Fallback source: parse `pnpm-lock.yaml`'s `@astrojs/markdown-remark`
 * snapshot (the block that lists its RESOLVED dependency versions, not the
 * bare `packages:` listing) for the `remark-gfm` / `remark-smartypants`
 * entries.
 */
function resolveViaLockfile(): Record<PinnedPackage, string> {
  if (!existsSync(LOCKFILE)) {
    throw new Error(`remark-version-pin guard: lockfile fallback unavailable — no file at ${LOCKFILE}.`);
  }
  const lines = readFileSync(LOCKFILE, 'utf8').split('\n');
  const headerRe = /^ {2}'@astrojs\/markdown-remark@[^']*':\s*$/;

  const snapshots: Partial<Record<PinnedPackage, string>>[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!headerRe.test(lines[i])) continue;
    const block: string[] = [];
    for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
      block.push(lines[j]);
    }
    const snapshot: Partial<Record<PinnedPackage, string>> = {};
    for (const name of PINNED_PACKAGES) {
      const depLine = block.find((l) => new RegExp(`^\\s*${name}:\\s+\\S+`).test(l));
      const match = depLine?.match(new RegExp(`^\\s*${name}:\\s+(\\S+)`));
      if (match) snapshot[name] = match[1].replace(/\(.*$/, '');
    }
    if (snapshot['remark-gfm'] || snapshot['remark-smartypants']) snapshots.push(snapshot);
  }

  const complete = snapshots.filter(
    (s): s is Record<PinnedPackage, string> => Boolean(s['remark-gfm'] && s['remark-smartypants']),
  );
  if (complete.length === 0) {
    throw new Error(
      `remark-version-pin guard: found no '@astrojs/markdown-remark' snapshot in ${LOCKFILE} ` +
        `carrying both remark-gfm and remark-smartypants resolved versions. The lockfile shape ` +
        `may have changed — update this guard's parser (issue #21).`,
    );
  }
  const gfmVersions = new Set(complete.map((s) => s['remark-gfm']));
  const smartypantsVersions = new Set(complete.map((s) => s['remark-smartypants']));
  if (gfmVersions.size > 1 || smartypantsVersions.size > 1) {
    throw new Error(
      `remark-version-pin guard: ${LOCKFILE} resolves multiple distinct remark-gfm/remark-smartypants ` +
        `versions across '@astrojs/markdown-remark' snapshots (remark-gfm: ${[...gfmVersions].join(', ')}; ` +
        `remark-smartypants: ${[...smartypantsVersions].join(', ')}) — cannot determine a single Astro-resolved version.`,
    );
  }
  return complete[0];
}

/** Determine the version(s) Astro/Starlight's markdown pipeline resolves today. */
function resolveAstroPipelineVersions(): Record<PinnedPackage, string> {
  try {
    return resolveViaInstalledAstroPipeline();
  } catch (installedErr) {
    try {
      return resolveViaLockfile();
    } catch (lockfileErr) {
      throw new Error(
        `remark-version-pin guard: could not determine the remark-gfm / remark-smartypants ` +
          `versions Astro's markdown pipeline resolves.\n` +
          `  - installed-package resolution failed: ${(installedErr as Error).message}\n` +
          `  - pnpm-lock.yaml fallback failed: ${(lockfileErr as Error).message}\n` +
          `Run "pnpm install" at the repo root and retry. If both sources are genuinely gone, ` +
          `investigate whether @astrojs/markdown-remark's dependency shape changed (issue #21 / ` +
          `the version-pin note in src/lib/glossary/page-processor.ts).`,
        { cause: lockfileErr },
      );
    }
  }
}

describe('remark-gfm / remark-smartypants version pin (issue #21 guard)', () => {
  it("keeps package.json's pins equal to the versions Astro/Starlight's markdown pipeline resolves", () => {
    const astroResolved = resolveAstroPipelineVersions();

    for (const name of PINNED_PACKAGES) {
      const declared = readDeclaredPin(name);
      expect(
        declared,
        `package.json pins "${name}" at ${declared}, but Astro/Starlight's markdown pipeline ` +
          `(@astrojs/markdown-remark) now resolves "${name}"@${astroResolved[name]}. This is the ` +
          `defect class issue #16 fixed: page-processor.ts's re-derive parse must match the real ` +
          `build substrate. Re-pin package.json's "${name}" to ${astroResolved[name]} and update ` +
          `the version-pin note in src/lib/glossary/page-processor.ts (see issue #21).`,
      ).toBe(astroResolved[name]);
    }
  });
});
