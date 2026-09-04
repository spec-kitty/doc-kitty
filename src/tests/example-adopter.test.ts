/**
 * WP04 worked-example demonstrations (adopter-loader-migration-01M1KKYA,
 * #37/#48/#42 — FR-006/FR-012/NFR-004; spec SC-001..004, US1/US2/US3;
 * data-model.md E-02/E-03/E-04/E-08).
 *
 * "The example IS the test" (WP04 test strategy): this file builds the real
 * `example/` site ONCE (a fresh build, cache cleared, so the new content is
 * genuinely re-derived — not a stale render) and asserts every capability
 * against that BUILT output, never against source Markdown alone:
 *
 *   - T019 — an `index.md`-indexed section (`plans/`) resolves to its section
 *     root in a MIXED build that also carries README-indexed sections
 *     (SC-001, NFR-003), plus the standalone validator's root-index exemption
 *     for a literal `index.md` root path (m1 anti-laziness).
 *   - T020 — the section rename `plans/features` -> `plans/missions` (frozen
 *     E-08 datum) derives its `type` via a registry-data-only `subtypes` rule
 *     (SC-002), its sidebar group renders its hub link + BOTH child pages in
 *     the built HTML (ADR-0029), and `check-links.mjs` finds zero dangling
 *     `related:`/internal links after the rename (B1/FR-006/NFR-004).
 *   - T021 — the redirect-coverage gate PASSES against the built example with
 *     the rename's old->new URLs added to the committed baseline (E-04).
 *   - T022 — both coverage failure modes (an uncovered URL; a redirect to a
 *     dead target) as FOCUSED unit tests against crafted fixtures — never a
 *     standing red CI gate.
 *   - T023 — the build succeeds and the existing (pre-WP04) corpus stays
 *     green: `assert-build-artifacts.mjs`'s pinned agent-index/sitemap counts
 *     are UNCHANGED (the new `plans/**` pages are `doc_status: draft`, so
 *     they add zero to those published-set counts — the new content changes
 *     nothing on that WP01-owned gate; see the WP04 handoff note).
 *
 * Companion (`example/docs/**`) content lives in `example/docs/plans/`;
 * `example/docs/_meta/sections.yaml` registers the section + its `subtypes`
 * rule. `example/astro.config.mjs` (redirects) and `example/url-baseline.txt`
 * are WP02-owned files WP04 extends (out-of-map, recorded there) for E-08.
 *
 * Mission: adopter-loader-migration-01M1KKYA, WP04.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { expectedTypeForPathInRoot } from '../lib/schema.js';
import {
  isRootIndex,
  validate,
  SECTION_TYPE,
  IDENTITY_VOCAB,
  expectedType,
  loadSectionTypes,
  loadSectionSubtypes,
} from '../scripts/validate-frontmatter.mjs';
import {
  checkCoverage,
  resolveVerdict,
  urlToDistFile,
} from '../scripts/check-redirect-coverage.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE_DOCS = path.join(REPO_ROOT, 'example', 'docs');
// A DEDICATED out-of-tree output dir (the WP10 `DK_OUTDIR` seam,
// example/astro.config.mjs), NOT `example/dist` — glossary-build-warning.test.ts
// also spawns a full `astro build` against `example/dist` and vitest runs test
// files concurrently; two builds racing on the SAME dist dir corrupts both
// (observed: ENOENT mid-build when this file used `example/dist` directly).
// A dedicated outDir makes the two builds independent.
const WP04_OUT_DIR_NAME = 'dist-wp04-adopter-example-test';
const EXAMPLE_DIST = path.join(REPO_ROOT, 'example', WP04_OUT_DIR_NAME);
const BASELINE_FILE = path.join(REPO_ROOT, 'example', 'url-baseline.txt');
const CHECK_REDIRECT_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check-redirect-coverage.mjs');
const VALIDATE_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate-frontmatter.mjs');
const CHECK_LINKS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check-links.mjs');
const ASSERT_ARTIFACTS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'assert-build-artifacts.mjs');

/** Read a built dist HTML file, or fail with a precise path. */
function readDist(relPath: string): string {
  const abs = path.join(EXAMPLE_DIST, relPath);
  if (!existsSync(abs)) {
    throw new Error(`expected built file missing: ${relPath} (${abs}) — was the example built?`);
  }
  return readFileSync(abs, 'utf8');
}

let buildResult: { status: number | null; stdout: string; stderr: string };

describe('WP04 worked example — real build (T019-T021, T023)', () => {
  beforeAll(() => {
    // Remove only OUR OWN prior output (never the shared example/.astro content
    // cache or example/dist — glossary-build-warning.test.ts owns clearing those
    // and may be building concurrently; see the WP04_OUT_DIR_NAME comment above).
    rmSync(EXAMPLE_DIST, { recursive: true, force: true });
    // review-cycle-1 boy-scout fix: Vitest's OWN process env carries a
    // `BASE_URL` variable (it mirrors Vite's client `import.meta.env.BASE_URL`
    // for Node-environment tests, defaulting to `/`). A naive `...process.env`
    // passthrough leaks that into this REAL `astro build` child process, where
    // it silently overrides the site's actually-configured `base` (`/doc-kitty`)
    // for every SSR-rendered `import.meta.env.BASE_URL` read (`withBase`'s
    // source) — the built pages then render EVERY component href base-less,
    // independent of and invisible before review-cycle-1's Fix B (the first
    // assertion to bind an EXACT base-prefixed href). Stripping it here lets
    // the child compute its own base from `example/astro.config.mjs`, matching
    // every other (non-spawned-under-Vitest) build of this same site.
    const childEnv = { ...process.env };
    delete childEnv.BASE_URL;
    buildResult = spawnSync('pnpm', ['--filter', 'example', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...childEnv, DK_OUTDIR: WP04_OUT_DIR_NAME },
    });
  }, 180_000);

  // -- T023: the example builds; existing corpus stays green (NFR-003) -------

  it('T023: the example build succeeds', () => {
    expect(buildResult.status, `build stderr:\n${buildResult.stderr}`).toBe(0);
    expect(existsSync(EXAMPLE_DIST)).toBe(true);
  });

  it(
    'T023: assert-build-artifacts.mjs (WP01-owned pinned ratchet) is UNCHANGED — the new plans/** ' +
      'pages are doc_status:draft, so they add zero to the published agent-index/sitemap counts',
    () => {
      const res = spawnSync('node', [ASSERT_ARTIFACTS_SCRIPT, EXAMPLE_DIST], { encoding: 'utf8' });
      expect(res.status, `assert:artifacts stderr:\n${res.stderr}`).toBe(0);
    },
  );

  // -- T019: index.md-indexed section coexists with the README corpus --------

  it('T019 (SC-001): the index.md-indexed "plans" section resolves to its section ROOT, not /plans/index/', () => {
    // The section root is served at dist/plans/index.html (Astro's normal
    // directory-format convention for ANY route) — never dist/plans/index/index.html.
    expect(existsSync(path.join(EXAMPLE_DIST, 'plans', 'index.html'))).toBe(true);
    expect(existsSync(path.join(EXAMPLE_DIST, 'plans', 'index', 'index.html'))).toBe(false);

    const html = readDist(path.join('plans', 'index.html'));
    expect(html).toContain('Plans');
  });

  it('T019 (NFR-003): README-indexed sections are UNCHANGED in the same mixed build', () => {
    // adr/README.md still serves at /adr/ — the mixed-corpus coexistence proof:
    // index.md and README.md-indexed sections resolve correctly in ONE build.
    const html = readDist(path.join('adr', 'index.html'));
    expect(html).toContain('Decision Records');
  });

  it('T019 (m1): validate-frontmatter.mjs runs clean over example/docs with the new content present', () => {
    const res = spawnSync('node', [VALIDATE_SCRIPT, 'example/docs'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(res.status, `validate:example stderr:\n${res.stderr}`).toBe(0);
    expect(res.stdout).toMatch(/valid against Common Docs/);
  });

  it('T019 (m1 anti-laziness): the root-index exemption FIRES for a literal index.md root path', () => {
    // isRootIndex/validate() only exempt the BUNDLE root (no `/` in relPath) —
    // example/docs's own bundle root stays README.md (out of WP04 scope), so
    // this is a focused, crafted-input proof that the .mjs twin's exemption
    // genuinely recognizes "index.md" as a root index once `['README','index']`
    // is the configured basename — proving the .mjs code path is REACHED, not
    // merely parity-matched against the TS twin (which section-type-parity.test.ts
    // already covers at the pure-function level).
    const opts = { indexBasename: ['README', 'index'] };
    expect(isRootIndex('index.md', opts.indexBasename)).toBe(true);
    expect(isRootIndex('plans/index.md', opts.indexBasename)).toBe(false); // nested — NOT exempt

    const { problems, warnings, effective } = validate(
      'index.md',
      {
        title: 'Root',
        description: 'The site bundle root — a hypothetical index.md-named root for this crafted input.',
        doc_status: 'active',
        updated: '2026-09-03',
        kind: 'Hub',
      },
      SECTION_TYPE,
      IDENTITY_VOCAB,
      opts,
    );
    expect(problems).toEqual([]);
    // No "bundle-root README should not carry `type`" warning — none authored.
    expect(warnings).not.toContain('bundle-root README should not carry `type`');
    expect(effective).toBeUndefined(); // type-exempt, per the bundle-root contract
  });

  // -- T020: rename derives its type via registry data only (SC-002) ---------

  it('T020 (SC-002, TS twin): plans/missions/* derives "Mission" from the REAL committed registry', () => {
    // expectedTypeForPathInRoot reads example/docs/_meta/sections.yaml itself —
    // the actual shipped registry, not a synthetic fixture (section-rename.test.ts
    // already covers the pure-function contract against synthetic YAML; this is
    // the real-corpus proof).
    expect(expectedTypeForPathInRoot('plans/missions/mission-alpha.md', EXAMPLE_DOCS)).toBe(
      'Mission',
    );
    expect(expectedTypeForPathInRoot('plans/missions/mission-beta.md', EXAMPLE_DOCS)).toBe(
      'Mission',
    );
    // The section default still applies to a plans/ page OUTSIDE the renamed
    // sub-path — proving the subtypes rule is scoped, not a section-wide override.
    expect(expectedTypeForPathInRoot('plans/roadmap.md', EXAMPLE_DOCS)).toBe('Plan');
  });

  it('T020 (SC-002, mjs twin): the bare-Node validator twin agrees, over the SAME real registry', () => {
    const typesBySection = loadSectionTypes(EXAMPLE_DOCS) ?? SECTION_TYPE;
    const subtypesBySection = loadSectionSubtypes(EXAMPLE_DOCS) ?? undefined;
    expect(expectedType('plans/missions/mission-alpha.md', typesBySection, subtypesBySection)).toBe(
      'Mission',
    );
    // Twin parity, pinned on THIS real corpus (not just synthetic fixtures).
    expect(expectedType('plans/missions/mission-alpha.md', typesBySection, subtypesBySection)).toBe(
      expectedTypeForPathInRoot('plans/missions/mission-alpha.md', EXAMPLE_DOCS),
    );
  });

  it('T020 (SC-002): no derivation-code edit was needed — the pre-rename path would still hit the BUILT-IN fallback', () => {
    // Without a registry subtypes rule, `plans/features/*` falls through to the
    // built-in `plans/features -> Feature` table (unchanged code, doc-kitty's
    // own docs/plans/features/ relies on exactly this). The registry `subtypes`
    // entry is the ONLY reason `plans/missions/*` derives "Mission" instead —
    // proving the rename is a pure data/config change.
    expect(expectedTypeForPathInRoot('plans/features/mission-alpha.md', EXAMPLE_DOCS)).toBe(
      'Feature',
    );
  });

  it('T020: the derived type is visible in the BUILT agent-API per-page record', () => {
    const json = JSON.parse(
      readDist(path.join('api', 'pages', 'plans', 'missions', 'mission-alpha.json')),
    ) as { type: string | null; section: string };
    expect(json.type).toBe('Mission');
    expect(json.section).toBe('plans');
  });

  it('T020 (ADR-0029): the sidebar group renders the plans HUB link + BOTH renamed child pages in built HTML', () => {
    // Read the sidebar out of an UNRELATED page's built HTML (the sidebar nav is
    // shared chrome, present on every page) — proving the group is really
    // rendered by Starlight, not merely a non-empty registry entry.
    const html = readDist(path.join('adr', 'index.html'));
    expect(html).toMatch(/href="[^"]*\/plans\/"/); // hub link
    expect(html).toMatch(/href="[^"]*\/plans\/missions\/mission-alpha\/"/); // child 1
    expect(html).toMatch(/href="[^"]*\/plans\/missions\/mission-beta\/"/); // child 2
    // The OLD (pre-rename) path must NOT appear as a sidebar entry — only the
    // redirect stub route exists there now, never a content page.
    expect(html).not.toMatch(/href="[^"]*\/plans\/features\//);
  });

  it('T020 (B1/FR-006/NFR-004): check-links.mjs finds ZERO dangling links after the rename', () => {
    const res = spawnSync('node', [CHECK_LINKS_SCRIPT, 'docs', 'example/docs'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(res.status, `check-links stderr/stdout:\n${res.stderr}\n${res.stdout}`).toBe(0);
    expect(res.stdout).toMatch(/reference\(s\) resolve/);
  });

  // -- T021: redirect-coverage gate passes with the rename's URLs baselined --

  it('T021 (SC-003): the redirect-coverage gate PASSES against the built example, covering the rename', () => {
    const res = spawnSync('node', [CHECK_REDIRECT_SCRIPT, BASELINE_FILE, EXAMPLE_DIST], {
      encoding: 'utf8',
    });
    expect(res.status, `redirect-coverage stderr:\n${res.stderr}`).toBe(0);
    expect(res.stdout).toMatch(/OK/);
  });

  it('T021: the old plans/features/* URLs resolve via the redirect to their live plans/missions/* pages', () => {
    const alpha = resolveVerdict(EXAMPLE_DIST, '/plans/features/mission-alpha/');
    expect(alpha.covered).toBe(true);
    expect(alpha.chain).toEqual([
      { from: '/plans/features/mission-alpha/', to: '/plans/missions/mission-alpha/' },
    ]);

    const beta = resolveVerdict(EXAMPLE_DIST, '/plans/features/mission-beta/');
    expect(beta.covered).toBe(true);
    expect(beta.chain).toEqual([
      { from: '/plans/features/mission-beta/', to: '/plans/missions/mission-beta/' },
    ]);
  });
});

// -- T022: both coverage failure modes as FOCUSED tests (never a red CI gate) --
//
// Crafted, self-contained dist fixtures (no dependency on the real example
// build) — mirrors redirect-coverage.test.ts's (WP02) fixture style, scoped
// here to the two failure modes named by the WP04 task: an uncovered URL, and
// a redirect whose target is dead. These PROVE the gate correctly FAILS on bad
// input; they are never wired into a standing CI gate that could red the merge.

describe('WP04 worked example — coverage gate failure modes (T022)', () => {
  const tmpDirs: string[] = [];

  function makeTmpDist(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'wp04-redirect-coverage-'));
    tmpDirs.push(dir);
    return dir;
  }

  function writePage(distDir: string, urlPath: string, html: string): void {
    const file = urlToDistFile(distDir, urlPath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, html, 'utf8');
  }

  function redirectStubHtml(target: string): string {
    return [
      '<!doctype html>',
      `<title>Redirecting to: ${target}</title>`,
      `<meta http-equiv="refresh" content="0;url=${target}">`,
      '</body>',
    ].join('\n');
  }

  it('FAILURE MODE 1 — an uncovered URL (no page, no redirect) fails the gate, naming the URL', () => {
    const dist = makeTmpDist();
    writePage(dist, '/plans/', '<!doctype html><title>Plans</title><body>hub</body>');
    // /plans/missions/mission-gamma/ is baselined but was never built and has no
    // redirect — this is the "forgot to redirect a renamed/removed page" defect.
    const baseline = ['/plans/', '/plans/missions/mission-gamma/'];

    const { ok, uncovered } = checkCoverage(dist, baseline);

    expect(ok).toBe(false);
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0].url).toBe('/plans/missions/mission-gamma/');
    expect(uncovered[0].reason).toBe('no page and no redirect');
  });

  it('FAILURE MODE 2 — a redirect to a DEAD target fails the gate, naming the true failing target (B1/D-05)', () => {
    const dist = makeTmpDist();
    // The redirect stub exists (as it would right after a rename lands), but its
    // destination was never built — e.g. a typo'd new path in astro.config.mjs's
    // REDIRECTS map. A gate that only checked "a redirect exists" would rubber-
    // stamp this; the target-aware gate must not.
    writePage(
      dist,
      '/plans/features/mission-alpha/',
      redirectStubHtml('/plans/missions/mission-alpha-typo/'),
    );
    // Deliberately NOT writing /plans/missions/mission-alpha-typo/.

    const verdict = resolveVerdict(dist, '/plans/features/mission-alpha/');

    expect(verdict.covered).toBe(false);
    expect(verdict.reason).toBe('redirect target is dead');
    expect(verdict.failingTarget).toBe('/plans/missions/mission-alpha-typo/');

    const { ok, uncovered } = checkCoverage(dist, ['/plans/features/mission-alpha/']);
    expect(ok).toBe(false);
    expect(uncovered[0].failingTarget).toBe('/plans/missions/mission-alpha-typo/');
  });

  it('cleans up its crafted fixtures', () => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
    expect(tmpDirs).toHaveLength(0);
  });
});
