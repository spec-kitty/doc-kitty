/**
 * charter-governance.test.ts — an adopter authors a Documentation Charter and its
 * governance is enforced END-TO-END through the SHIPPED gate (documentation-charter
 * mission, WP05 / T024; contracts C3/C4/C5; US1/US3; FR-005/FR-006).
 *
 * WHAT THIS PROVES
 * ----------------
 * A real consumer drops a single `_meta/charter.yaml` into their docs root and the
 * toolkit's shipped `scripts/validate-frontmatter.mjs` gate honors all three
 * FULLY-WIRED axes, each verified as a DIFFERENTIAL (charter vs. the canonical,
 * no-charter baseline) so every assertion genuinely BITES rather than always-passing:
 *
 *   • forbidden vocabulary term  — `type: Feature` FAILS the gate under the charter
 *       ban; under the canonical baseline the same page only warns ("path suggests").
 *   • added lifecycle status     — `doc_status: reviewed` is clean under the charter
 *       (statuses.add: [reviewed]); under the canonical baseline it warns
 *       ("not in the legal set"). `reviewed` is a GENUINE new status — canonical
 *       STATUSES already include `deprecated`, so adding `reviewed` is not a no-op.
 *   • relaxed non-floor field    — a page missing `description` PASSES under the
 *       charter (required_fields.optional: [description]); under the canonical
 *       baseline it FAILS ("`description`: required").
 *   • title floor (invariant)    — a `title`-less page FAILS under BOTH the charter
 *       and the baseline: `title` is a floor and can never be relaxed.
 *
 * TARBALL LINKAGE (not a weakening)
 * --------------------------------
 * The behavioral runs invoke the gate from the repo `src/scripts/` for speed and to
 * resolve `gray-matter`/`zod` from the workspace, but `assertShippedGateParity()`
 * packs the toolkit, extracts the tarball, and asserts the gate script AND its two
 * `lib/` dependencies ship BYTE-IDENTICAL — so the gate exercised here is exactly the
 * one a clean-room adopter runs from `node_modules/@commondocs-kitty/toolkit/scripts`.
 *
 * KNOWN WIRING (recorded in CHARTER-EVIDENCE.md, honest, out of WP05's owned scope):
 * the standalone gate's forbidden-TERM *failure* currently reads the vocabulary axis
 * via `loadVocabulary` (legacy `_meta/vocabulary.yaml`); the charter's vocabulary axis
 * feeds `resolveGovernance().resolveType` (the resolver the Astro build's
 * type-derivation consumes — asserted directly below). The adopter fixture therefore
 * mirrors the forbidden term into `_meta/vocabulary.yaml` so the standalone gate bites
 * today. Wiring the gate's type/kind resolver onto `resolveGovernance` (parallel to
 * the already-wired statuses/required axes) is a documented fast-follow.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGovernance } from '../../src/lib/vocabulary-loader.mjs';
import { STATUSES, CANONICAL_REQUIRED } from '../../src/lib/vocabulary-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // tests/consumption
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const GATE = path.join(SRC_DIR, 'scripts', 'validate-frontmatter.mjs');
const ADOPTER = path.join(HERE, 'charter-fixtures', 'adopter');
// Isolates the charter-ONLY enforcement path (see the describe block below):
// this root carries `_meta/charter.yaml` forbidding `type: Feature` and
// deliberately NO legacy `_meta/vocabulary.yaml`, unlike `adopter/` above
// (whose fixture mirrors the ban into `_meta/vocabulary.yaml` — see the
// module doc's "KNOWN WIRING" note). A gate that regressed to reading the
// forbidden-type ban from `loadVocabulary` instead of `resolveGovernance`
// would pass this fixture undetected.
const CHARTER_ONLY = path.join(HERE, 'charter-fixtures', 'charter-only');

/** Run the shipped gate over a docs root; capture combined stdout+stderr + status. */
function runGate(root: string): { status: number; output: string } {
  const res = spawnSync('node', [GATE, root, '--index-basename', 'README,index'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) return { status: 1, output: String(res.error.message) };
  return { status: res.status ?? 1, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

/** A canonical (no-charter, no-vocabulary) copy of the adopter root, in a temp dir. */
function canonicalBaseline(): { root: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-charter-baseline-'));
  const root = path.join(dir, 'adopter');
  cpSync(ADOPTER, root, { recursive: true });
  rmSync(path.join(root, '_meta'), { recursive: true, force: true });
  return { root, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Pack the toolkit, extract the tarball, and assert the gate + its lib deps ship
 * byte-identical to the repo copies — so the behavioral gate runs are the shipped gate.
 */
function assertShippedGateParity(): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-charter-pack-'));
  try {
    const pack = spawnSync('npm', ['pack', '--json', '--pack-destination', dir], {
      cwd: SRC_DIR,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    if (pack.status !== 0) throw new Error(`npm pack failed:\n${pack.stderr}`);
    const tgz = readdirSync(dir).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error('npm pack produced no tarball');
    const extract = spawnSync('tar', ['-xzf', path.join(dir, tgz), '-C', dir], {
      encoding: 'utf8',
    });
    if (extract.status !== 0) throw new Error(`tar extract failed:\n${extract.stderr}`);
    const pkg = path.join(dir, 'package'); // npm tarballs root everything under package/
    const shipped = [
      ['scripts/validate-frontmatter.mjs', path.join(SRC_DIR, 'scripts', 'validate-frontmatter.mjs')],
      ['lib/vocabulary-loader.mjs', path.join(SRC_DIR, 'lib', 'vocabulary-loader.mjs')],
      ['lib/vocabulary-core.mjs', path.join(SRC_DIR, 'lib', 'vocabulary-core.mjs')],
    ] as const;
    for (const [rel, repoPath] of shipped) {
      const inTarball = path.join(pkg, rel);
      expect(existsSync(inTarball), `${rel} must ship in the tarball`).toBe(true);
      expect(
        readFileSync(inTarball, 'utf8'),
        `${rel} in the tarball must be byte-identical to the repo copy`,
      ).toBe(readFileSync(repoPath, 'utf8'));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('adopter Documentation Charter — governance through the shipped gate (T024)', () => {
  let charterRun: { status: number; output: string };
  let baseline: { root: string; cleanup: () => void };
  let baselineRun: { status: number; output: string };

  beforeAll(() => {
    assertShippedGateParity();
    charterRun = runGate(ADOPTER);
    baseline = canonicalBaseline();
    baselineRun = runGate(baseline.root);
  }, 120_000);

  it('the shipped gate + its lib deps are byte-identical in the packed tarball', () => {
    // (Assertion runs in beforeAll; a no-op body keeps the guarantee visible as a case.)
    expect(charterRun).toBeDefined();
  });

  it('added status `reviewed` PASSES under the charter, WARNS under the canonical baseline', () => {
    // Under the charter: no legal-set warning anywhere, and added-status.md never fails.
    expect(charterRun.output).not.toContain('not in the legal set');
    expect(charterRun.output).not.toMatch(/✖[^\n]*added-status\.md/);
    // Differential: without the charter, the SAME page warns — proving the axis bites.
    expect(baselineRun.output).toMatch(/added-status\.md:[^\n]*not in the legal set/);
  });

  it('relaxed `description` PASSES under the charter, FAILS under the canonical baseline', () => {
    expect(charterRun.output).not.toMatch(/✖[^\n]*relaxed-no-description\.md/);
    // Differential: without the charter, the missing `description` is a hard failure.
    expect(baselineRun.output).toMatch(/relaxed-no-description\.md\n\s+-[^\n]*description[^\n]*required/);
  });

  it('a `title`-less page FAILS under BOTH the charter and the baseline (floor invariant)', () => {
    expect(charterRun.status).not.toBe(0);
    expect(charterRun.output).toMatch(/missing-title\.md\n\s+-[^\n]*title[^\n]*required/);
    expect(baselineRun.output).toMatch(/missing-title\.md\n\s+-[^\n]*title[^\n]*required/);
  });

  it('a charter-forbidden `type` FAILS the shipped gate; the canonical baseline only warns', () => {
    // Enforcement bites under the ban…
    expect(charterRun.output).toMatch(
      /forbidden-type\.md\n\s+-[^\n]*forbidden by the vocabulary/,
    );
    // …and is NOT a mere always-failing rig: without the ban the same page only
    // gets the advisory "path suggests" warning (no forbidden failure).
    expect(baselineRun.output).not.toContain('forbidden by the vocabulary');
    expect(baselineRun.output).toMatch(/forbidden-type\.md:[^\n]*path suggests/);
  });

  it('the charter is honored by the wired resolver (`resolveGovernance`) the build consumes', () => {
    const g = resolveGovernance(ADOPTER, { emitDeprecation: false });
    // Vocabulary axis: `Feature` is forbidden, and the resolution provenance is the CHARTER.
    expect(g.resolveType('Feature').forbidden).toBe(true);
    expect(g.sources.types).toBe('charter');
    // Statuses axis: `reviewed` is legal and resolves to itself (extend-only add).
    expect(g.legalStatuses).toContain('reviewed');
    expect(g.resolveStatus('reviewed')).toBe('reviewed');
    // Canonical statuses stay reserved (extend-only never removes them).
    for (const s of STATUSES) expect(g.legalStatuses).toContain(s);
    // Required-fields axis: `description` relaxed, `title` floor retained.
    expect(g.requiredFields.required).not.toContain('description');
    expect(g.requiredFields.floor).toContain('title');
  });

  // Teardown for the temp baseline dir.
  it('cleanup', () => {
    baseline.cleanup();
    expect(true).toBe(true);
  });
});

describe('a charter-only forbidden `type` — NO legacy `_meta/vocabulary.yaml` in the root (#99 gap)', () => {
  // Regression guard for the mission's headline claim: a `type` forbidden ONLY
  // in `_meta/charter.yaml` (no legacy vocabulary file anywhere in the root)
  // must FAIL the shipped gate. `adopter/` cannot prove this alone — its
  // fixture mirrors the ban into `_meta/vocabulary.yaml`, so that suite would
  // still pass even if the gate's vocab wiring were reverted to the legacy-only
  // `loadVocabulary(root)`. This fixture has no such mirror.
  it('FAILS the gate with the forbidden-type error, not merely a "path suggests" warning', () => {
    expect(existsSync(path.join(CHARTER_ONLY, '_meta', 'vocabulary.yaml'))).toBe(false);
    const run = runGate(CHARTER_ONLY);
    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/forbidden-type\.md\n\s+-[^\n]*forbidden by the vocabulary/);
    expect(run.output).not.toMatch(/forbidden-type\.md:[^\n]*path suggests/);
  });
});
