/**
 * charter-cleanroom.test.ts — the charter's portability proof (documentation-charter
 * mission, WP05 / T025 + T026; contract C7; NFR-001 / NFR-002; SC-003).
 *
 * T025 — ZERO SPEC KITTY *RUNTIME* COUPLING (NFR-001, refined by ADR-0043). The packed
 * tarball a real adopter installs must carry NO Spec Kitty runtime coupling: no import
 * of the `spec-kitty` engine or any other `@spec-kitty/*` package, no `DoctrineService`
 * symbol, no such dependency in the package manifest — and the shipped gate must resolve
 * a charter with NO Spec Kitty on PATH. The guard is PRECISE, not a substring grep: the
 * toolkit legitimately SHIPS a self-contained `spec-kitty` BRAND theme
 * (`themes/spec-kitty/**`, `specKittyTheme`, the wordmark "Spec Kitty"), and — since the
 * package itself now ships UNDER the `@spec-kitty` scope as `@spec-kitty/doc-toolkit`
 * (ADR-0043) — its OWN self-reference (the package name + its subpath exports) is a
 * self-import, not runtime coupling, and is exempt. A naive `grep spec-kitty` would
 * false-positive on all of those, forcing a weakened or fake guard. So the guard matches
 * import/require STATEMENT forms whose specifier is a NON-self spec-kitty PACKAGE, plus
 * the `DoctrineService` identifier — and a bites-test plants every forbidden form
 * (caught, including a `@spec-kitty/doc-toolkit`-prefixed look-alike) alongside every
 * benign brand + self-reference form (ignored).
 *
 * T026 — NON-REGRESSION (NFR-002). A legacy-only adopter (a `_meta/sections.yaml`,
 * NO `charter.yaml`) resolves governance to the canonical shipped defaults, exactly
 * as before the charter existed — asserted against BOTH the committed legacy-clean
 * fixture and the real `consumer-fixture/docs`.
 *
 * The tarball is PACKED + EXTRACTED (no pnpm install needed), so this runs in the
 * half-materialized local env and in the consumption-test CI workflow alike.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGovernance } from '../../src/lib/vocabulary-loader.mjs';
import { STATUSES, CANONICAL_REQUIRED } from '../../src/lib/vocabulary-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const GATE = path.join(SRC_DIR, 'scripts', 'validate-frontmatter.mjs');
const LEGACY_CLEAN = path.join(HERE, 'charter-fixtures', 'legacy-clean');
const CONSUMER_FIXTURE_DOCS = path.join(HERE, 'consumer-fixture', 'docs');

// ── the precise zero-Spec-Kitty scanner (shared by the real-tarball scan and the
//    bites-test) ───────────────────────────────────────────────────────────────
const SPEC = String.raw`@?spec[-_]?kitty(?:\/[^'"\x60]*)?`;
const IMPORT_FORMS: RegExp[] = [
  new RegExp(String.raw`\bfrom\s*['"\x60](${SPEC})['"\x60]`, 'g'), //         import x from 'spec-kitty'
  new RegExp(String.raw`\bimport\s*['"\x60](${SPEC})['"\x60]`, 'g'), //       import 'spec-kitty'
  new RegExp(String.raw`\bimport\s*\(\s*['"\x60](${SPEC})['"\x60]`, 'g'), //  import('spec-kitty')
  new RegExp(String.raw`\brequire\s*\(\s*['"\x60](${SPEC})['"\x60]`, 'g'), // require('spec-kitty')
];
const DOCTRINE = /\bDoctrineService\b/;

// The toolkit ships UNDER the `@spec-kitty` npm scope as `@spec-kitty/doc-toolkit`
// (ADR-0043). Its OWN self-reference — the package name and the subpath exports that
// resolve in a consumer's `node_modules` — is a self-import, NOT Spec Kitty *runtime*
// coupling, so it is exempt. Every OTHER `@spec-kitty/*` package (e.g. `@spec-kitty/core`),
// a differently-named look-alike (`@spec-kitty/doc-toolkit-internals`), bare `spec-kitty`,
// and the `DoctrineService` symbol remain forbidden.
const SELF_PKG = '@spec-kitty/doc-toolkit';
const isSelfRef = (spec: string): boolean =>
  spec === SELF_PKG || spec.startsWith(`${SELF_PKG}/`);

/** Forbidden Spec Kitty couplings found in `text` (empty ⇒ clean). */
function scanText(text: string): string[] {
  const hits: string[] = [];
  for (const re of IMPORT_FORMS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (!isSelfRef(m[1])) hits.push(`import ${m[1]}`);
    }
  }
  if (DOCTRINE.test(text)) hits.push('DoctrineService');
  return hits;
}

const SCANNABLE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|astro|css|json|md)$/;

/** Recursively list scannable files under a dir. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (SCANNABLE.test(p)) out.push(p);
  }
  return out;
}

// ── tarball lifecycle (pack + extract; no install) ──────────────────────────────
let workDir = '';
let pkgDir = ''; // <tmp>/package — the extracted tarball root

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'dk-charter-cleanroom-'));
  const pack = spawnSync('npm', ['pack', '--json', '--pack-destination', workDir], {
    cwd: SRC_DIR,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (pack.status !== 0) throw new Error(`npm pack failed:\n${pack.stderr}`);
  const tgz = readdirSync(workDir).find((f) => f.endsWith('.tgz'));
  if (!tgz) throw new Error('npm pack produced no tarball');
  const extract = spawnSync('tar', ['-xzf', path.join(workDir, tgz), '-C', workDir], {
    encoding: 'utf8',
  });
  if (extract.status !== 0) throw new Error(`tar extract failed:\n${extract.stderr}`);
  pkgDir = path.join(workDir, 'package');
  if (!existsSync(pkgDir)) throw new Error('extracted tarball has no package/ root');
}, 120_000);

afterAll(() => {
  if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

describe('T025 — the packed tarball carries ZERO Spec Kitty coupling (NFR-001)', () => {
  it('no shipped file imports Spec Kitty or references DoctrineService', () => {
    const files = walk(pkgDir);
    // Sanity: we actually scanned the toolkit (incl. the brand theme that tempts a
    // naive grep) — an empty scan would make a green vacuous.
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.includes(path.join('themes', 'spec-kitty')))).toBe(true);

    const offenders: Array<{ file: string; hits: string[] }> = [];
    for (const f of files) {
      const hits = scanText(readFileSync(f, 'utf8'));
      if (hits.length) offenders.push({ file: path.relative(pkgDir, f), hits });
    }
    expect(offenders, `Spec Kitty coupling found in the tarball: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('the packed package.json declares no spec-kitty / doctrine dependency', () => {
    const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
      ...pkg.optionalDependencies,
    };
    const bad = Object.keys(deps).filter((k) => /^@?spec[-_]?kitty|doctrine/i.test(k));
    expect(bad, `unexpected dependency: ${bad.join(', ')}`).toEqual([]);
  });

  it('the guard BITES: every forbidden form is caught, the brand theme is not', () => {
    // Forbidden couplings — MUST be flagged (the guard is not vacuous). This includes
    // every `@spec-kitty/*` package that is NOT the toolkit itself, and a look-alike
    // that merely shares the `@spec-kitty/doc-toolkit` prefix (ADR-0043).
    for (const planted of [
      `import { DoctrineService } from 'spec-kitty';`,
      `import 'spec-kitty/runtime';`,
      `const x = require('@spec-kitty/core');`,
      `await import("spec_kitty");`,
      `foo.DoctrineService.resolve();`,
      `import { engine } from '@spec-kitty/doc-toolkit-internals';`,
    ]) {
      expect(scanText(planted), `should flag: ${planted}`).not.toEqual([]);
    }
    // Legitimate brand-theme + prose + the toolkit's OWN self-reference — MUST stay
    // clean (the guard is precise; the package ships under @spec-kitty, ADR-0043).
    for (const benign of [
      `import { specKittyTheme } from '@spec-kitty/doc-toolkit/themes/spec-kitty';`,
      `import toolkit from '@spec-kitty/doc-toolkit';`,
      "// Self-contained (no `@spec-kitty/*` runtime).",
      `const { wordmark = 'Spec Kitty' } = Astro.props;`,
      `background: url('/themes/spec-kitty/assets/logo.svg');`,
      "* references `@spec-kitty/*`, a CDN, or the spec-kitty-design repo",
      `import { resolveGovernance } from '@spec-kitty/doc-toolkit/schema';`,
    ]) {
      expect(scanText(benign), `should NOT flag: ${benign}`).toEqual([]);
    }
  });

  it('the shipped gate resolves a charter with NO Spec Kitty on PATH', () => {
    // A minimal PATH containing ONLY the Node binary's dir — no `spec-kitty` binary
    // is resolvable — and every SPEC_KITTY_* / KITTIFY_* env var stripped.
    const cleanEnv: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (/^(SPEC_KITTY|KITTIFY|SPECKITTY)/i.test(k)) continue;
      cleanEnv[k] = v;
    }
    cleanEnv.PATH = path.dirname(process.execPath);
    const res = spawnSync('node', [GATE, LEGACY_CLEAN, '--index-basename', 'README,index'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: cleanEnv,
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(res.error).toBeFalsy();
    expect(res.status, `gate output:\n${res.stdout}\n${res.stderr}`).toBe(0);
    expect(`${res.stdout}${res.stderr}`).toMatch(/valid against DocKitty/);
  });
});

describe('T026 — legacy-only non-regression: canonical defaults (NFR-002)', () => {
  for (const [label, root] of [
    ['committed legacy-clean fixture', LEGACY_CLEAN],
    ['real consumer-fixture/docs', CONSUMER_FIXTURE_DOCS],
  ] as const) {
    it(`${label} resolves governance to the canonical shipped defaults`, () => {
      const g = resolveGovernance(root, { emitDeprecation: false });
      // No charter present anywhere on this root.
      expect(g.sourceMeta.fromCharter).toBe(false);
      // Statuses + required-fields fall back to the canonical constants, unchanged.
      expect(g.legalStatuses).toEqual([...STATUSES]);
      expect(g.requiredFields.required).toEqual([...CANONICAL_REQUIRED]);
      // No charter axis won anything.
      expect(g.sources.statuses).toBe('default');
      expect(g.sources.requiredFields).toBe('default');
    });
  }

  it('the legacy-clean fixture passes the shipped gate (green, no charter tooling)', () => {
    const res = spawnSync('node', [GATE, LEGACY_CLEAN, '--index-basename', 'README,index'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(res.status, `${res.stdout}\n${res.stderr}`).toBe(0);
  });
});
