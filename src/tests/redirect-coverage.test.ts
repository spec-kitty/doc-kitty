/**
 * ATDD (T009) for the redirect-coverage primitive (FR-008..011, NFR-002/005,
 * US3; contracts/redirect-coverage-gate.md; E-03/E-04/E-07).
 *
 * Red-first per the WP02 task: pass case, uncovered-URL fail case,
 * redirect-to-dead-target fail case (target-aware — post-spec BLOCKER B1,
 * the whole reason this primitive exists), and chain-resolution.
 *
 * Mission: adopter-loader-migration-01M1KKYA, WP02.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  normalizeUrlPath,
  urlToDistFile,
  inspectDistUrl,
  resolveVerdict,
  parseBaseline,
  checkCoverage,
  loadRedirectMap,
} from '../scripts/check-redirect-coverage.mjs';

const gatePath = fileURLToPath(new URL('../scripts/check-redirect-coverage.mjs', import.meta.url));

// -- fixture helpers ---------------------------------------------------------

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'redirect-coverage-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

/** Astro's static redirect stub — see astro's `core/routing/3xx.js` `redirectTemplate`. */
function redirectStubHtml(target: string, delay = 0): string {
  return [
    '<!doctype html>',
    `<title>Redirecting to: ${target}</title>`,
    `<meta http-equiv="refresh" content="${delay};url=${target}">`,
    '<meta name="robots" content="noindex">',
    `<link rel="canonical" href="https://example.test${target}">`,
    '<body>',
    `\t<a href="${target}">Redirecting to <code>${target}</code></a>`,
    '</body>',
  ].join('\n');
}

function liveContentHtml(title: string): string {
  return `<!doctype html>\n<title>${title}</title>\n<body><h1>${title}</h1></body>`;
}

/** Write a page's dist file at `<distDir>` for site-absolute `urlPath` (directory-format build). */
function writePage(distDir: string, urlPath: string, html: string): void {
  const file = urlToDistFile(distDir, urlPath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html, 'utf8');
}

// -- unit-level helpers -------------------------------------------------------

describe('normalizeUrlPath', () => {
  it('leaves a site-absolute path unchanged', () => {
    expect(normalizeUrlPath('/guides/getting-started/')).toBe('/guides/getting-started/');
  });

  it('adds a leading slash when missing', () => {
    expect(normalizeUrlPath('guides/getting-started/')).toBe('/guides/getting-started/');
  });

  it('strips a pasted-in scheme+host defensively', () => {
    expect(normalizeUrlPath('https://example.test/adr/')).toBe('/adr/');
  });
});

describe('urlToDistFile', () => {
  it('maps a section route to <dist>/<section>/index.html (directory-format build)', () => {
    expect(urlToDistFile('/dist', '/adr/')).toBe(path.join('/dist', 'adr', 'index.html'));
  });

  it('maps the root path to <dist>/index.html', () => {
    expect(urlToDistFile('/dist', '/')).toBe(path.join('/dist', 'index.html'));
  });
});

describe('parseBaseline (E-04)', () => {
  it('ignores blank lines and # comments, trims whitespace', () => {
    const text = '# baseline\n/adr/\n\n  /guides/getting-started/  \n# trailing comment\n';
    expect(parseBaseline(text)).toEqual(['/adr/', '/guides/getting-started/']);
  });
});

// -- E-07 verdict model: pass / uncovered / dead-target / chain --------------

describe('resolveVerdict — E-07 coverage verdict', () => {
  it('PASS: a baselined URL that resolves directly to a live page is covered', () => {
    const dist = makeTmpDir();
    writePage(dist, '/adr/', liveContentHtml('Decision Records'));

    const verdict = resolveVerdict(dist, '/adr/');

    expect(verdict.covered).toBe(true);
    expect(verdict.chain).toEqual([]);
  });

  it('FAIL (uncovered): a baselined URL with no page and no redirect is named uncovered', () => {
    const dist = makeTmpDir();
    // Nothing written at this path at all.

    const verdict = resolveVerdict(dist, '/guides/never-existed/');

    expect(verdict.covered).toBe(false);
    expect(verdict.reason).toBe('no page and no redirect');
    expect(verdict.url).toBe('/guides/never-existed/');
  });

  it('FAIL (dead target): a redirect whose target 404s is uncovered and the target is named (B1)', () => {
    const dist = makeTmpDir();
    // The redirect stub exists, but its destination page was never built —
    // this is the defect the target-aware gate exists to close (D-05).
    writePage(dist, '/guides/old-getting-started/', redirectStubHtml('/guides/getting-started/'));
    // Deliberately NOT writing /guides/getting-started/ — its target 404s.

    const verdict = resolveVerdict(dist, '/guides/old-getting-started/');

    expect(verdict.covered).toBe(false);
    expect(verdict.reason).toBe('redirect target is dead');
    expect(verdict.failingTarget).toBe('/guides/getting-started/');
  });

  it('CHAIN: a redirect to an itself-redirected URL resolves to the live terminus', () => {
    const dist = makeTmpDir();
    // /a/ -> /b/ -> /c/ (live). Two hops.
    writePage(dist, '/a/', redirectStubHtml('/b/'));
    writePage(dist, '/b/', redirectStubHtml('/c/'));
    writePage(dist, '/c/', liveContentHtml('Live terminus'));

    const verdict = resolveVerdict(dist, '/a/');

    expect(verdict.covered).toBe(true);
    expect(verdict.chain).toEqual([
      { from: '/a/', to: '/b/' },
      { from: '/b/', to: '/c/' },
    ]);
  });

  it('CHAIN + dead target: a two-hop chain that terminates in a 404 is uncovered, naming the true dead target', () => {
    const dist = makeTmpDir();
    writePage(dist, '/a/', redirectStubHtml('/b/'));
    writePage(dist, '/b/', redirectStubHtml('/c/'));
    // /c/ never built.

    const verdict = resolveVerdict(dist, '/a/');

    expect(verdict.covered).toBe(false);
    expect(verdict.reason).toBe('redirect target is dead');
    expect(verdict.failingTarget).toBe('/c/');
  });

  it('LOOP: a redirect cycle is reported as uncovered rather than hanging', () => {
    const dist = makeTmpDir();
    writePage(dist, '/a/', redirectStubHtml('/b/'));
    writePage(dist, '/b/', redirectStubHtml('/a/'));

    const verdict = resolveVerdict(dist, '/a/');

    expect(verdict.covered).toBe(false);
    expect(verdict.reason).toBe('redirect loop detected');
  });

  it('a hand-authored page mentioning "refresh" prose is NOT misidentified as a redirect stub', () => {
    const dist = makeTmpDir();
    writePage(
      dist,
      '/guides/getting-started/',
      '<!doctype html><title>Getting started</title><body><p>Click refresh to reload.</p></body>',
    );

    const verdict = resolveVerdict(dist, '/guides/getting-started/');

    expect(verdict.covered).toBe(true);
  });
});

// -- --redirects override (E-03 explicit map) --------------------------------

describe('loadRedirectMap + inspectDistUrl override precedence', () => {
  it('parses a JSON redirect map', () => {
    const dist = makeTmpDir();
    const mapFile = path.join(dist, 'redirects.json');
    writeFileSync(mapFile, JSON.stringify({ '/old/': '/new/' }), 'utf8');

    expect(loadRedirectMap(mapFile)).toEqual({ '/old/': '/new/' });
  });

  it('parses a Netlify-style `_redirects` text file, ignoring comments/blank lines', () => {
    const dist = makeTmpDir();
    const mapFile = path.join(dist, '_redirects');
    writeFileSync(mapFile, '# comment\n/old/ /new/ 301\n\n/other/ /elsewhere/\n', 'utf8');

    expect(loadRedirectMap(mapFile)).toEqual({ '/old/': '/new/', '/other/': '/elsewhere/' });
  });

  it('an explicit --redirects entry takes precedence over a dist file at the same path', () => {
    const dist = makeTmpDir();
    // A live page happens to sit at /old/ in dist, but the override map says
    // it is a redirect — the override must win (explicit source of truth).
    writePage(dist, '/old/', liveContentHtml('Stale content'));
    writePage(dist, '/new/', liveContentHtml('Live target'));

    const verdict = resolveVerdict(dist, '/old/', { '/old/': '/new/' });

    expect(verdict.covered).toBe(true);
    expect(verdict.chain).toEqual([{ from: '/old/', to: '/new/' }]);
  });
});

describe('inspectDistUrl', () => {
  it('reports missing when no file exists at the resolved dist path', () => {
    const dist = makeTmpDir();
    expect(inspectDistUrl(dist, '/nope/')).toEqual({ kind: 'missing' });
  });
});

// -- checkCoverage (whole-baseline aggregate) --------------------------------

describe('checkCoverage', () => {
  it('ok is true iff every baselined URL is covered', () => {
    const dist = makeTmpDir();
    writePage(dist, '/adr/', liveContentHtml('ADR'));
    writePage(dist, '/guides/old-getting-started/', redirectStubHtml('/guides/getting-started/'));
    writePage(dist, '/guides/getting-started/', liveContentHtml('Getting started'));

    const { ok, uncovered } = checkCoverage(dist, ['/adr/', '/guides/old-getting-started/']);

    expect(ok).toBe(true);
    expect(uncovered).toEqual([]);
  });

  it('ok is false and names every uncovered URL when at least one fails', () => {
    const dist = makeTmpDir();
    writePage(dist, '/adr/', liveContentHtml('ADR'));
    // /missing/ has no page and no redirect.

    const { ok, uncovered } = checkCoverage(dist, ['/adr/', '/missing/']);

    expect(ok).toBe(false);
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0].url).toBe('/missing/');
  });
});

// -- CLI-level: exit codes (bare Node, no Astro build spawned — NFR-002) ------

describe('CLI (check-redirect-coverage.mjs run directly)', () => {
  it('exits 0 and prints OK when every baselined URL is covered', () => {
    const dist = makeTmpDir();
    writePage(dist, '/adr/', liveContentHtml('ADR'));
    const baselineFile = path.join(dist, 'url-baseline.txt');
    writeFileSync(baselineFile, '/adr/\n', 'utf8');

    const result = spawnSync('node', [gatePath, baselineFile, dist], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK/);
  });

  it('exits non-zero and names the uncovered URL when coverage fails', () => {
    const dist = makeTmpDir();
    const baselineFile = path.join(dist, 'url-baseline.txt');
    writeFileSync(baselineFile, '/never-built/\n', 'utf8');

    const result = spawnSync('node', [gatePath, baselineFile, dist], { encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('/never-built/');
  });

  it('exits non-zero and names the failing target for a redirect-to-dead-target baseline entry', () => {
    const dist = makeTmpDir();
    writePage(dist, '/guides/old-getting-started/', redirectStubHtml('/guides/getting-started/'));
    const baselineFile = path.join(dist, 'url-baseline.txt');
    writeFileSync(baselineFile, '/guides/old-getting-started/\n', 'utf8');

    const result = spawnSync('node', [gatePath, baselineFile, dist], { encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('/guides/getting-started/');
  });

  it('exits 2 with a usage message when required args are missing', () => {
    const result = spawnSync('node', [gatePath], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Usage/);
  });

  it('exits 2 when the dist dir does not exist (never spawns an Astro build itself — NFR-002)', () => {
    const dist = makeTmpDir();
    const baselineFile = path.join(dist, 'url-baseline.txt');
    writeFileSync(baselineFile, '/adr/\n', 'utf8');

    const result = spawnSync('node', [gatePath, baselineFile, path.join(dist, 'no-such-dist')], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/dist dir not found/);
  });
});
